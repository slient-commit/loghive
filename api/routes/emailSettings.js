const express = require('express');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { OrgEmailSettings } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'org_admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const getOrCreate = async (orgId) => {
  let s = await OrgEmailSettings.findOne({ where: { organization_id: orgId } });
  if (!s) s = await OrgEmailSettings.create({ organization_id: orgId });
  return s;
};

// ── GET current settings ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const s = await getOrCreate(req.user.organization_id);
    const data = s.toJSON();
    // Mask sensitive values — send boolean flags so the UI knows they're set
    data.resend_api_key_set = Boolean(data.resend_api_key);
    data.smtp_pass_set      = Boolean(data.smtp_pass);
    delete data.resend_api_key;
    delete data.smtp_pass;
    res.json(data);
  } catch (err) {
    console.error('[EmailSettings]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT update settings ───────────────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  try {
    const s = await getOrCreate(req.user.organization_id);

    const allowed = [
      'provider',
      'resend_api_key', 'resend_from_email',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
    ];

    allowed.forEach((k) => {
      // Don't overwrite secrets with empty string (UI sends '' when unchanged)
      const isSecret = k === 'resend_api_key' || k === 'smtp_pass';
      if (req.body[k] !== undefined && (!isSecret || req.body[k] !== '')) {
        s[k] = req.body[k];
      }
    });

    await s.save();
    res.json({ message: 'Email settings saved' });
  } catch (err) {
    console.error('[EmailSettings]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST send test email to current user ──────────────────────────────────────
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const s = await getOrCreate(req.user.organization_id);
    const to = req.user.email;

    if (s.provider === 'smtp' && s.smtp_host) {
      const transporter = nodemailer.createTransport({
        host: s.smtp_host,
        port: s.smtp_port || 587,
        secure: (s.smtp_port || 587) === 465,
        auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
      });
      await transporter.sendMail({
        from: s.smtp_from || s.smtp_user,
        to,
        subject: 'LogHive — Test Email',
        html: '<p>Your SMTP configuration is working correctly. ✓</p>',
      });
    } else {
      const apiKey = s.resend_api_key || process.env.RESEND_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'No Resend API key configured' });
      const fromEmail = s.resend_from_email || process.env.RESEND_FROM_EMAIL || 'alerts@loghive.dev';
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: `LogHive <${fromEmail}>`,
        to,
        subject: 'LogHive — Test Email',
        html: '<p>Your Resend configuration is working correctly. ✓</p>',
      });
    }

    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    console.error('[EmailSettings]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
