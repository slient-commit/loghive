# Log Hive

A self-hosted log monitoring platform. Ingest, search, group, and analyze logs from all your applications — with scheduled email digests, real-time dashboards, and SDKs for Node.js, Python, and .NET.

---

## Features

- **Log ingestion** — single and batch endpoints secured by per-app API keys
- **Log Explorer** — filter by level, tags, date range, and metadata; group by level, tag, or any metadata key with drill-down
- **Dashboard** — org-wide KPIs, log trends, app health status, peak hours heatmap, top errors, today vs yesterday comparison
- **Notification rules** — scheduled email digests (cron-based) with day-of-week selection, configurable time ranges, level filters, grouping with clickable group links, batching with per-email line limits and send delays; three email templates (Default, Microsoft Teams, Custom HTML), configurable column visibility and custom column labels, custom subject templates, all-clear emails when no logs match; supports Resend and custom SMTP
- **Fatal alerts** — instant email on first FATAL log occurrence per day (deduped via Redis)
- **Multi-app, multi-user** — organizations with role-based access, member invites, per-app API key management
- **SDKs** — zero-dependency Node.js, Python 3.7+, and .NET Standard 2.0
- **Security** — Helmet security headers, CORS origin restriction, rate limiting on login/register/ingestion, password strength enforcement, input sanitization (regex/NoSQL injection prevention), IP-based email rate limiting, sanitized error responses

---

## Stack

| Layer | Technology |
|---|---|
| API | Node.js · Express · Sequelize (MySQL) · Mongoose (MongoDB) |
| Queue | BullMQ · Redis |
| Frontend | React · Ant Design · Recharts · React Query |
| Email | Resend · Nodemailer (custom SMTP) |
| Scheduling | node-cron |
| Security | Helmet · express-rate-limit · bcrypt · Redis rate counters |
| Deployment | Docker Compose · Dokploy |

---

## Project Structure

```
loghive/
├── api/                  # Express REST API
│   ├── config/           # MySQL, MongoDB, Redis connections
│   ├── middleware/        # JWT auth, API key validation
│   ├── models/           # Sequelize + Mongoose models
│   ├── queues/           # BullMQ queue definitions
│   ├── workers/          # Log writer + notification workers
│   ├── services/         # Email, fatal alerts, notification scheduler
│   └── routes/           # auth, apps, logs, dashboard, notifications
├── app/                  # React frontend
│   └── src/
│       ├── api/          # Axios API clients
│       ├── pages/        # Dashboard, LogExplorer, Apps, Notifications...
│       ├── components/   # LogTable, StatsCards, LogLevelTag...
│       └── layouts/      # DashboardLayout with sidebar
├── sdk/
│   ├── nodejs/           # loghive-sdk (npm)
│   ├── python/           # loghive-sdk (PyPI)
│   └── dotnet/           # LogHive (.NET Standard 2.0)
└── docker-compose.yml
```

---

## Quickstart (Docker Compose)

### 1. Prerequisites

- Docker + Docker Compose
- A running MySQL, MongoDB, and Redis instance (or add them to the compose file)

### 2. Configure environment

Create a `.env` file at the root:

```env
JWT_SECRET=change-me-to-a-random-string   # Required, minimum 32 characters
JWT_EXPIRES_IN=7d

# CORS — comma-separated allowed origins (omit to allow all in dev)
# ALLOWED_ORIGINS=https://your-domain.com

MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=loghive
MYSQL_PASSWORD=yourpassword
MYSQL_DATABASE=loghive

MONGO_HOST=your-mongo-host
MONGO_PORT=27017
MONGO_USER=loghive
MONGO_PASSWORD=yourpassword
MONGO_DATABASE=loghive

REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=

APP_URL=https://your-domain.com

# Email — default provider (used when no org-level override is set)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=alerts@your-domain.com

# Rate limits
EMAIL_DAILY_LIMIT_ORG=10      # emails per org per day (notifications, fatal alerts, invitations)
EMAIL_DAILY_LIMIT_PREAUTH=5   # emails per address per day (forgot-password, resend-verification)
EMAIL_DAILY_LIMIT_IP=10       # emails per IP per day (registration, forgot-password, resend-verification)
INGEST_RATE_LIMIT=1000        # ingestion requests per minute per app
```

### 3. Run

```bash
docker compose up -d
```

The frontend will be available on port 80 (proxied through nginx) and the API on port 3001.

---

## SDK Usage

### Node.js

```bash
npm install loghive-sdk
```

