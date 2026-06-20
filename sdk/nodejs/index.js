const http = require('http');
const https = require('https');

class LogHive {
  constructor({ apiKey, endpoint }) {
    if (!apiKey) throw new Error('LogHive: apiKey is required');
    if (!endpoint) throw new Error('LogHive: endpoint is required');

    this.apiKey = apiKey;
    this.endpoint = endpoint.replace(/\/$/, '');
    this._queue = [];
    this._batchSize = 50;
    this._flushInterval = 5000;
    this._timer = null;
    this._flushing = false;
  }

  _request(path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.endpoint);
      const mod = url.protocol === 'https:' ? https : http;

      const req = mod.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LogHive API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  async send(level, message, options = {}) {
    const log = {
      level: level.toUpperCase(),
      message,
      tags: options.tags || [],
      metadata: options.metadata || {},
      timestamp: options.timestamp || new Date().toISOString(),
    };

    return this._request('/api/ingest', log);
  }

  debug(message, options) { return this.send('DEBUG', message, options); }
  info(message, options) { return this.send('INFO', message, options); }
  warn(message, options) { return this.send('WARN', message, options); }
  error(message, options) { return this.send('ERROR', message, options); }
  fatal(message, options) { return this.send('FATAL', message, options); }

  queue(level, message, options = {}) {
    this._queue.push({
      level: level.toUpperCase(),
      message,
      tags: options.tags || [],
      metadata: options.metadata || {},
      timestamp: options.timestamp || new Date().toISOString(),
    });

    if (!this._timer) {
      this._timer = setTimeout(() => this.flush(), this._flushInterval);
    }

    if (this._queue.length >= this._batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    if (this._queue.length === 0 || this._flushing) return;

    this._flushing = true;
    const logs = this._queue.splice(0, 1000);

    try {
      await this._request('/api/ingest/batch', { logs });
    } catch (err) {
      this._queue.unshift(...logs);
      throw err;
    } finally {
      this._flushing = false;
    }

    if (this._queue.length > 0) {
      this._timer = setTimeout(() => this.flush(), this._flushInterval);
    }
  }

  async shutdown() {
    if (this._queue.length > 0) {
      await this.flush();
    }
  }
}

module.exports = LogHive;
