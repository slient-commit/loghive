const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'deleted'),
    defaultValue: 'active',
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  underscored: true,
});

module.exports = Organization;
