const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const crypto = require('crypto');

const AppApiKey = sequelize.define('AppApiKey', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  app_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  key_prefix: {
    type: DataTypes.STRING(8),
    allowNull: false,
  },
  key_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_used_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'app_api_keys',
  timestamps: true,
  underscored: true,
});

AppApiKey.generateKey = () => {
  const key = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 8);
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
};

AppApiKey.hashKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

module.exports = AppApiKey;
