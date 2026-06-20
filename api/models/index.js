const Organization = require('./Organization');
const User = require('./User');
const App = require('./App');
const AppApiKey = require('./AppApiKey');
const UserAppAccess = require('./UserAppAccess');
const Log = require('./Log');
const NotificationRule = require('./NotificationRule');
const OrgEmailSettings = require('./OrgEmailSettings');

// Associations
Organization.hasMany(User, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
User.belongsTo(Organization, { foreignKey: 'organization_id' });

Organization.hasMany(App, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
App.belongsTo(Organization, { foreignKey: 'organization_id' });

App.hasMany(AppApiKey, { foreignKey: 'app_id', onDelete: 'CASCADE' });
AppApiKey.belongsTo(App, { foreignKey: 'app_id' });

User.belongsToMany(App, { through: UserAppAccess, foreignKey: 'user_id', otherKey: 'app_id' });
App.belongsToMany(User, { through: UserAppAccess, foreignKey: 'app_id', otherKey: 'user_id' });

Organization.hasMany(NotificationRule, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
NotificationRule.belongsTo(Organization, { foreignKey: 'organization_id' });

Organization.hasOne(OrgEmailSettings, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
OrgEmailSettings.belongsTo(Organization, { foreignKey: 'organization_id' });

module.exports = {
  Organization,
  User,
  App,
  AppApiKey,
  UserAppAccess,
  Log,
  NotificationRule,
  OrgEmailSettings,
};
