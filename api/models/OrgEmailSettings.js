const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

const OrgEmailSettings = sequelize.define('OrgEmailSettings', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },

  provider: { type: DataTypes.ENUM('resend', 'smtp'), defaultValue: 'resend' },

  // Resend — null means fall back to env vars
  resend_api_key:    { type: DataTypes.STRING(500) },
  resend_from_email: { type: DataTypes.STRING(255) },

  // Custom SMTP
  smtp_host: { type: DataTypes.STRING(255) },
  smtp_port: { type: DataTypes.INTEGER, defaultValue: 587 },
  smtp_user: { type: DataTypes.STRING(255) },
  smtp_pass: { type: DataTypes.STRING(500) },
  smtp_from: { type: DataTypes.STRING(255) },
}, {
  tableName: 'org_email_settings',
  timestamps: true,
  underscored: true,
});

module.exports = OrgEmailSettings;
