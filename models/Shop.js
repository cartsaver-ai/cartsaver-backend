const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  accessToken: {
    type: String,
    required: true
  },
  scope: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  settings: {
    cartSavingEnabled: {
      type: Boolean,
      default: true
    },
    notificationEnabled: {
      type: Boolean,
      default: true
    },
    autoRecoveryEnabled: {
      type: Boolean,
      default: false
    }
  },
  installedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
shopSchema.index({ shop: 1 });
shopSchema.index({ isActive: 1 });

module.exports = mongoose.model('Shop', shopSchema); 