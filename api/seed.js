require('dotenv').config();
const crypto = require('crypto');
const { sequelize } = require('./config/mysql');
const { connectMongoDB } = require('./config/mongodb');
const { Organization, User, App, AppApiKey, Log } = require('./models');

// ─── Sample log data ───
const sampleLogs = [
  // DEBUG
  { level: 'DEBUG', message: 'Loading configuration from environment variables', tags: ['config', 'startup'], metadata: { module: 'config-loader' } },
  { level: 'DEBUG', message: 'Cache hit for user session usr_abc123', tags: ['cache', 'session'], metadata: { cache_key: 'sess:usr_abc123', ttl: 3600 } },
  { level: 'DEBUG', message: 'SQL query executed in 12ms: SELECT * FROM products WHERE active = 1', tags: ['database', 'query'], metadata: { duration_ms: 12, rows: 42 } },
  { level: 'DEBUG', message: 'WebSocket connection established for client ws_98765', tags: ['websocket'], metadata: { client_id: 'ws_98765', protocol: 'wss' } },
  { level: 'DEBUG', message: 'Template rendering completed for /dashboard view', tags: ['render'], metadata: { template: 'dashboard.hbs', duration_ms: 8 } },

  // INFO
  { level: 'INFO', message: 'Server started on port 8080', tags: ['startup', 'server'], metadata: { port: 8080, environment: 'production' } },
  { level: 'INFO', message: 'User usr_abc123 logged in successfully', tags: ['auth', 'login'], metadata: { user_id: 'usr_abc123', ip: '192.168.1.42', method: 'email' } },
  { level: 'INFO', message: 'Order #ORD-2024-1847 created successfully — $149.99', tags: ['order', 'checkout'], metadata: { order_id: 'ORD-2024-1847', amount: 149.99, currency: 'USD' } },
  { level: 'INFO', message: 'Email sent to customer@example.com — Order Confirmation', tags: ['email', 'notification'], metadata: { template: 'order_confirmation', recipient: 'customer@example.com' } },
  { level: 'INFO', message: 'Background job ProcessPayments completed — 23 items processed', tags: ['jobs', 'payments'], metadata: { job: 'ProcessPayments', processed: 23, duration_ms: 4521 } },
  { level: 'INFO', message: 'API rate limit reset for client api_key_xyz', tags: ['rate-limit', 'api'], metadata: { client: 'api_key_xyz', limit: 1000, window: '1h' } },
  { level: 'INFO', message: 'Database migration 20240615_add_indexes applied successfully', tags: ['database', 'migration'], metadata: { migration: '20240615_add_indexes', duration_ms: 890 } },
  { level: 'INFO', message: 'Health check passed — all services operational', tags: ['health', 'monitoring'], metadata: { mysql: 'ok', mongodb: 'ok', redis: 'ok' } },
  { level: 'INFO', message: 'File uploaded: report_q2_2024.pdf (2.4 MB)', tags: ['upload', 'storage'], metadata: { filename: 'report_q2_2024.pdf', size_bytes: 2516582, bucket: 's3-uploads' } },
  { level: 'INFO', message: 'Scheduled cleanup: removed 1,247 expired sessions', tags: ['cleanup', 'session'], metadata: { removed: 1247, older_than: '24h' } },

  // WARN
  { level: 'WARN', message: 'API response time exceeded 2000ms for GET /api/products', tags: ['performance', 'api'], metadata: { http: { method: 'GET', url: '/api/products', status_code: 200 }, duration_ms: 3421 } },
  { level: 'WARN', message: 'Memory usage at 82% — approaching threshold', tags: ['memory', 'infrastructure'], metadata: { used_mb: 1640, total_mb: 2048, threshold_pct: 85 } },
  { level: 'WARN', message: 'Deprecated API endpoint called: POST /api/v1/users (use /api/v2/users)', tags: ['deprecation', 'api'], metadata: { endpoint: '/api/v1/users', caller_ip: '10.0.0.55' } },
  { level: 'WARN', message: 'Redis connection pool running low — 2 of 20 connections available', tags: ['redis', 'connection-pool'], metadata: { available: 2, total: 20 } },
  { level: 'WARN', message: 'SSL certificate expires in 14 days for api.example.com', tags: ['ssl', 'security'], metadata: { domain: 'api.example.com', expires: '2024-06-29' } },
  { level: 'WARN', message: 'Disk usage at 78% on /data volume', tags: ['disk', 'infrastructure'], metadata: { volume: '/data', used_gb: 156, total_gb: 200 } },
  { level: 'WARN', message: 'Request retry #2 for external payment gateway', tags: ['retry', 'payments'], metadata: { attempt: 2, max_retries: 3, gateway: 'stripe' } },

  // ERROR
  { level: 'ERROR', message: 'Database connection timeout after 5000ms', tags: ['database', 'timeout'], metadata: { host: 'db-primary.internal', port: 3306, timeout_ms: 5000 } },
  { level: 'ERROR', message: 'Failed to process payment for order #ORD-2024-1848 — Card declined', tags: ['payments', 'checkout'], metadata: { order_id: 'ORD-2024-1848', error_code: 'card_declined', gateway: 'stripe' } },
  { level: 'ERROR', message: 'Unhandled exception in /api/v1/checkout: TypeError — Cannot read property "id" of undefined', tags: ['exception', 'api'], metadata: { http: { method: 'POST', url: '/api/v1/checkout', status_code: 500 }, stack_trace: 'TypeError: Cannot read property "id" of undefined\n    at processOrder (/app/src/services/order.js:42)\n    at handler (/app/src/routes/checkout.js:18)' } },
  { level: 'ERROR', message: 'S3 upload failed: AccessDenied — Check IAM permissions for bucket prod-assets', tags: ['storage', 'aws', 's3'], metadata: { bucket: 'prod-assets', error: 'AccessDenied', key: 'uploads/avatar_12345.png' } },
  { level: 'ERROR', message: 'Email delivery failed: 550 Mailbox not found — bounce@invalid.com', tags: ['email', 'bounce'], metadata: { recipient: 'bounce@invalid.com', smtp_code: 550, template: 'password_reset' } },
  { level: 'ERROR', message: 'Authentication failed: JWT token expired for user usr_def456', tags: ['auth', 'jwt'], metadata: { user_id: 'usr_def456', expired_at: '2024-06-14T08:30:00Z' } },
  { level: 'ERROR', message: 'Worker crash: OutOfMemoryError in ImageResizer — killed after 512MB', tags: ['worker', 'oom'], metadata: { worker: 'ImageResizer', memory_limit_mb: 512, job_id: 'job_7890' } },
  { level: 'ERROR', message: 'Rate limit exceeded for IP 203.0.113.42 — 429 Too Many Requests', tags: ['rate-limit', 'security'], metadata: { ip: '203.0.113.42', requests: 1520, window: '1m', limit: 100 } },

  // FATAL
  { level: 'FATAL', message: 'Database cluster unreachable — all replicas down. Service degraded.', tags: ['database', 'outage', 'critical'], metadata: { cluster: 'db-cluster-prod', replicas_down: 3, last_healthy: '2024-06-14T14:22:00Z' } },
  { level: 'FATAL', message: 'Out of disk space on root volume — application halted', tags: ['disk', 'infrastructure', 'critical'], metadata: { volume: '/', used_pct: 100, available_bytes: 0 } },
  { level: 'FATAL', message: 'Uncaught process exception: ENOMEM — Cannot allocate memory. Process exiting.', tags: ['memory', 'crash', 'critical'], metadata: { pid: 12847, rss_mb: 2048, heap_mb: 1890 } },
];

