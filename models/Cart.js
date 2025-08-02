const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    lowercase: true
  },
  customerId: {
    type: String,
    required: false
  },
  customerEmail: {
    type: String,
    required: false
  },
  customerFirstName: String,
  customerLastName: String,
  cartToken: {
    type: String,
    required: true
  },
  items: [{
    productId: {
      type: String,
      required: true
    },
    variantId: {
      type: String,
      required: true
    },
    title: String,
    variantTitle: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    image: String,
    productUrl: String
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  abandonedAt: {
    type: Date,
    default: Date.now
  },
  recoveredAt: Date,
  recoveryAttempts: {
    type: Number,
    default: 0
  },
  lastRecoveryAttempt: Date,
  status: {
    type: String,
    enum: ['abandoned', 'recovered', 'expired'],
    default: 'abandoned'
  },
  recoveryUrl: String,
  notes: String
}, {
  timestamps: true
});

// Indexes for better performance
cartSchema.index({ shop: 1, status: 1 });
cartSchema.index({ customerEmail: 1 });
cartSchema.index({ abandonedAt: 1 });
cartSchema.index({ shop: 1, cartToken: 1 }, { unique: true });

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Ensure virtuals are serialized
cartSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema); 