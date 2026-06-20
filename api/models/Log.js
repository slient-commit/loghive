const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  organization_id: {
    type: Number,
    required: true,
  },
  app_uuid: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ingested_at: {
    type: Date,
    default: Date.now,
  },
}, {
  collection: 'logs',
  timestamps: false,
});

// Compound indexes for dashboard queries
logSchema.index({ organization_id: 1, app_uuid: 1, timestamp: -1 });
logSchema.index({ organization_id: 1, level: 1 });
logSchema.index({ organization_id: 1, tags: 1 });
logSchema.index({ message: 'text' });
logSchema.index({ fingerprint: 1 }, { sparse: true });

module.exports = mongoose.model('Log', logSchema);
