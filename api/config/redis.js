const IORedis = require('ioredis');

const getRedisConnection = () => {
  const opts = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null, // required by BullMQ
  };

  if (process.env.REDIS_PASSWORD) {
    opts.password = process.env.REDIS_PASSWORD;
  }

  return opts;
};

const connectRedis = async () => {
  const connection = new IORedis(getRedisConnection());

  return new Promise((resolve, reject) => {
    connection.on('connect', () => {
      console.log('Redis connected successfully');
      connection.disconnect();
      resolve();
    });
    connection.on('error', (err) => {
      console.error('Redis connection error:', err.message);
      reject(err);
    });
  });
};

module.exports = { getRedisConnection, connectRedis };