const seed = async () => {
  try {
    // Connect databases
    await sequelize.authenticate();
    console.log('MySQL connected');
    await sequelize.sync({ alter: true });
    console.log('Tables synced');
    await connectMongoDB();

    // ─── Organization ───
    const [org] = await Organization.findOrCreate({
      where: { slug: 'test' },
      defaults: {
        name: 'Test',
        slug: 'test',
        status: 'active',
      },
    });
    console.log(`Organization: ${org.name} (id: ${org.id})`);

    // ─── Admin User ───
    const [user, userCreated] = await User.findOrCreate({
      where: { email: 'test@test.com' },
      defaults: {
        email: 'test@test.com',
        password_hash: 'test',  // bcrypt hook hashes this
        organization_id: org.id,
        role: 'org_admin',
        status: 'active',
        email_verified: true,
        receive_fatal_emails: true,
      },
    });
    console.log(`User: ${user.email} (id: ${user.id})${userCreated ? ' [created]' : ' [exists]'}`);

    // ─── Sample App ───
    const [app, appCreated] = await App.findOrCreate({
      where: { name: 'Test App', organization_id: org.id },
      defaults: {
        name: 'Test App',
        description: 'Default test application for Log Hive',
        environment: 'development',
        organization_id: org.id,
        status: 'active',
      },
    });
    console.log(`App: ${app.name} (uuid: ${app.uuid})${appCreated ? ' [created]' : ' [exists]'}`);

    // ─── API Key for the app ───
    if (appCreated) {
      const { key, prefix, hash } = AppApiKey.generateKey();
      await AppApiKey.create({
        app_id: app.id,
        key_prefix: prefix,
        key_hash: hash,
        name: 'Test Key',
      });
      console.log(`API Key: ${key}`);
      console.log('(save this key — it won\'t be shown again)');
    }

    // ─── Sample Logs (always refresh) ───
    console.log('Generating sample logs...');
    const now = Date.now();
    const logs = [];

    // Generate logs spread over the last 7 days with realistic distribution
    for (let i = 0; i < 500; i++) {
      const template = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
      // Weight towards more recent logs
      const hoursAgo = Math.floor(Math.pow(Math.random(), 2) * 168); // 0-168h (7 days), skewed recent
      const timestamp = new Date(now - hoursAgo * 3600000);
      const day = timestamp.toISOString().slice(0, 10);

      const fp = crypto.createHash('sha256')
        .update(`${org.id}:${app.uuid}:${template.level}:${day}:${template.message}`)
        .digest('hex');

      logs.push({
        timestamp,
        organization_id: org.id,
        app_uuid: app.uuid,
        level: template.level,
        message: template.message,
        tags: template.tags,
        metadata: template.metadata,
        ingested_at: timestamp,
        fingerprint: fp,
        count: Math.floor(Math.random() * 20) + 1,
        first_seen_at: timestamp,
        last_seen_at: new Date(timestamp.getTime() + Math.random() * 3600000),
      });
    }

    // Deduplicate by fingerprint (keep highest count)
    const deduped = new Map();
    for (const log of logs) {
      if (deduped.has(log.fingerprint)) {
        const existing = deduped.get(log.fingerprint);
        existing.count += log.count;
        if (log.last_seen_at > existing.last_seen_at) existing.last_seen_at = log.last_seen_at;
      } else {
        deduped.set(log.fingerprint, log);
      }
    }

    const finalLogs = Array.from(deduped.values());

    // Insert directly into MongoDB (bypass Mongoose schema for fingerprint/count fields)
    await Log.collection.deleteMany({ organization_id: org.id, app_uuid: app.uuid });
    await Log.collection.insertMany(finalLogs);
    const totalCount = finalLogs.reduce((sum, l) => sum + l.count, 0);
    console.log(`Logs: ${finalLogs.length} unique entries (representing ${totalCount} total occurrences)`);

    console.log('\n── Seed complete ──');
    console.log(`Login:    test@test.com / test`);
    console.log(`App URL:  http://localhost:3000 (dev) or http://localhost (docker)`);
    console.log(`\nGo to Dashboard → select "Test App" to see stats & charts`);
    console.log(`Go to Logs → to see the log explorer with filters`);

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
