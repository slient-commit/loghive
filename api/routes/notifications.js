const express = require('express');
const { NotificationRule, App, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const adminOrMember = authorize('org_admin', 'member');
const adminOnly     = authorize('org_admin');
const { scheduleRule, stopRule } = require('../services/notificationScheduler');
const { enqueueDigest } = require('../queues/notificationQueue');

const router = express.Router();
router.use(authenticate);

// ── Meta helpers (must be before /:uuid to avoid route conflict) ──────────────

router.get('/meta/apps', async (req, res) => {
  try {
    const apps = await App.findAll({
      where: { organization_id: req.user.organization_id },
      attributes: ['uuid', 'name', 'environment'],
      order: [['name', 'ASC']],
    });
    res.json(apps);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/meta/members', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { organization_id: req.user.organization_id },
      attributes: ['id', 'email', 'role'],
      order: [['email', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List all rules ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rules = await NotificationRule.findAll({
      where: { organization_id: req.user.organization_id },
      order: [['created_at', 'DESC']],
    });
    res.json(rules);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get single rule ───────────────────────────────────────────────────────────
router.get('/:uuid', async (req, res) => {
  try {
    const rule = await NotificationRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Not found' });
    res.json(rule);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Create rule ───────────────────────────────────────────────────────────────
router.post('/', adminOrMember, async (req, res) => {
  try {
    const {
      name, enabled = true,
      app_uuids = [], schedule_times, schedule_days = [],
      time_range_type = 'last_24h', time_range_hours = 24,
      email_config_type = 'system',
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
      recipient_type = 'org_users', recipients = [],
      log_levels = ['ERROR', 'FATAL'],
      group_by = 'none', group_meta_key,
      lines_per_email = 10, email_delay_seconds = 6,
      subject_template,
      email_template_type = 'default',
      email_template_custom,
      group_link_url,
      email_columns,
    } = req.body;

    if (!name)                   return res.status(400).json({ error: 'name is required' });
    if (!schedule_times?.length) return res.status(400).json({ error: 'schedule_times is required' });

    if (email_config_type === 'custom' && req.user.role !== 'org_admin')
      return res.status(403).json({ error: 'Only admins can configure custom SMTP' });
    if (recipient_type === 'custom' && req.user.role !== 'org_admin')
      return res.status(403).json({ error: 'Only admins can set custom recipients' });

    const rule = await NotificationRule.create({
      organization_id: req.user.organization_id,
      name, enabled,
      app_uuids, schedule_times, schedule_days,
      time_range_type, time_range_hours,
      email_config_type, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
      recipient_type, recipients,
      log_levels,
      group_by, group_meta_key,
      lines_per_email, email_delay_seconds,
      subject_template: subject_template || null,
      email_template_type,
      email_template_custom: email_template_custom || null,
      group_link_url: group_link_url || null,
      email_columns: email_columns || null,
    });

    if (rule.enabled) scheduleRule(rule);

    res.status(201).json(rule);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Update rule ───────────────────────────────────────────────────────────────
router.put('/:uuid', adminOrMember, async (req, res) => {
  try {
    const rule = await NotificationRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Not found' });

    if (req.body.email_config_type === 'custom' && req.user.role !== 'org_admin')
      return res.status(403).json({ error: 'Only admins can configure custom SMTP' });
    if (req.body.recipient_type === 'custom' && req.user.role !== 'org_admin')
      return res.status(403).json({ error: 'Only admins can set custom recipients' });

    const allowed = [
      'name', 'enabled', 'app_uuids', 'schedule_times', 'schedule_days',
      'time_range_type', 'time_range_hours',
      'email_config_type', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
      'recipient_type', 'recipients',
      'log_levels', 'group_by', 'group_meta_key',
      'lines_per_email', 'email_delay_seconds',
      'subject_template',
      'email_template_type', 'email_template_custom',
      'group_link_url',
      'email_columns',
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) rule[key] = req.body[key];
    });
    await rule.save();

    if (rule.enabled) scheduleRule(rule);
    else              stopRule(rule.id);

    res.json(rule);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Toggle enabled ────────────────────────────────────────────────────────────
router.patch('/:uuid/toggle', adminOrMember, async (req, res) => {
  try {
    const rule = await NotificationRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Not found' });

    rule.enabled = !rule.enabled;
    await rule.save();

    if (rule.enabled) scheduleRule(rule);
    else              stopRule(rule.id);

    res.json({ enabled: rule.enabled });
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Test: trigger immediately ─────────────────────────────────────────────────
router.post('/:uuid/test', adminOrMember, async (req, res) => {
  try {
    const rule = await NotificationRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Not found' });

    await enqueueDigest(rule.id, { isTest: true });
    res.json({ message: 'Test digest queued — email will arrive within seconds' });
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Delete rule ───────────────────────────────────────────────────────────────
router.delete('/:uuid', adminOnly, async (req, res) => {
  try {
    const rule = await NotificationRule.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!rule) return res.status(404).json({ error: 'Not found' });

    stopRule(rule.id);
    await rule.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
