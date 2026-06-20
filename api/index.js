require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Log Hive API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings/email', emailSettingsRoutes);

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
    console.log(`Log Hive API running on http://localhost:${port}`);
  });
};

start();
