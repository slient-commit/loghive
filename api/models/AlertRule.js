const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

const AlertRule = sequelize.define('AlertRule', {
  uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, unique: true },
  organization_id: { type: DataTypes.INTEGER, allowNull: false },

  name: { type: DataTypes.STRING, allowNull: false },
  alert_type: { type: DataTypes.ENUM('error_spike', 'low_volume', 'no_logs'), allowNull: false },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Which apps to monitor (empty = all)
  app_uuids: { type: DataTypes.JSON, defaultValue: [] },

  // Schedule: when to run checks
  schedule_times: { type: DataTypes.JSON, allowNull: false },   // ["09:00", "18:00"]
  schedule_days:  { type: DataTypes.JSON, defaultValue: [] },    // 0-6, empty = every day

  // ── error_spike config ─────────────────────────────────
  spike_window_minutes: { type: DataTypes.INTEGER, defaultValue: 60 },
  spike_threshold:      { type: DataTypes.INTEGER, defaultValue: 50 },
  spike_levels:         { type: DataTypes.JSON, defaultValue: ['ERROR', 'FATAL'] },

  // ── low_volume config ──────────────────────────────────
  volume_percentage:    { type: DataTypes.INTEGER, defaultValue: 10 },
  volume_baseline_days: { type: DataTypes.INTEGER, defaultValue: 7 },

  // ── no_logs config ─────────────────────────────────────
  silence_hours: { type: DataTypes.INTEGER, defaultValue: 2 },

  // ── Cooldown (don't re-alert within N hours) ───────────
  cooldown_hours:    { type: DataTypes.INTEGER, defaultValue: 24 },
  last_triggered_at: { type: DataTypes.DATE, allowNull: true },

  // ── Recipients ─────────────────────────────────────────
  recipient_type: { type: DataTypes.ENUM('org_users', 'custom'), defaultValue: 'org_users' },
  recipients:     { type: DataTypes.JSON, defaultValue: [] },

  // ── Email config ───────────────────────────────────────
  email_config_type: { type: DataTypes.ENUM('system', 'custom'), defaultValue: 'system' },
  smtp_host: { type: DataTypes.STRING, allowNull: true },
  smtp_port: { type: DataTypes.INTEGER, allowNull: true },
  smtp_user: { type: DataTypes.STRING, allowNull: true },
  smtp_pass: { type: DataTypes.STRING, allowNull: true },
  smtp_from: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'alert_rules',
  underscored: true,
});

module.exports = AlertRule;
