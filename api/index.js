require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectMySQL } = require('./config/mysql');
const { connectMongoDB } = require('./config/mongodb');
const { connectRedis } = require('./config/redis');
const { startLogWriter } = require('./workers/logWriter');
const { startNotificationWorker } = require('./workers/notificationWorker');
const { startScheduler } = require('./services/notificationScheduler');

// Import models to register associations
require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const appRoutes = require('./routes/apps');
const ingestRoutes = require('./routes/ingest');
const logRoutes = require('./routes/logs');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const emailSettingsRoutes = require('./routes/emailSettings');

// ── Validate critical env vars at startup ────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. The API cannot start without it.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('[WARN] JWT_SECRET is shorter than 32 characters. Use a longer secret in production.');
}

const app = express();
const port = process.env.PORT || 3001;

// Trust proxy (nginx) so req.ip returns the real client IP
app.set('trust proxy', 1);

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : undefined; // undefined = allow all in dev; set ALLOWED_ORIGINS in production

app.use(cors({
  origin: allowedOrigins || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

app.use(express.json({ limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'LogHive API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings/email', emailSettingsRoutes);

// ── Global error handler — never leak internals to client ────────────────────
app.use((err, req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

// Start server
const start = async () => {
  await connectMySQL();
  await connectMongoDB();
  await connectRedis();

  // Start background workers
  startLogWriter();
  startNotificationWorker();

  // Start notification cron scheduler (loads all active rules from DB)
  await startScheduler();

  app.listen(port, () => {
    console.log(`LogHive API running on http://localhost:${port}`);
  });
};

start();
