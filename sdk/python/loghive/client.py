import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests


class LogHive:
    def __init__(self, api_key: str, endpoint: str, batch_size: int = 50, flush_interval: float = 5.0):
        if not api_key:
            raise ValueError("LogHive: api_key is required")
        if not endpoint:
            raise ValueError("LogHive: endpoint is required")

        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.batch_size = batch_size
        self.flush_interval = flush_interval

        self._queue: List[dict] = []
        self._lock = threading.Lock()
        self._timer: Optional[threading.Timer] = None
        self._flushing = False
        self._session = requests.Session()
        self._session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        })

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _request(self, path: str, body: dict) -> dict:
        url = f"{self.endpoint}{path}"
        resp = self._session.post(url, json=body)
        resp.raise_for_status()
        return resp.json()

    def send(
        self,
        level: str,
        message: str,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> dict:
        log = {
            "level": level.upper(),
            "message": message,
            "tags": tags or [],
            "metadata": metadata or {},
            "timestamp": timestamp or self._now(),
        }
        return self._request("/api/ingest", log)

    def debug(self, message: str, **kwargs) -> dict:
        return self.send("DEBUG", message, **kwargs)

    def info(self, message: str, **kwargs) -> dict:
        return self.send("INFO", message, **kwargs)

    def warn(self, message: str, **kwargs) -> dict:
        return self.send("WARN", message, **kwargs)

    def error(self, message: str, **kwargs) -> dict:
        return self.send("ERROR", message, **kwargs)

    def fatal(self, message: str, **kwargs) -> dict:
        return self.send("FATAL", message, **kwargs)

    def queue(
        self,
        level: str,
        message: str,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> None:
        log = {
            "level": level.upper(),
            "message": message,
            "tags": tags or [],
            "metadata": metadata or {},
            "timestamp": timestamp or self._now(),
        }

        with self._lock:
            self._queue.append(log)

            if self._timer is None:
                self._timer = threading.Timer(self.flush_interval, self.flush)
                self._timer.daemon = True
                self._timer.start()

            if len(self._queue) >= self.batch_size:
                self._flush_locked()

    def flush(self) -> None:
        with self._lock:
            self._flush_locked()

    def _flush_locked(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

        if not self._queue or self._flushing:
            return

        self._flushing = True
        logs = self._queue[:1000]
        self._queue = self._queue[1000:]

        try:
            self._request("/api/ingest/batch", {"logs": logs})
        except Exception:
            self._queue = logs + self._queue
            raise
        finally:
            self._flushing = False

        if self._queue:
            self._timer = threading.Timer(self.flush_interval, self.flush)
            self._timer.daemon = True
            self._timer.start()

    def shutdown(self) -> None:
        if self._queue:
            self.flush()
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.shutdown()
