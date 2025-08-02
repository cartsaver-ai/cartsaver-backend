const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'app_installed',
      'carts_synced',
      'campaign_created',
      'campaign_sent',
      'cart_recovered',
      'webhooks_setup',
      'settings_updated',
      'founder_cloning_uploaded',
      'founder_cloning_processed'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['success', 'error', 'warning', 'info'],
    default: 'success'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient querying of recent activities
activitySchema.index({ shop: 1, createdAt: -1 });

// Virtual for time ago
activitySchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
});

// Ensure virtuals are serialized
activitySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Activity', activitySchema); 