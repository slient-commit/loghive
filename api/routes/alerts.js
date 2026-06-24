const express = require('express');
const { AlertRule } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleAlert, stopAlert } = require('../services/alertScheduler');
const { runAlertCheck } = require('../services/alertChecker');

const router = express.Router();
router.use(authenticate);

const adminOrMember = authorize('org_admin', 'member');
const adminOnly = authorize('org_admin');

// Meta: apps for current org
router.get('/meta/apps', async (req, res) => {
  try {
    const { App } = require('../models');
    const apps = await App.findAll({
      where: { organization_id: req.user.organization_id, status: 'active' },
      attributes: ['uuid', 'name', 'environment'],
      order: [['name', 'ASC']],
    });
    res.json(apps);
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all alert rules
router.get('/', adminOrMember, async (req, res) => {
  try {
    const rules = await AlertRule.findAll({
      where: { organization_id: req.user.organization_id },
      order: [['created_at', 'DESC']],
    });
    res.json(rules);
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create alert rule
router.post('/', adminOrMember, async (req, res) => {
  try {
    const {
      name, alert_type, enabled = true,
      app_uuids = [], schedule_times, schedule_days = [],
      spike_window_minutes, spike_threshold, spike_levels,
      volume_percentage, volume_baseline_days,
      silence_hours,
      cooldown_hours = 24,
      recipient_type = 'org_users', recipients = [],
      email_config_type = 'system',
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
    } = req.body;

    if (!name || !alert_type || !schedule_times?.length) {
      return res.status(400).json({ error: 'name, alert_type, and schedule_times are required' });
    }

    // Custom SMTP and recipients require org_admin
    if (email_config_type === 'custom' && req.user.role !== 'org_admin') {
      return res.status(403).json({ error: 'Custom SMTP requires admin role' });
    }
    if (recipient_type === 'custom' && req.user.role !== 'org_admin') {
      return res.status(403).json({ error: 'Custom recipients require admin role' });
    }

    const rule = await AlertRule.create({
      organization_id: req.user.organization_id,
      name, alert_type, enabled,
      app_uuids, schedule_times, schedule_days,
      spike_window_minutes, spike_threshold, spike_levels,
      volume_percentage, volume_baseline_days,
      silence_hours,
      cooldown_hours,
      recipient_type, recipients,
      email_config_type,
      smtp_host, smtp_port, smtp_user, smtp_pass,
      smtp_from: smtp_from || null,
    });

    scheduleAlert(rule);
    res.status(201).json(rule);
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update alert rule
router.put('/:uuid', adminOrMember, async (req, res) => {
  try {
    const rule = await AlertRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Alert rule not found' });

    const allowed = [
      'name', 'alert_type', 'enabled',
      'app_uuids', 'schedule_times', 'schedule_days',
      'spike_window_minutes', 'spike_threshold', 'spike_levels',
      'volume_percentage', 'volume_baseline_days',
      'silence_hours',
      'cooldown_hours',
      'recipient_type', 'recipients',
      'email_config_type',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
    ];

    if (req.body.email_config_type === 'custom' && req.user.role !== 'org_admin') {
      return res.status(403).json({ error: 'Custom SMTP requires admin role' });
    }
    if (req.body.recipient_type === 'custom' && req.user.role !== 'org_admin') {
      return res.status(403).json({ error: 'Custom recipients require admin role' });
    }

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) rule[k] = req.body[k];
    });
    await rule.save();

    scheduleAlert(rule);
    res.json(rule);
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle enabled
router.patch('/:uuid/toggle', adminOrMember, async (req, res) => {
  try {
    const rule = await AlertRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Alert rule not found' });

    rule.enabled = !rule.enabled;
    await rule.save();

    if (rule.enabled) scheduleAlert(rule); else stopAlert(rule.id);
    res.json({ enabled: rule.enabled });
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test — run check immediately
router.post('/:uuid/test', adminOrMember, async (req, res) => {
  try {
    const rule = await AlertRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Alert rule not found' });

    await runAlertCheck(rule.id, { isTest: true });
    res.json({ message: 'Alert check executed. If the condition is met, an email was sent.' });
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete
router.delete('/:uuid', adminOnly, async (req, res) => {
  try {
    const rule = await AlertRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Alert rule not found' });

    stopAlert(rule.id);
    await rule.destroy();
    res.json({ message: 'Alert rule deleted' });
  } catch (err) {
    console.error('[Alerts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
