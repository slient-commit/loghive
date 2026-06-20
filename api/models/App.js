const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const { v4: uuidv4 } = require('uuid');

const App = sequelize.define('App', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  organization_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  uuid: {
    type: DataTypes.CHAR(36),
    unique: true,
    allowNull: false,
    defaultValue: () => uuidv4(),
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  environment: {
    type: DataTypes.STRING(50),
    defaultValue: 'production',
  },
  status: {
    type: DataTypes.ENUM('active', 'archived'),
    defaultValue: 'active',
  },
}, {
  tableName: 'apps',
  timestamps: true,
  underscored: true,
});

module.exports = App;
