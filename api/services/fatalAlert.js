const IORedis = require('ioredis');
const { getRedisConnection } = require('../config/redis');
const { User, App, Organization } = require('../models');
const { sendFatalAlert, resolveEmailConfig } = require('./email');
const { checkOrgLimit } = require('./emailRateLimit');

let redis = null;
const getRedis = () => {
  if (!redis) redis = new IORedis(getRedisConnection());
  return redis;
};

const ALERT_TTL = 86400; // 24 hours

/**
 * Check if a fatal alert was already sent for this fingerprint today.
 * Uses Redis key: fatal_sent:{fingerprint}
 * Returns true if this is the first time (alert should be sent).
 */
const shouldSendAlert = async (fingerprint) => {
  const key = `fatal_sent:${fingerprint}`;
  const result = await getRedis().set(key, '1', 'EX', ALERT_TTL, 'NX');
  return result === 'OK';
};

/**
 * Process fatal logs after a flush.
 */
const processFatalAlerts = async (fatalGroups, upsertedFingerprints) => {
  for (const { fingerprint, doc } of fatalGroups) {
    if (!upsertedFingerprints.has(fingerprint)) continue;

    const shouldSend = await shouldSendAlert(fingerprint);
    if (!shouldSend) continue;

    const recipients = await User.findAll({
      where: {
        organization_id: doc.organization_id,
        receive_fatal_emails: true,
        status: 'active',
      },
      attributes: ['email'],
    });

    if (recipients.length === 0) continue;

    // Check org email rate limit — skip (don't throw) if exceeded
    try {
      await checkOrgLimit(doc.organization_id);
    } catch (err) {
      if (err.code === 'EMAIL_RATE_LIMIT') {
        console.warn(`[FatalAlert] Org ${doc.organization_id} daily email limit reached, skipping fatal alert`);
        continue;
      }
      throw err;
    }

    const [app, org] = await Promise.all([
      App.findOne({ where: { uuid: doc.app_uuid }, attributes: ['name'] }),
      Organization.findByPk(doc.organization_id, { attributes: ['name'] }),
    ]);

    // Resolve org email config
    const emailConfig = await resolveEmailConfig(doc.organization_id);

    await sendFatalAlert({
      to: recipients.map((r) => r.email),
      appName: app?.name,
      appUuid: doc.app_uuid,
      message: doc.message,
      timestamp: doc.timestamp,
      organization: org?.name || `Org #${doc.organization_id}`,
      emailConfig,
    });
  }
};

module.exports = { processFatalAlerts };
