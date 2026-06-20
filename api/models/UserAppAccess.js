const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

const UserAppAccess = sequelize.define('UserAppAccess', {
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
  },
  app_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
  },
  access_level: {
    type: DataTypes.ENUM('read', 'write', 'admin'),
    defaultValue: 'read',
  },
}, {
  tableName: 'user_app_access',
  timestamps: true,
  underscored: true,
});

module.exports = UserAppAccess;
