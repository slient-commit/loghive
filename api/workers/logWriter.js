const { Worker } = require('bullmq');
const crypto = require('crypto');
const { getRedisConnection } = require('../config/redis');
const { Log } = require('../models');
const { processFatalAlerts } = require('../services/fatalAlert');

const BATCH_COLLECT_MS = 2000;  // collect jobs for 2s before flushing
const MAX_BATCH_SIZE = 500;     // flush if buffer hits this size

let buffer = [];
let flushTimer = null;

/**
 * Generate a daily fingerprint from the log's identity fields.
 * Same org + app + level + message on the same day = same fingerprint.
 */
const fingerprint = (doc) => {
  const day = new Date(doc.timestamp).toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${doc.organization_id}:${doc.app_uuid}:${doc.level}:${day}:${doc.message}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Flush buffer to MongoDB using bulkWrite upserts.
 * Duplicate logs (same fingerprint) get their count incremented
 * instead of creating new documents.
 */
const flush = async () => {
  if (buffer.length === 0) return;

  const toProcess = buffer.splice(0);
  const now = new Date();

  // Group logs by fingerprint to pre-aggregate within the buffer itself
  const groups = new Map();
  for (const doc of toProcess) {
    const fp = fingerprint(doc);
    if (groups.has(fp)) {
      const group = groups.get(fp);
      group.count += 1;
      // Keep the latest timestamp as last_seen
      if (new Date(doc.timestamp) > new Date(group.doc.timestamp)) {
        group.doc.timestamp = doc.timestamp;
      }
      // Merge unique tags
      for (const tag of (doc.tags || [])) {
        if (!group.tags.has(tag)) group.tags.add(tag);
      }
    } else {
      groups.set(fp, {
        count: 1,
        doc,
        tags: new Set(doc.tags || []),
      });
    }
  }

  // Build bulkWrite operations: one upsert per unique fingerprint
  const ops = [];
  for (const [fp, { count, doc, tags }] of groups) {
    ops.push({
      updateOne: {
        filter: { fingerprint: fp },
        update: {
          $inc: { count },
          $set: {
            last_seen_at: now,
            tags: Array.from(tags),
          },
          $setOnInsert: {
            fingerprint: fp,
            timestamp: new Date(doc.timestamp),
            first_seen_at: now,
            organization_id: doc.organization_id,
            app_uuid: doc.app_uuid,
            level: doc.level,
            message: doc.message,
            metadata: doc.metadata || {},
            ingested_at: new Date(doc.ingested_at),
          },
        },
        upsert: true,
      },
    });
  }

  try {
    const result = await Log.collection.bulkWrite(ops, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    console.log(
      `[LogWriter] Processed ${toProcess.length} logs → ${ops.length} unique | ${upserted} new, ${modified} merged`
    );

    // Collect newly upserted fingerprints
    const upsertedFingerprints = new Set(
      Object.values(result.upsertedIds || {}).length > 0
        ? Array.from(groups.entries())
            .filter(([fp]) => {
              // A fingerprint was upserted if its index appears in upsertedIds
              const idx = Array.from(groups.keys()).indexOf(fp);
              return result.upsertedIds?.[idx] !== undefined;
            })
            .map(([fp]) => fp)
        : []
    );

    // Process fatal alerts for newly inserted FATAL logs
    const fatalGroups = Array.from(groups.entries())
      .filter(([, { doc }]) => doc.level === 'FATAL')
      .map(([fp, { doc }]) => ({ fingerprint: fp, doc }));

    if (fatalGroups.length > 0) {
      processFatalAlerts(fatalGroups, upsertedFingerprints).catch((err) => {
        console.error('[LogWriter] Fatal alert processing error:', err.message);
      });
    }
  } catch (err) {
    console.error(`[LogWriter] Bulk write error (${toProcess.length} logs):`, err.message);
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flush();
  }, BATCH_COLLECT_MS);
};

const startLogWriter = () => {
  const worker = new Worker(
    'log-ingestion',
    async (job) => {
      let docs;

      if (job.name === 'batch') {
        docs = job.data.logs;
      } else {
        docs = [job.data];
      }

      buffer.push(...docs);

      if (buffer.length >= MAX_BATCH_SIZE) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        await flush();
      } else {
        scheduleFlush();
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('ready', () => {
    console.log('[LogWriter] Worker ready, waiting for jobs...');
  });

  worker.on('failed', (job, err) => {
    console.error(`[LogWriter] Job ${job?.id} failed:`, err.message);
  });

  // Flush remaining buffer on shutdown
  const gracefulShutdown = async () => {
    console.log('[LogWriter] Shutting down, flushing remaining buffer...');
    if (flushTimer) clearTimeout(flushTimer);
    await flush();
    await worker.close();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return worker;
};

module.exports = { startLogWriter };
