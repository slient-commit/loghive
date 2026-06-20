const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

let queue = null;

const getNotificationQueue = () => {
  if (!queue) {
    queue = new Queue('notification-digest', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 2,
      },
    });
  }
  return queue;
};

// Called by the scheduler when a cron fires, or directly for test runs
const enqueueDigest = async (ruleId, { isTest = false } = {}) => {
  await getNotificationQueue().add('send-digest', { ruleId, isTest }, {
    jobId: `digest-${ruleId}-${Date.now()}`,
  });
};

module.exports = { getNotificationQueue, enqueueDigest };
