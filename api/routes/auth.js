const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { User, Organization } = require('../models');
const { authenticate } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } = require('../services/email');
const { checkPreAuthLimit, checkIpLimit } = require('../services/emailRateLimit');

const router = express.Router();

// ── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

const preAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── Password strength validation ─────────────────────────────────────────────
const validatePassword = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
};

// Generates a URL-safe slug from a name, appending a short random suffix on collision
const generateSlug = async (name) => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  let slug = base;
  let attempt = 0;
  while (attempt < 10) {
    const exists = await Organization.findOne({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    attempt++;
  }
  return `${base}-${Date.now()}`;
};

// Register (creates org + admin user)
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, organization_name, first_name, last_name } = req.body;

    if (!organization_name) return res.status(400).json({ error: 'organization_name is required' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const slug = await generateSlug(organization_name);

    const organization = await Organization.create({
      name: organization_name,
      slug,
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const user = await User.create({
      email,
      password_hash: password,
      first_name: first_name || null,
      last_name: last_name || null,
      organization_id: organization.id,
      role: 'org_admin',
      receive_fatal_emails: true,
      email_verified: false,
      verification_token: verificationHash,
      verification_token_expires: new Date(Date.now() + 86400000), // 24 hours
    });

    // Send verification email (IP-gated, non-blocking)
    const ip = req.ip || req.connection?.remoteAddress;
    const ipOk = await checkIpLimit(ip);
    if (ipOk) sendVerificationEmail({ to: email, token: verificationToken, organizationName: organization.name });

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(400).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email, status: 'active' },
      include: [Organization],
    });

    if (!user || !user.password_hash || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in', code: 'EMAIL_NOT_VERIFIED' });
    }

    const token = jwt.sign(
      { id: user.id, organization_id: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      organization: { id: user.Organization.id, name: user.Organization.name },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [Organization],
    attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'invite_token', 'invite_token_expires'] },
  });
  res.json(user);
});

// Update user settings
router.put('/settings', authenticate, async (req, res) => {
  try {
    const { receive_fatal_emails } = req.body;
    const user = await User.findByPk(req.user.id);

    await user.update({ receive_fatal_emails });

    res.json({
      id: user.id,
      email: user.email,
      receive_fatal_emails: user.receive_fatal_emails,
    });
  } catch (error) {
    console.error('[Auth] Settings update error:', error.message);
    res.status(400).json({ error: 'Failed to update settings' });
  }
});

// Forgot password — sends reset email
router.post('/forgot-password', preAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email, status: 'active' } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    await user.update({
      reset_token: hash,
      reset_token_expires: new Date(Date.now() + 3600000), // 1 hour
    });

    const canSend = await checkPreAuthLimit(email);
    const ipOk = await checkIpLimit(req.ip || req.connection?.remoteAddress);
    if (canSend && ipOk) sendPasswordResetEmail({ to: email, token });

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password — validates token and sets new password
router.post('/reset-password', preAuthLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: { reset_token: hash },
    });

    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await user.update({
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expires: null,
    });

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    console.error('[Auth] Reset password error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept invitation — validates invite token and sets password
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password } = req.body;

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: { invite_token: hash, status: 'invited' },
      include: [Organization],
    });

    if (!user || !user.invite_token_expires || new Date(user.invite_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await user.update({
      password_hash: passwordHash,
      invite_token: null,
      invite_token_expires: null,
      status: 'active',
    });

    const jwtToken = jwt.sign(
      { id: user.id, organization_id: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, role: user.role },
      organization: { id: user.Organization.id, name: user.Organization.name },
    });
  } catch (error) {
    console.error('[Auth] Accept invite error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: { verification_token: hash },
      include: [Organization],
    });

    if (!user || !user.verification_token_expires || new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    await user.update({
      email_verified: true,
      verification_token: null,
      verification_token_expires: null,
    });

    // Send welcome email now that they're verified
    sendWelcomeEmail({ to: user.email, organizationName: user.Organization.name });

    const jwtToken = jwt.sign(
      { id: user.id, organization_id: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Email verified successfully',
      token: jwtToken,
      user: { id: user.id, email: user.email, role: user.role },
      organization: { id: user.Organization.id, name: user.Organization.name },
    });
  } catch (error) {
    console.error('[Auth] Verify email error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email
router.post('/resend-verification', preAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      where: { email, email_verified: false },
      include: [Organization],
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists and is unverified, a new link has been sent' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    await user.update({
      verification_token: verificationHash,
      verification_token_expires: new Date(Date.now() + 86400000), // 24 hours
    });

    const canSend = await checkPreAuthLimit(email);
    const ipOk = await checkIpLimit(req.ip || req.connection?.remoteAddress);
    if (canSend && ipOk) sendVerificationEmail({ to: email, token: verificationToken, organizationName: user.Organization.name });

    res.json({ message: 'If that email exists and is unverified, a new link has been sent' });
  } catch (error) {
    console.error('[Auth] Resend verification error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
