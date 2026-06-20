# LogHive Python SDK

Python SDK for LogHive log ingestion with batch support and thread safety.

## Installation

```bash
pip install loghive-sdk
```

Or install from local path:

```bash
pip install /path/to/loghive/sdk/python
```

## Quick Start

```python
from loghive import LogHive

logger = LogHive(api_key="your-api-key", endpoint="https://your-loghive-instance.com")

logger.info("User signed in", tags=["auth"], metadata={"user_id": 123})
```

## API

### `LogHive(api_key, endpoint, batch_size=50, flush_interval=5.0)`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `api_key` | `str` | Yes | — | Your app API key |
| `endpoint` | `str` | Yes | — | LogHive server URL |
| `batch_size` | `int` | No | `50` | Queue size before auto-flush |
| `flush_interval` | `float` | No | `5.0` | Seconds between auto-flushes |

### Sending Logs

All send methods return the API response as a `dict`.

```python
logger.send(level, message, tags=None, metadata=None, timestamp=None)
logger.debug(message, **kwargs)
logger.info(message, **kwargs)
logger.warn(message, **kwargs)
logger.error(message, **kwargs)
logger.fatal(message, **kwargs)
```

#### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tags` | `list[str]` | `[]` | Tags for filtering |
| `metadata` | `dict` | `{}` | Additional context data |
| `timestamp` | `str` | Current time | ISO 8601 timestamp |

### Batch Queue

Queue logs locally and send them in batches. Auto-flushes every 5 seconds or when 50 logs are queued. Thread-safe.

```python
logger.queue("INFO", "Background task started")
logger.queue("ERROR", "Task failed", tags=["worker"], metadata={"task_id": "abc"})

# Manually flush
logger.flush()

# Flush before app exits
logger.shutdown()
```

### Context Manager

```python
with LogHive(api_key="...", endpoint="...") as logger:
    logger.info("Auto-shutdown on exit")
```

## Examples

### Django Middleware

```python
from loghive import LogHive

logger = LogHive(api_key=settings.LOGHIVE_API_KEY, endpoint=settings.LOGHIVE_ENDPOINT)

class LogHiveMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        logger.queue("INFO", f"{request.method} {request.path}", tags=["http"], metadata={
            "status": response.status_code,
            "ip": request.META.get("REMOTE_ADDR"),
        })
        return response
```

### FastAPI

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from loghive import LogHive

logger = LogHive(api_key="your-api-key", endpoint="https://your-loghive-instance.com")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    logger.shutdown()

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.queue("INFO", f"{request.method} {request.url.path}", tags=["http"], metadata={
        "status": response.status_code,
    })
    return response
```

### Error Tracking

```python
try:
    risky_operation()
except Exception as e:
    logger.error(str(e), tags=["exception"], metadata={
        "type": type(e).__name__,
    })
```
