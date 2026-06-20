const { AppApiKey, App } = require('../models');

const validateApiKey = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'API key required' });
    }

    const key = header.split(' ')[1];
    const keyHash = AppApiKey.hashKey(key);

    const apiKey = await AppApiKey.findOne({
      where: { key_hash: keyHash, is_active: true },
      include: [{ model: App, where: { status: 'active' } }],
    });

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Update last_used_at
    apiKey.last_used_at = new Date();
    await apiKey.save();

    req.app_id = apiKey.App.id;
    req.app_uuid = apiKey.App.uuid;
    req.organization_id = apiKey.App.organization_id;

    next();
  } catch (error) {
    return res.status(500).json({ error: 'API key validation failed' });
  }
};

module.exports = { validateApiKey };
