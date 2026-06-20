const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateApiKey } = require('../middleware/apiKey');
const { enqueueLog, enqueueBatch } = require('../queues/logQueue');

const router = express.Router();

// Rate limit per API key (app) — 1000 requests per minute
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.INGEST_RATE_LIMIT) || 1000,
  keyGenerator: (req) => req.app_uuid || 'unknown',
  validate: { ipKeyGenerator: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ingestion rate limit exceeded. Please slow down.' },
});

// Single log ingestion
router.post('/', validateApiKey, ingestLimiter, async (req, res) => {
  try {
    const { level, message, tags, metadata, timestamp } = req.body;

    await enqueueLog({
      timestamp: timestamp || new Date().toISOString(),
      organization_id: req.organization_id,
      app_uuid: req.app_uuid,
      level,
      message,
      tags: tags || [],
      metadata: metadata || {},
      ingested_at: new Date().toISOString(),
    });

    res.status(202).json({ status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue log' });
  }
});

// Batch log ingestion
router.post('/batch', validateApiKey, ingestLimiter, async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: 'logs must be a non-empty array' });
    }

    if (logs.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 logs per batch' });
    }

    const documents = logs.map((log) => ({
      timestamp: log.timestamp || new Date().toISOString(),
      organization_id: req.organization_id,
      app_uuid: req.app_uuid,
      level: log.level,
      message: log.message,
      tags: log.tags || [],
      metadata: log.metadata || {},
      ingested_at: new Date().toISOString(),
    }));

    await enqueueBatch(documents);

    res.status(202).json({ count: documents.length, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue logs' });
  }
});

module.exports = router;
