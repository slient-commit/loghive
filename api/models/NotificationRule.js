const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const { v4: uuidv4 } = require('uuid');

const NotificationRule = sequelize.define('NotificationRule', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.CHAR(36), unique: true, allowNull: false, defaultValue: () => uuidv4() },
  organization_id: { type: DataTypes.BIGINT, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Which apps to watch (empty JSON array = all apps in org)
  app_uuids: { type: DataTypes.JSON, defaultValue: [] },

  // Scheduling: array of "HH:MM" strings in UTC e.g. ["09:00", "18:00"]
  schedule_times: { type: DataTypes.JSON, allowNull: false },

  // Days of week to run: array of 0-6 (0=Sun … 6=Sat). Empty/null = every day.
  schedule_days: { type: DataTypes.JSON, defaultValue: [] },

  // Time range for log query
  time_range_type: { type: DataTypes.ENUM('last_24h', 'interval'), defaultValue: 'last_24h' },
  time_range_hours: { type: DataTypes.FLOAT, defaultValue: 24 }, // used when type = 'interval'

  // Email delivery
  // 'system' = use org email settings, 'custom' = use rule-specific smtp below
  email_config_type: { type: DataTypes.ENUM('system', 'custom'), defaultValue: 'system' },
  smtp_host: { type: DataTypes.STRING(255) },
  smtp_port: { type: DataTypes.INTEGER, defaultValue: 587 },
  smtp_user: { type: DataTypes.STRING(255) },
  smtp_pass: { type: DataTypes.STRING(255) },
  smtp_from: { type: DataTypes.STRING(255) },

  // Recipients
  recipient_type: { type: DataTypes.ENUM('org_users', 'custom'), defaultValue: 'org_users' },
  recipients: { type: DataTypes.JSON, defaultValue: [] }, // used when recipient_type = 'custom'

  // Log filters
  log_levels: { type: DataTypes.JSON, defaultValue: ['ERROR', 'FATAL'] },

  // Grouping
  group_by: { type: DataTypes.ENUM('none', 'level', 'tag', 'metadata'), defaultValue: 'none' },
  group_meta_key: { type: DataTypes.STRING(255) }, // used when group_by = 'metadata'

  // Batching
  lines_per_email: { type: DataTypes.INTEGER, defaultValue: 10 },
  email_delay_seconds: { type: DataTypes.INTEGER, defaultValue: 6 },

  // Custom email subject (supports variables: {rule_name} {date} {time} {app_names} {log_count} {levels} {range})
  subject_template: { type: DataTypes.STRING(500), allowNull: true },

  // Email body template
  email_template_type: { type: DataTypes.ENUM('default', 'teams', 'custom'), defaultValue: 'default' },
  email_template_custom: { type: DataTypes.TEXT, allowNull: true }, // used when type = 'custom'

  // Group link URL — supports {grouping_value} variable (only used when group_by !== 'none')
  group_link_url: { type: DataTypes.STRING(1000), allowNull: true },

  // Email column config: { grouped: { col_key: { show?, label? }, ... }, flat: { ... } }
  email_columns: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'notification_rules',
  timestamps: true,
  underscored: true,
});

module.exports = NotificationRule;
