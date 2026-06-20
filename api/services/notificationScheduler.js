const cron = require('node-cron');
const { enqueueDigest } = require('../queues/notificationQueue');

// Map: ruleId -> array of cron.ScheduledTask
const activeJobs = new Map();

// "09:00" + [1,2,3,4,5] -> "0 9 * * 1,2,3,4,5"   (empty days = every day = *)
const timeToCron = (hhmm, days) => {
  const [h, m] = hhmm.split(':').map(Number);
  const dayField = (days && days.length > 0 && days.length < 7)
    ? [...days].sort((a, b) => a - b).join(',')
    : '*';
  return `${m} ${h} * * ${dayField}`;
};

const scheduleRule = (rule) => {
  // Stop existing jobs for this rule first
  stopRule(rule.id);

  if (!rule.enabled || !rule.schedule_times?.length) return;

  const jobs = rule.schedule_times.map((time) => {
    const expr = timeToCron(time, rule.schedule_days);
    if (!cron.validate(expr)) {
      console.warn(`[Scheduler] Invalid cron expression for rule ${rule.uuid} at time ${time}`);
      return null;
    }
    return cron.schedule(expr, async () => {
      console.log(`[Scheduler] Firing rule "${rule.name}" (${rule.uuid}) at ${time} UTC`);
      try {
        await enqueueDigest(rule.id);
      } catch (err) {
        console.error(`[Scheduler] Failed to enqueue rule ${rule.uuid}:`, err.message);
      }
    }, { timezone: 'UTC' });
  }).filter(Boolean);

  activeJobs.set(rule.id, jobs);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysLabel = (rule.schedule_days?.length > 0 && rule.schedule_days.length < 7)
    ? rule.schedule_days.map((d) => dayNames[d]).join(', ')
    : 'every day';
  console.log(`[Scheduler] Rule "${rule.name}" scheduled at: ${rule.schedule_times.join(', ')} UTC on ${daysLabel}`);
};

const stopRule = (ruleId) => {
  const jobs = activeJobs.get(ruleId);
  if (jobs) {
    jobs.forEach((j) => j.stop());
    activeJobs.delete(ruleId);
  }
};

const startScheduler = async () => {
  // Lazy-require models here to avoid circular init issues
  const { NotificationRule } = require('../models');
  const rules = await NotificationRule.findAll({ where: { enabled: true } });
  rules.forEach((rule) => scheduleRule(rule));
  console.log(`[Scheduler] Started — ${rules.length} active notification rule(s) loaded`);
};

module.exports = { scheduleRule, stopRule, startScheduler };
