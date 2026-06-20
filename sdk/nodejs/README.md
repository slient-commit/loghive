# LogHive Node.js SDK

Zero-dependency Node.js SDK for LogHive log ingestion.

## Installation

```bash
npm install loghive-sdk
```

Or install from local path:

```bash
npm install /path/to/loghive/sdk/nodejs
```

## Quick Start

```js
const LogHive = require('loghive-sdk');

const logger = new LogHive({
  apiKey: 'your-api-key',
  endpoint: 'https://your-loghive-instance.com',
});

await logger.info('User signed in', {
  tags: ['auth'],
  metadata: { userId: 123 },
});
```

## API

### `new LogHive(options)`

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Your app API key |
| `endpoint` | `string` | Yes | LogHive server URL |

### Sending Logs

All send methods return a `Promise<{ status: 'queued' }>`.

```js
await logger.send(level, message, options);
await logger.debug(message, options);
await logger.info(message, options);
await logger.warn(message, options);
await logger.error(message, options);
await logger.fatal(message, options);
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `tags` | `string[]` | `[]` | Tags for filtering |
| `metadata` | `object` | `{}` | Additional context data |
| `timestamp` | `string` | Current time | ISO 8601 timestamp |

### Batch Queue

Queue logs locally and send them in batches. Auto-flushes every 5 seconds or when 50 logs are queued.

```js
logger.queue('INFO', 'Background task started');
logger.queue('ERROR', 'Task failed', {
  tags: ['worker'],
  metadata: { taskId: 'abc' },
});

// Manually flush
await logger.flush();

// Flush before app exits
await logger.shutdown();
```

## Examples

### Express Middleware

```js
const LogHive = require('loghive-sdk');

const logger = new LogHive({
  apiKey: process.env.LOGHIVE_API_KEY,
  endpoint: process.env.LOGHIVE_ENDPOINT,
});

app.use((req, res, next) => {
  res.on('finish', () => {
    logger.queue('INFO', `${req.method} ${req.path}`, {
      tags: ['http'],
      metadata: {
        status: res.statusCode,
        ip: req.ip,
      },
    });
  });
  next();
});

// Flush on shutdown
process.on('SIGTERM', async () => {
  await logger.shutdown();
  process.exit(0);
});
```

### Error Tracking

```js
try {
  await riskyOperation();
} catch (err) {
  await logger.error(err.message, {
    tags: ['exception'],
    metadata: { stack: err.stack },
  });
}
```
