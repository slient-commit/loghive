const IORedis = require('ioredis');
const { getRedisConnection } = require('../config/redis');

let redis = null;
const getRedis = () => {
  if (!redis) redis = new IORedis(getRedisConnection());
  return redis;
};

// Returns today's date string in UTC: "2025-06-20"
const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Atomically increment a daily counter.
 * - Key format: <prefix>:<id>:<YYYY-MM-DD>
 * - TTL: 26 hours (ensures cleanup even if key is created at 23:59)
 * - Throws with code EMAIL_RATE_LIMIT if count exceeds limit.
 */
const checkAndIncrement = async (key, limit) => {
  const r = getRedis();
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 26 * 3600); // set TTL only on first write
  if (count > limit) {
    await r.decr(key); // keep count accurate
    const err = new Error(`Email rate limit reached (${limit}/day). Try again tomorrow.`);
    err.code = 'EMAIL_RATE_LIMIT';
    throw err;
  }
};

/**
 * Org-scoped limit — notifications, fatal alerts, invitations.
 * Env: EMAIL_DAILY_LIMIT_ORG (default 10)
 */
const checkOrgLimit = async (orgId) => {
  const limit = parseInt(process.env.EMAIL_DAILY_LIMIT_ORG) || 10;
  await checkAndIncrement(`rl:org:${orgId}:${todayUTC()}`, limit);
};

/**
 * Pre-auth limit — forgot-password, resend-verification.
 * Env: EMAIL_DAILY_LIMIT_PREAUTH (default 5)
 * Does NOT throw — silently returns false so callers skip sending without leaking info.
 */
const checkPreAuthLimit = async (email) => {
  const limit = parseInt(process.env.EMAIL_DAILY_LIMIT_PREAUTH) || 5;
  const key = `rl:preauth:${email.toLowerCase().trim()}:${todayUTC()}`;
  try {
    await checkAndIncrement(key, limit);
    return true; // under limit, ok to send
  } catch (err) {
    if (err.code === 'EMAIL_RATE_LIMIT') {
      console.warn(`[EmailRateLimit] Pre-auth limit reached for ${email}`);
      return false; // over limit, skip silently
    }
    throw err;
  }
};

module.exports = { checkOrgLimit, checkPreAuthLimit };