```js
const LogHive = require('loghive-sdk');

const logger = new LogHive({
  apiKey: 'your-api-key',
  endpoint: 'https://your-loghive-instance.com',
});

// Simple log
await logger.info('User signed in', {
  tags: ['auth'],
  metadata: { userId: 42, ip: '1.2.3.4' },
});

// Queued (batched, auto-flushed every 5 s or 50 logs)
logger.queue('warn', 'Slow query detected', { metadata: { ms: 1200 } });

// Graceful shutdown
await logger.shutdown();
```

Supports: `debug`, `info`, `warn`, `error`, `fatal`, `send`, `queue`, `flush`, `shutdown`.

---

### Python

```bash
pip install loghive-sdk
```

```python
from loghive import LogHive

logger = LogHive(api_key="your-api-key", endpoint="https://your-loghive-instance.com")

logger.info("User signed in", tags=["auth"], metadata={"user_id": 42})
logger.error("Payment failed", metadata={"order_id": "ord_123"})

# Context manager — auto-flushes on exit
with LogHive(api_key="...", endpoint="...") as logger:
    logger.warn("Low disk space", metadata={"free_gb": 2.1})
```

---

### .NET (C#)

Add the project reference or the compiled DLL, then:

```csharp
using LogHive;

var logger = new LogHiveClient("your-api-key", "https://your-loghive-instance.com");

await logger.InfoAsync("App started");
await logger.ErrorAsync("Unhandled exception", tags: new[] { "critical" },
    metadata: new Dictionary<string, object> { ["userId"] = 99 });

// Batch queue — auto-flushed every 5 s or 50 logs
logger.Queue("warn", "High memory usage");

await logger.ShutdownAsync();
```

---

## API Reference

All endpoints require a **Bearer token** (JWT from login) except ingestion endpoints, which require an **API key**.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create organization + admin account |
| `POST` | `/api/auth/login` | Get JWT token |
| `GET`  | `/api/auth/me` | Current user |
| `GET`  | `/api/auth/verify-email` | Verify email address |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |

### Log Ingestion (API key auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest` | Send a single log |
| `POST` | `/api/ingest/batch` | Send up to 500 logs |

**Single log body:**
```json
{
  "level": "ERROR",
  "message": "Something went wrong",
  "tags": ["api", "payments"],
  "metadata": { "orderId": "ord_123" },
  "timestamp": "2025-06-20T10:00:00.000Z"
}
```

### Logs (JWT auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/logs/:appUuid` | Query logs with filters |
| `GET`  | `/api/logs/:appUuid/stats` | Log counts by level |
| `GET`  | `/api/logs/:appUuid/tags` | Distinct tag list |
| `GET`  | `/api/logs/:appUuid/group` | Group by level / tag / metadata key |

**Query parameters for `/api/logs/:appUuid`:**

| Param | Type | Description |
|-------|------|-------------|
| `level` | string | Filter by level (DEBUG, INFO, WARN, ERROR, FATAL) |
| `search` | string | Full-text search in message |
| `tag` | string | Filter by tag |
| `from` | ISO date | Start of date range |
| `to` | ISO date | End of date range |
| `metaKey` | string | Metadata key for drill-down |
| `metaValue` | string | Metadata value for drill-down |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50) |

### Apps (JWT auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/apps` | List all apps |
| `POST` | `/api/apps` | Create app |
| `GET`  | `/api/apps/:uuid` | Get app details |
| `PUT`  | `/api/apps/:uuid` | Update app |
| `POST` | `/api/apps/:uuid/keys` | Generate API key |
| `GET`  | `/api/apps/:uuid/keys` | List API keys |
| `DELETE` | `/api/apps/:uuid/keys/:keyId` | Revoke API key |

### Notifications (JWT auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/notifications` | List notification rules |
| `POST` | `/api/notifications` | Create rule |
| `PUT`  | `/api/notifications/:uuid` | Update rule |
| `PATCH`| `/api/notifications/:uuid/toggle` | Enable / disable rule |
| `POST` | `/api/notifications/:uuid/test` | Trigger immediately |
| `DELETE` | `/api/notifications/:uuid` | Delete rule |

---

## Notification Rules

Notification rules let you schedule email digests for your log data.

**Example rule (POST `/api/notifications`):**

```json
{
  "name": "Daily error summary",
  "enabled": true,
  "schedule_times": ["09:00", "18:00"],
  "schedule_days": [1, 2, 3, 4, 5],
  "time_range_type": "interval",
  "time_range_hours": 9,
  "app_uuids": [],
  "log_levels": ["ERROR", "FATAL"],
  "group_by": "level",
  "group_link_url": "https://app.example.com/logs?level={grouping_value}",
  "lines_per_email": 20,
  "email_delay_seconds": 6,
  "subject_template": "[{rule_name}] {log_count} issue(s) on {date}",
  "email_template_type": "default",
  "recipient_type": "org_users",
  "email_config_type": "system"
}
```

