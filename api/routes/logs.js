const express = require('express');
const { Log, App, UserAppAccess } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Escape regex special chars to prevent ReDoS / injection
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sanitize metadata key — only allow alphanumeric, underscores, dots
const sanitizeMetaKey = (key) => /^[a-zA-Z0-9_.]+$/.test(key) ? key : null;

router.use(authenticate);

// Query logs (dashboard)
router.get('/:appUuid', async (req, res) => {
  try {
    // Verify app belongs to user's organization
    const app = await App.findOne({
      where: { uuid: req.params.appUuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    // Check user access
    const access = await UserAppAccess.findOne({
      where: { user_id: req.user.id, app_id: app.id },
    });

    // org_admin can access all apps, others need explicit access
    if (req.user.role !== 'org_admin' && !access) {
      return res.status(403).json({ error: 'No access to this app' });
    }

    // Build query
    const query = {
      organization_id: req.user.organization_id,
      app_uuid: app.uuid,
    };

    // Filters
    if (req.query.level) query.level = req.query.level;
    if (req.query.tag) query.tags = req.query.tag;
    if (req.query.from || req.query.to) {
      query.timestamp = {};
      if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
    }
    if (req.query.search) {
      query.message = { $regex: escapeRegex(req.query.search), $options: 'i' };
    }
    if (req.query.metaKey && req.query.metaValue) {
      const safeKey = sanitizeMetaKey(req.query.metaKey);
      if (safeKey) query[`metadata.${safeKey}`] = req.query.metaValue;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 200));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Log.countDocuments(query),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Logs]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get log stats/aggregation
router.get('/:appUuid/stats', async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.appUuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const timeRange = {};
    if (req.query.from) timeRange.$gte = new Date(req.query.from);
    if (req.query.to) timeRange.$lte = new Date(req.query.to);

    const matchStage = {
      organization_id: req.user.organization_id,
      app_uuid: app.uuid,
    };
    if (Object.keys(timeRange).length) matchStage.timestamp = timeRange;

    const stats = await Log.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          latest: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error('[Logs]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct tags for an app
router.get('/:appUuid/tags', async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.appUuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const tags = await Log.distinct('tags', {
      organization_id: req.user.organization_id,
      app_uuid: app.uuid,
    });

    res.json(tags.filter(Boolean).sort());
  } catch (error) {
    console.error('[Logs]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Group logs by a field (level, tag, or metadata key)
router.get('/:appUuid/group', async (req, res) => {
  try {
    const app = await App.findOne({
      where: { uuid: req.params.appUuid, organization_id: req.user.organization_id },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { by, metaKey } = req.query;
    const matchStage = {
      organization_id: req.user.organization_id,
      app_uuid: app.uuid,
    };

    if (req.query.from || req.query.to) {
      matchStage.timestamp = {};
      if (req.query.from) matchStage.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) matchStage.timestamp.$lte = new Date(req.query.to);
    }
    if (req.query.level) matchStage.level = req.query.level;
    if (req.query.tag) matchStage.tags = req.query.tag;
    if (req.query.search) matchStage.message = { $regex: escapeRegex(req.query.search), $options: 'i' };

    let groupField;
    if (by === 'level') {
      groupField = '$level';
    } else if (by === 'tag') {
      groupField = '$tags';
    } else if (by === 'metadata' && metaKey) {
      const safeMetaKey = sanitizeMetaKey(metaKey);
      if (!safeMetaKey) return res.status(400).json({ error: 'Invalid metadata key' });
      groupField = `$metadata.${safeMetaKey}`;
    } else {
      return res.status(400).json({ error: 'Invalid group by. Use: level, tag, or metadata with metaKey' });
    }

    const pipeline = [
      { $match: matchStage },
    ];

    // Unwind tags array if grouping by tag
    if (by === 'tag') {
      pipeline.push({ $unwind: '$tags' });
    }

    pipeline.push(
      {
        $group: {
          _id: groupField,
          count: { $sum: 1 },
          latest: { $max: '$timestamp' },
          sample: { $first: '$message' },
        },
      },
    );

    // Filter grouped results by key value (case-insensitive substring match)
    if (req.query.groupSearch) {
      pipeline.push({ $match: { _id: { $regex: escapeRegex(req.query.groupSearch), $options: 'i' } } });
    }

    pipeline.push(
      { $sort: { count: -1 } },
      { $limit: 100 },
    );

    const groups = await Log.aggregate(pipeline);

    res.json(groups.map((g) => ({
      key: g._id,
      count: g.count,
      latest: g.latest,
      sample: g.sample,
    })));
  } catch (error) {
    console.error('[Logs]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
