const cron = require('node-cron');
const { runAlertCheck } = require('./alertChecker');

const activeJobs = new Map();

const timeToCron = (hhmm, days) => {
  const [h, m] = hhmm.split(':').map(Number);
  const dayField = (days && days.length > 0 && days.length < 7)
    ? [...days].sort((a, b) => a - b).join(',')
    : '*';
  return `${m} ${h} * * ${dayField}`;
};

const scheduleAlert = (rule) => {
  stopAlert(rule.id);
  if (!rule.enabled || !rule.schedule_times?.length) return;

  const jobs = rule.schedule_times.map((time) => {
    const expr = timeToCron(time, rule.schedule_days);
    if (!cron.validate(expr)) {
      console.warn(`[AlertScheduler] Invalid cron for alert ${rule.uuid} at ${time}`);
      return null;
    }
    return cron.schedule(expr, async () => {
      console.log(`[AlertScheduler] Checking alert "${rule.name}" (${rule.uuid}) at ${time} UTC`);
      try {
        await runAlertCheck(rule.id);
      } catch (err) {
        console.error(`[AlertScheduler] Check failed for ${rule.uuid}:`, err.message);
      }
    }, { timezone: 'UTC' });
  }).filter(Boolean);

  activeJobs.set(rule.id, jobs);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysLabel = (rule.schedule_days?.length > 0 && rule.schedule_days.length < 7)
    ? rule.schedule_days.map((d) => dayNames[d]).join(', ')
    : 'every day';
  console.log(`[AlertScheduler] Alert "${rule.name}" scheduled at: ${rule.schedule_times.join(', ')} UTC on ${daysLabel}`);
};

const stopAlert = (ruleId) => {
  const jobs = activeJobs.get(ruleId);
  if (jobs) {
    jobs.forEach((j) => j.stop());
    activeJobs.delete(ruleId);
  }
};

const startAlertScheduler = async () => {
  const { AlertRule } = require('../models');
  const rules = await AlertRule.findAll({ where: { enabled: true } });
  rules.forEach((rule) => scheduleAlert(rule));
  console.log(`[AlertScheduler] Started — ${rules.length} active alert rule(s) loaded`);
};

module.exports = { scheduleAlert, stopAlert, startAlertScheduler };
