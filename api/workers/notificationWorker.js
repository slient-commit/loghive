const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { NotificationRule, User, App, Log } = require('../models');
const { sendNotificationDigest, sendAllClearEmail, resolveEmailConfig } = require('../services/email');
const { checkOrgLimit } = require('../services/emailRateLimit');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processDigest = async (job) => {
  const { ruleId, isTest = false } = job.data;

  const rule = await NotificationRule.findByPk(ruleId);
  if (!rule) {
    console.log(`[NotificationWorker] Rule ${ruleId} not found, skipping`);
    return;
  }
  if (!isTest && !rule.enabled) {
    console.log(`[NotificationWorker] Rule ${ruleId} disabled, skipping`);
    return;
  }

  // ── 1. Time range ────────────────────────────────────────
  const now = new Date();
  const hoursBack = rule.time_range_type === 'last_24h' ? 24 : (rule.time_range_hours || 24);
  const fromDate = new Date(now - hoursBack * 60 * 60 * 1000);

  // ── 2. Resolve app UUIDs ──────────────────────────────────
  let appUuids = Array.isArray(rule.app_uuids) ? rule.app_uuids : [];
  if (appUuids.length === 0) {
    const apps = await App.findAll({
      where: { organization_id: rule.organization_id },
      attributes: ['uuid'],
    });
    appUuids = apps.map((a) => a.uuid);
  }

  if (appUuids.length === 0) {
    console.log(`[NotificationWorker] Rule ${rule.uuid}: no apps found`);
    return;
  }

  // ── 3. Build MongoDB query ────────────────────────────────
  const match = {
    organization_id: rule.organization_id,
    app_uuid: { $in: appUuids },
    timestamp: { $gte: fromDate, $lte: now },
  };

  const levels = Array.isArray(rule.log_levels) ? rule.log_levels : [];
  if (levels.length > 0) match.level = { $in: levels };

  // ── 4. Fetch logs (grouped or flat) ──────────────────────
  let items = [];
  const isGrouped = rule.group_by && rule.group_by !== 'none';

  if (isGrouped) {
    let groupId;
    if (rule.group_by === 'level')    groupId = '$level';
    else if (rule.group_by === 'tag') groupId = { $arrayElemAt: ['$tags', 0] };
    else                              groupId = `$metadata.${rule.group_meta_key}`;

    items = await Log.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          count:   { $sum: '$count' },
          latest:  { $max: '$timestamp' },
          sample_message:  { $first: '$message' },
          sample_level:    { $first: '$level' },
          sample_app:      { $first: '$app_uuid' },
          sample_metadata: { $first: '$metadata' },
          sample_tags:     { $first: '$tags' },
        },
      },
      { $sort: { count: -1 } },
    ]);
  } else {
    // Cap at a reasonable maximum to avoid massive emails
    const maxRows = Math.max(rule.lines_per_email * 50, 500);
    items = await Log.find(match)
      .sort({ timestamp: -1 })
      .limit(maxRows)
      .lean();
  }

  // ── 5. Get recipients ─────────────────────────────────────
  let recipients = [];
  if (rule.recipient_type === 'org_users') {
    const users = await User.findAll({
      where: { organization_id: rule.organization_id },
      attributes: ['email'],
    });
    recipients = users.map((u) => u.email).filter(Boolean);
  } else {
    recipients = Array.isArray(rule.recipients) ? rule.recipients.filter(Boolean) : [];
  }

  if (!recipients.length) {
    console.log(`[NotificationWorker] Rule "${rule.name}": no recipients configured`);
    return;
  }

  // ── 6. App name lookup ────────────────────────────────────
  const apps = await App.findAll({
    where: { organization_id: rule.organization_id },
    attributes: ['uuid', 'name'],
  });
  const appNameMap = Object.fromEntries(apps.map((a) => [a.uuid, a.name]));

  // ── 7. Resolve email config ───────────────────────────────
  let emailConfig;
  if (!rule.email_config_type || rule.email_config_type === 'system') {
    emailConfig = await resolveEmailConfig(rule.organization_id);
  } else {
    emailConfig = {
      provider: 'smtp',
      smtpHost: rule.smtp_host,
      smtpPort: rule.smtp_port || 587,
      smtpUser: rule.smtp_user,
      smtpPass: rule.smtp_pass,
      smtpFrom: rule.smtp_from || rule.smtp_user,
    };
  }

  // ── 8. All clear — no matching logs ──────────────────────
  if (!items.length) {
    console.log(`[NotificationWorker] Rule "${rule.name}": no logs in range, sending all-clear`);
    if (!isTest) {
      try {
        await checkOrgLimit(rule.organization_id);
      } catch (err) {
        if (err.code === 'EMAIL_RATE_LIMIT') {
          console.warn(`[NotificationWorker] Org ${rule.organization_id} daily email limit reached — skipping all-clear`);
          return;
        }
        throw err;
      }
    }
    await sendAllClearEmail({ rule, recipients, fromDate, toDate: now, appNameMap, emailConfig });
    return;
  }

  // ── 9. Chunk into batches ─────────────────────────────────
  const chunkSize = Math.max(1, rule.lines_per_email || 10);
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  const delaySec = rule.email_delay_seconds ?? 6;

  console.log(`[NotificationWorker] Rule "${rule.name}": ${items.length} items → ${chunks.length} email(s) to ${recipients.length} recipient(s)`);

  // ── 10. Send emails with delay and per-chunk rate limit ──
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(delaySec * 1000);

    // Check org rate limit before each email chunk (skip for test runs)
    if (!isTest) {
      try {
        await checkOrgLimit(rule.organization_id);
      } catch (err) {
        if (err.code === 'EMAIL_RATE_LIMIT') {
          console.warn(`[NotificationWorker] Org ${rule.organization_id} daily email limit reached — stopping at chunk ${i + 1}/${chunks.length}`);
          break;
        }
        throw err;
      }
    }

    await sendNotificationDigest({
      rule,
      recipients,
      items: chunks[i],
      isGrouped,
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      totalItems: items.length,
      fromDate,
      toDate: now,
      appNameMap,
      emailConfig,
    });
  }
};

let worker = null;

const startNotificationWorker = () => {
  worker = new Worker('notification-digest', processDigest, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[NotificationWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[NotificationWorker] Started');
  return worker;
};

module.exports = { startNotificationWorker };
