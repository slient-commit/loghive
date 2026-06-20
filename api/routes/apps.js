const express = require('express');
const { App, AppApiKey, UserAppAccess } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// List apps for current organization
router.get('/', async (req, res) => {
  try {
    const apps = await App.findAll({
      where: { organization_id: req.user.organization_id },
    });
    res.json(apps);
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create app
router.post('/', authorize('org_admin', 'member'), async (req, res) => {
  try {
    const { name, description, environment } = req.body;
    const app = await App.create({
      name,
      description,
      environment,
      organization_id: req.user.organization_id,
    });

    // Grant admin access to creator
    await UserAppAccess.create({
      user_id: req.user.id,
      app_id: app.id,
      access_level: 'admin',
    });

    res.status(201).json(app);
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Get app by uuid
router.get('/:uuid', async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json(app);
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update app
router.put('/:uuid', authorize('org_admin', 'member'), async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { name, description, environment, status } = req.body;
    await app.update({ name, description, environment, status });
    res.json(app);
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Generate API key for app
router.post('/:uuid/keys', authorize('org_admin', 'member'), async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { key, prefix, hash } = AppApiKey.generateKey();

    await AppApiKey.create({
      app_id: app.id,
      key_prefix: prefix,
      key_hash: hash,
      name: req.body.name || 'Default Key',
    });

    // Return the plain key only once
    res.status(201).json({
      key,
      prefix,
      name: req.body.name || 'Default Key',
      message: 'Save this key now. It will not be shown again.',
    });
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// List API keys for app (prefix only, no secrets)
router.get('/:uuid/keys', async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const keys = await AppApiKey.findAll({
      where: { app_id: app.id },
      attributes: ['id', 'key_prefix', 'name', 'is_active', 'last_used_at', 'created_at'],
    });
    res.json(keys);
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke API key
router.delete('/:uuid/keys/:keyId', authorize('org_admin', 'member'), async (req, res) => {
  try {
    const apiKey = await AppApiKey.findOne({
      where: { id: req.params.keyId },
      include: [{
        model: App,
        where: { uuid: req.params.uuid, organization_id: req.user.organization_id },
      }],
    });
    if (!apiKey) return res.status(404).json({ error: 'API key not found' });

    await apiKey.update({ is_active: false });
    res.json({ message: 'API key revoked' });
  } catch (error) {
    console.error('[Apps]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
