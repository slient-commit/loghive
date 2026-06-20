const express = require('express');
const crypto = require('crypto');
const { Organization, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { sendInvitationEmail } = require('../services/email');

const router = express.Router();

router.use(authenticate);

// Get current organization
router.get('/', async (req, res) => {
  try {
    const org = await Organization.findByPk(req.user.organization_id);
    res.json(org);
  } catch (error) {
    console.error('[Org]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update organization
router.put('/', authorize('org_admin'), async (req, res) => {
  try {
    const org = await Organization.findByPk(req.user.organization_id);
    const { name, slug } = req.body;
    await org.update({ name, slug });
    res.json(org);
  } catch (error) {
    console.error('[Org]', error.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// List organization members
router.get('/members', async (req, res) => {
  try {
    const members = await User.findAll({
      where: { organization_id: req.user.organization_id },
      attributes: { exclude: ['password_hash'] },
    });
    res.json(members);
  } catch (error) {
    console.error('[Org]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite member
router.post('/members', authorize('org_admin'), async (req, res) => {
  try {
    const { email, role } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.create({
      email,
      organization_id: req.user.organization_id,
      role: role || 'viewer',
      status: 'invited',
      invite_token: hash,
      invite_token_expires: new Date(Date.now() + 48 * 3600000), // 48 hours
    });

    // Get org name for email
    const org = await Organization.findByPk(req.user.organization_id);

    // Send invitation email (non-blocking)
    sendInvitationEmail({
      to: email,
      organizationName: org.name,
      inviterEmail: req.user.email,
      token,
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error('[Org]', error.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

module.exports = router;
