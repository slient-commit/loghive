const express = require('express');
const { App, User, Log } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Overview stats for the organization
router.get('/overview', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const [appCount, memberCount, apps] = await Promise.all([
      App.count({ where: { organization_id: orgId } }),
      User.count({ where: { organization_id: orgId } }),
      App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] }),
    ]);

    const appUuids = apps.map((a) => a.uuid);

    const [totalLogs, levelBreakdown, recentActivity] = await Promise.all([
      Log.countDocuments({ organization_id: orgId, app_uuid: { $in: appUuids } }),
      Log.aggregate([
        { $match: { organization_id: orgId, app_uuid: { $in: appUuids } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Log.aggregate([
        { $match: { organization_id: orgId, app_uuid: { $in: appUuids } } },
        { $group: { _id: '$app_uuid', count: { $sum: 1 }, latest: { $max: '$timestamp' } } },
        { $sort: { latest: -1 } },
      ]),
    ]);

    const activityMap = {};
    recentActivity.forEach((a) => {
      activityMap[a._id] = { logCount: a.count, lastActivity: a.latest };
    });

    const appActivity = apps.map((a) => ({
      uuid: a.uuid,
      name: a.name,
      logCount: activityMap[a.uuid]?.logCount || 0,
      lastActivity: activityMap[a.uuid]?.lastActivity || null,
    }));

    const getCount = (level) => {
      const entry = levelBreakdown.find((l) => l._id === level);
      return entry ? entry.count : 0;
    };

    res.json({
      apps: appCount,
      members: memberCount,
      totalLogs,
      errors: getCount('ERROR') + getCount('FATAL'),
      warnings: getCount('WARN'),
      levelBreakdown,
      appActivity,
    });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logs over time — hourly for last 24h or daily for last 30d
// GET /api/dashboard/logs-over-time?period=24h|7d|30d
router.get('/logs-over-time', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const period = req.query.period || '7d';

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid'] });
    const appUuids = apps.map((a) => a.uuid);

    let dateFrom, groupFormat, labelFormat;
    const now = new Date();

    if (period === '24h') {
      dateFrom = new Date(now - 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%dT%H:00';
      labelFormat = 'hour';
    } else if (period === '30d') {
      dateFrom = new Date(now - 30 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d';
      labelFormat = 'day';
    } else {
      // 7d default
      dateFrom = new Date(now - 7 * 24 * 60 * 60 * 1000);
      groupFormat = '%Y-%m-%d';
      labelFormat = 'day';
    }

    const result = await Log.aggregate([
      {
        $match: {
          organization_id: orgId,
          app_uuid: { $in: appUuids },
          timestamp: { $gte: dateFrom },
        },
      },
      {
        $group: {
          _id: {
            bucket: { $dateToString: { format: groupFormat, date: '$timestamp' } },
            level: '$level',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.bucket': 1 } },
    ]);

    // Restructure: { bucket, total, ERROR, FATAL, WARN, INFO, DEBUG }
    const bucketMap = {};
    result.forEach(({ _id, count }) => {
      const { bucket, level } = _id;
      if (!bucketMap[bucket]) bucketMap[bucket] = { bucket, total: 0 };
      bucketMap[bucket][level] = (bucketMap[bucket][level] || 0) + count;
      bucketMap[bucket].total += count;
    });

    res.json({ period, labelFormat, data: Object.values(bucketMap).sort((a, b) => a.bucket.localeCompare(b.bucket)) });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// App health status — error ratio per app
router.get('/app-health', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] });
    const appUuids = apps.map((a) => a.uuid);

    const breakdown = await Log.aggregate([
      { $match: { organization_id: orgId, app_uuid: { $in: appUuids } } },
      { $group: { _id: { app_uuid: '$app_uuid', level: '$level' }, count: { $sum: 1 } } },
    ]);

    // Build per-app stats
    const appMap = {};
    apps.forEach((a) => {
      appMap[a.uuid] = { uuid: a.uuid, name: a.name, total: 0, errors: 0 };
    });

    breakdown.forEach(({ _id, count }) => {
      const app = appMap[_id.app_uuid];
      if (!app) return;
      app.total += count;
      if (_id.level === 'ERROR' || _id.level === 'FATAL') app.errors += count;
    });

    const health = Object.values(appMap).map((app) => {
      const ratio = app.total > 0 ? app.errors / app.total : 0;
      let status = 'healthy';
      if (ratio > 0.25) status = 'critical';
      else if (ratio > 0.05) status = 'degraded';
      return { ...app, errorRatio: Math.round(ratio * 100), status };
    });

    res.json(health);
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Top errors — most frequent ERROR/FATAL messages
router.get('/top-errors', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const limit = parseInt(req.query.limit) || 5;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] });
    const appUuids = apps.map((a) => a.uuid);
    const appNameMap = Object.fromEntries(apps.map((a) => [a.uuid, a.name]));

    const result = await Log.aggregate([
      {
        $match: {
          organization_id: orgId,
          app_uuid: { $in: appUuids },
          level: { $in: ['ERROR', 'FATAL'] },
        },
      },
      {
        $group: {
          _id: { message: '$message', app_uuid: '$app_uuid', level: '$level' },
          count: { $sum: 1 },
          last_seen: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    res.json(result.map((r) => ({
      message: r._id.message,
      app_uuid: r._id.app_uuid,
      app_name: appNameMap[r._id.app_uuid] || r._id.app_uuid,
      level: r._id.level,
      count: r.count,
      last_seen: r.last_seen,
    })));
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error spike detection — compare last hour to daily average
router.get('/error-spike', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid'] });
    const appUuids = apps.map((a) => a.uuid);

    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [lastHour, lastWeek] = await Promise.all([
      Log.countDocuments({
        organization_id: orgId,
        app_uuid: { $in: appUuids },
        level: { $in: ['ERROR', 'FATAL'] },
        timestamp: { $gte: oneHourAgo },
      }),
      Log.aggregate([
        {
          $match: {
            organization_id: orgId,
            app_uuid: { $in: appUuids },
            level: { $in: ['ERROR', 'FATAL'] },
            timestamp: { $gte: sevenDaysAgo, $lt: oneHourAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const avgHourly = lastWeek.length > 0
      ? lastWeek.reduce((s, b) => s + b.count, 0) / lastWeek.length
      : 0;

    const spikeRatio = avgHourly > 0 ? lastHour / avgHourly : lastHour > 0 ? Infinity : 0;
    const isSpike = spikeRatio > 2 && lastHour > 5; // 2x average and at least 5 errors

    res.json({
      lastHour,
      avgHourly: Math.round(avgHourly * 10) / 10,
      spikeRatio: Math.round(spikeRatio * 10) / 10,
      isSpike,
    });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Peak hours heatmap — log volume by hour-of-day × day-of-week
router.get('/heatmap', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid'] });
    const appUuids = apps.map((a) => a.uuid);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Log.aggregate([
      {
        $match: {
          organization_id: orgId,
          app_uuid: { $in: appUuids },
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            dow: { $dayOfWeek: '$timestamp' }, // 1=Sun, 7=Sat
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Normalize to 0-6 (Mon-Sun) for display
    const cells = result.map((r) => ({
      hour: r._id.hour,
      dow: r._id.dow === 1 ? 6 : r._id.dow - 2, // convert Sun=1 → 6, Mon=2 → 0
      count: r.count,
    }));

    const maxCount = Math.max(...cells.map((c) => c.count), 1);
    res.json({ cells, maxCount });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recent fatal logs
router.get('/recent-fatals', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const limit = parseInt(req.query.limit) || 5;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] });
    const appUuids = apps.map((a) => a.uuid);
    const appNameMap = Object.fromEntries(apps.map((a) => [a.uuid, a.name]));

    const logs = await Log.find({
      organization_id: orgId,
      app_uuid: { $in: appUuids },
      level: 'FATAL',
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(logs.map((l) => ({
      id: l._id,
      message: l.message,
      app_uuid: l.app_uuid,
      app_name: appNameMap[l.app_uuid] || l.app_uuid,
      timestamp: l.timestamp,
    })));
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Today vs yesterday comparison
router.get('/today-vs-yesterday', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid'] });
    const appUuids = apps.map((a) => a.uuid);

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart);

    const [todayStats, yesterdayStats] = await Promise.all([
      Log.aggregate([
        { $match: { organization_id: orgId, app_uuid: { $in: appUuids }, timestamp: { $gte: todayStart } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
      Log.aggregate([
        { $match: { organization_id: orgId, app_uuid: { $in: appUuids }, timestamp: { $gte: yesterdayStart, $lt: yesterdayEnd } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
    ]);

    const summarize = (stats) => {
      const map = Object.fromEntries(stats.map((s) => [s._id, s.count]));
      return {
        total: stats.reduce((s, r) => s + r.count, 0),
        errors: (map['ERROR'] || 0) + (map['FATAL'] || 0),
        warnings: map['WARN'] || 0,
        info: map['INFO'] || 0,
      };
    };

    res.json({ today: summarize(todayStats), yesterday: summarize(yesterdayStats) });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Per-app error breakdown — stacked bar data
router.get('/app-breakdown', async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const apps = await App.findAll({ where: { organization_id: orgId }, attributes: ['uuid', 'name'] });
    const appUuids = apps.map((a) => a.uuid);

    const result = await Log.aggregate([
      { $match: { organization_id: orgId, app_uuid: { $in: appUuids } } },
      { $group: { _id: { app_uuid: '$app_uuid', level: '$level' }, count: { $sum: 1 } } },
    ]);

    const appMap = Object.fromEntries(apps.map((a) => [a.uuid, { name: a.name, uuid: a.uuid }]));

    const dataMap = {};
    result.forEach(({ _id, count }) => {
      const key = _id.app_uuid;
      if (!dataMap[key]) dataMap[key] = { name: appMap[key]?.name || key, uuid: key, total: 0 };
      dataMap[key][_id.level] = count;
      dataMap[key].total += count;
    });

    const data = Object.values(dataMap).sort((a, b) => b.total - a.total);
    res.json(data);
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
