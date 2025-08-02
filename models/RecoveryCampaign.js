const mongoose = require('mongoose');

const recoveryCampaignSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  template: {
    type: String,
    required: true
  },
  delayHours: {
    type: Number,
    default: 24
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  settings: {
    includeDiscount: {
      type: Boolean,
      default: false
    },
    discountCode: String,
    discountPercentage: Number,
    personalizationEnabled: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    sent: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    },
    recovered: {
      type: Number,
      default: 0
    }
  },
  createdBy: String,
  lastSent: Date
}, {
  timestamps: true
});

// Indexes
recoveryCampaignSchema.index({ shop: 1, isActive: 1 });

module.exports = mongoose.model('RecoveryCampaign', recoveryCampaignSchema); 