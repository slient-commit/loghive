const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

const logQueue = new Queue('log-ingestion', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },  // keep last 1000 completed for debugging
    removeOnFail: { count: 5000 },      // keep last 5000 failed for investigation
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

/**
 * Add a single log to the queue
 */
const enqueueLog = async (logData) => {
  await logQueue.add('single', logData);
};

/**
 * Add a batch of logs to the queue.
 * Each batch becomes one job so the worker can insertMany in one go.
 */
const enqueueBatch = async (logsArray) => {
  await logQueue.add('batch', { logs: logsArray });
};

module.exports = { logQueue, enqueueLog, enqueueBatch };
