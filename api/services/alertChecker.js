const { Log, App, User, AlertRule } = require('../models');
const { resolveEmailConfig, sendWithConfig } = require('./email');
const { checkOrgLimit } = require('./emailRateLimit');

// ── Resolve monitored app UUIDs ──────────────────────────────────────────────
const resolveAppUuids = async (rule) => {
  if (rule.app_uuids && rule.app_uuids.length > 0) return rule.app_uuids;
  const apps = await App.findAll({
    where: { organization_id: rule.organization_id, status: 'active' },
    attributes: ['uuid'],
  });
  return apps.map((a) => a.uuid);
};

// ── Resolve recipients ───────────────────────────────────────────────────────
const resolveRecipients = async (rule) => {
  if (rule.recipient_type === 'custom' && rule.recipients?.length) return rule.recipients;
  const users = await User.findAll({
    where: { organization_id: rule.organization_id, status: 'active' },
    attributes: ['email'],
  });
  return users.map((u) => u.email);
};

// ── Resolve email config ─────────────────────────────────────────────────────
const resolveAlertEmailConfig = async (rule) => {
  if (rule.email_config_type === 'custom' && rule.smtp_host) {
    return {
      provider: 'smtp',
      smtpHost: rule.smtp_host,
      smtpPort: rule.smtp_port || 587,
      smtpUser: rule.smtp_user,
      smtpPass: rule.smtp_pass,
      smtpFrom: rule.smtp_from || rule.smtp_user,
    };
  }
  return resolveEmailConfig(rule.organization_id);
};

// ── App name map ─────────────────────────────────────────────────────────────
const buildAppNameMap = async (orgId) => {
  const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] });
  const map = {};
  apps.forEach((a) => { map[a.uuid] = a.name; });
  return map;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK: error_spike
// Count ERROR/FATAL logs in the last N minutes. Alert if >= threshold.
// ═══════════════════════════════════════════════════════════════════════════════
const checkErrorSpike = async (rule, appUuids) => {
  const windowMs = (rule.spike_window_minutes || 60) * 60 * 1000;
  const since = new Date(Date.now() - windowMs);
  const levels = rule.spike_levels || ['ERROR', 'FATAL'];

  const match = {
    organization_id: rule.organization_id,
    app_uuid: { $in: appUuids },
    level: { $in: levels },
    timestamp: { $gte: since },
  };

  const count = await Log.countDocuments(match);
  if (count < (rule.spike_threshold || 50)) return null;

  // Get per-app breakdown
  const breakdown = await Log.aggregate([
    { $match: match },
    { $group: { _id: '$app_uuid', count: { $sum: 1 }, latest: { $max: '$timestamp' }, sample: { $first: '$message' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  return {
    type: 'error_spike',
    total: count,
    threshold: rule.spike_threshold,
    window_minutes: rule.spike_window_minutes,
    levels,
    breakdown,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK: low_volume
// Compare current log count to historical average. Alert if below X%.
// ═══════════════════════════════════════════════════════════════════════════════
const checkLowVolume = async (rule, appUuids) => {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const baselineDays = rule.volume_baseline_days || 7;
  const percentage = rule.volume_percentage || 10;

  const baseMatch = {
    organization_id: rule.organization_id,
    app_uuid: { $in: appUuids },
  };

  // Today's count up to now
  const todayCount = await Log.countDocuments({
    ...baseMatch,
    timestamp: { $gte: todayStart, $lte: now },
  });

  // Historical averages: same time-of-day window over baseline_days
  const hourNow = now.getUTCHours() + now.getUTCMinutes() / 60;
  let totalHistorical = 0;
  let daysWithData = 0;

  for (let d = 1; d <= baselineDays; d++) {
    const dayStart = new Date(todayStart.getTime() - d * 86400000);
    const dayEnd = new Date(dayStart.getTime() + hourNow * 3600000);
    const count = await Log.countDocuments({
      ...baseMatch,
      timestamp: { $gte: dayStart, $lte: dayEnd },
    });
    if (count > 0) daysWithData++;
    totalHistorical += count;
  }

  if (daysWithData === 0) return null; // No baseline data

  const avgCount = totalHistorical / daysWithData;
  const actualPercentage = avgCount > 0 ? Math.round((todayCount / avgCount) * 100) : (todayCount > 0 ? 100 : 0);

  if (actualPercentage >= percentage) return null; // Above threshold, no alert

  return {
    type: 'low_volume',
    today_count: todayCount,
    avg_count: Math.round(avgCount),
    actual_percentage: actualPercentage,
    threshold_percentage: percentage,
    baseline_days: baselineDays,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK: no_logs
// Alert if no logs received in the last N hours for any monitored app.
// ═══════════════════════════════════════════════════════════════════════════════
const checkNoLogs = async (rule, appUuids) => {
  const silenceMs = (rule.silence_hours || 2) * 3600000;
  const cutoff = new Date(Date.now() - silenceMs);
  const silentApps = [];

  for (const uuid of appUuids) {
    const latest = await Log.findOne(
      { organization_id: rule.organization_id, app_uuid: uuid },
      { timestamp: 1 },
      { sort: { timestamp: -1 } }
    );
    if (!latest || latest.timestamp < cutoff) {
      silentApps.push({ app_uuid: uuid, last_log: latest?.timestamp || null });
    }
  }

  if (silentApps.length === 0) return null;

  return {
    type: 'no_logs',
    silence_hours: rule.silence_hours,
    silent_apps: silentApps,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main runner — called by the scheduler for each alert rule
// ═══════════════════════════════════════════════════════════════════════════════
const runAlertCheck = async (ruleId, { isTest = false } = {}) => {
  const rule = await AlertRule.findByPk(ruleId);
  if (!rule) return;
  if (!isTest && !rule.enabled) return;

  // Cooldown check
  if (!isTest && rule.last_triggered_at && rule.cooldown_hours) {
    const cooldownMs = rule.cooldown_hours * 3600000;
    if (Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMs) {
      console.log(`[AlertChecker] Skipping "${rule.name}" — still in cooldown`);
      return;
    }
  }

  const appUuids = await resolveAppUuids(rule);
  if (appUuids.length === 0) return;

  let result = null;
  switch (rule.alert_type) {
    case 'error_spike': result = await checkErrorSpike(rule, appUuids); break;
    case 'low_volume':  result = await checkLowVolume(rule, appUuids);  break;
    case 'no_logs':     result = await checkNoLogs(rule, appUuids);     break;
  }

  if (!result) {
    console.log(`[AlertChecker] "${rule.name}" — no alert condition met`);
    return;
  }

  // Resolve email context
  const [recipients, emailConfig, appNameMap] = await Promise.all([
    resolveRecipients(rule),
    resolveAlertEmailConfig(rule),
    buildAppNameMap(rule.organization_id),
  ]);

  if (recipients.length === 0) return;

  // Rate limit (skip for tests)
  if (!isTest) {
    try { await checkOrgLimit(rule.organization_id); } catch { return; }
  }

  // Build and send email
  const { buildAlertEmail } = require('./email');
  const { subject, html } = buildAlertEmail(rule, result, appNameMap);

  try {
    await sendWithConfig({ config: emailConfig, to: recipients, subject, html });
    console.log(`[AlertChecker] Alert "${rule.name}" sent to ${recipients.length} recipient(s)`);

    if (!isTest) {
      await rule.update({ last_triggered_at: new Date() });
    }
  } catch (err) {
    console.error(`[AlertChecker] Failed to send alert "${rule.name}":`, err.message);
  }
};

module.exports = { runAlertCheck };