| Field | Description |
|-------|-------------|
| `schedule_times` | UTC times to run, e.g. `["09:00", "17:00"]` |
| `schedule_days` | Days of week to run: `[0..6]` where 0=Sun, 6=Sat. Empty array = every day |
| `time_range_type` | `last_24h` or `interval` |
| `time_range_hours` | Hours to look back (used when type is `interval`) |
| `app_uuids` | Apps to include — empty array means all apps |
| `log_levels` | Levels to include — `["ERROR", "FATAL", "WARN"]` |
| `group_by` | `none`, `level`, `tag`, or `metadata` |
| `group_meta_key` | Metadata key to group by (when `group_by` is `metadata`) |
| `group_link_url` | URL template for grouped values — use `{grouping_value}` as a variable |
| `lines_per_email` | Max rows per email — excess rows go into follow-up emails |
| `email_delay_seconds` | Seconds to wait between batched emails |
| `subject_template` | Custom email subject — supports `{rule_name}`, `{date}`, `{time}`, `{app_names}`, `{log_count}`, `{levels}`, `{range}` |
| `email_template_type` | `default` (styled), `teams` (plain HTML for Microsoft Teams), or `custom` |
| `email_template_custom` | Custom HTML body (when type is `custom`) — supports same variables + `{log_table}` |
| `email_columns` | JSON object controlling column visibility and labels per mode: `{ grouped: { col_key: { show?, label? } }, flat: { ... } }` |
| `recipient_type` | `org_users` (all members) or `custom` |
| `recipients` | Array of email addresses (when `recipient_type` is `custom`) |
| `email_config_type` | `system` (uses org email settings) or `custom` (rule-specific SMTP) |
| `smtp_host` / `smtp_port` / `smtp_user` / `smtp_pass` / `smtp_from` | SMTP config (when `email_config_type` is `custom`) |

---

## Security

LogHive includes the following security measures out of the box:

| Protection | Description |
|------------|-------------|
| **Helmet** | Sets secure HTTP headers (X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, CSP, etc.) |
| **CORS** | Configurable origin whitelist via `ALLOWED_ORIGINS` — restricts which domains can call the API |
| **JWT validation** | App refuses to start if `JWT_SECRET` is missing or under 32 characters |
| **Rate limiting** | Login (10/15min), registration (5/hour), pre-auth emails (5/15min), ingestion (1000/min per app) |
| **Password strength** | Minimum 8 characters, must contain uppercase, lowercase, and a number |
| **Email rate limiting** | Per-org, per-email, and per-IP daily limits (Redis-backed counters) |
| **Input sanitization** | Regex patterns escaped to prevent ReDoS; metadata keys validated against injection |
| **Error sanitization** | Internal error details are logged server-side but never returned to the client |
| **Password hashing** | bcrypt with 12 salt rounds |
| **API key hashing** | SHA-256 — raw keys are never stored |
| **Role-based access** | `authorize()` middleware on mutation routes; `org_admin`-only gates on sensitive operations |

**Production checklist:**

1. Set `JWT_SECRET` to a random string of 32+ characters
2. Set `ALLOWED_ORIGINS` to your domain(s)
3. Use HTTPS (terminate TLS at nginx or a reverse proxy)
4. Set strong passwords for MySQL, MongoDB, and Redis
5. Review email rate limits for your expected volume

---

## Deployment with Dokploy

LogHive is designed to deploy on [Dokploy](https://dokploy.com) using Docker Compose with a shared external network.

1. Create a Dokploy project and add a **Docker Compose** service pointing to your repository
2. Add the environment variables from the `.env` section above in the Dokploy environment tab
3. Set up MySQL, MongoDB, and Redis as separate Dokploy database services on the same `dokploy-network`
4. Point your domain to the `app` service (nginx serves the React frontend and proxies `/api/*` to the API)

The `docker-compose.yml` uses `dokploy-network` as an external network so all services can reach each other by container name.

---

## Development

### API

```bash
cd api
npm install
cp .env.example .env   # fill in your values
npm start
```

### Frontend

```bash
cd app
npm install
npm start
```

The frontend dev server proxies `/api` requests to `http://localhost:3001` automatically.

---

## License

Source-Available Non-Commercial & No-SaaS License
