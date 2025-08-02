const mongoose = require('mongoose');

const founderCloningSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    unique: true
  },
  videoUrl: {
    type: String,
    required: false
  },
  videoFileName: {
    type: String,
    required: false
  },
  videoSize: {
    type: Number,
    required: false
  },
  videoDuration: {
    type: Number,
    required: false
  },
  voiceStatus: {
    type: String,
    enum: ['not_started', 'processing', 'completed', 'failed'],
    default: 'not_started'
  },
  faceStatus: {
    type: String,
    enum: ['not_started', 'processing', 'completed', 'failed'],
    default: 'not_started'
  },
  voiceModelUrl: {
    type: String,
    required: false
  },
  faceModelUrl: {
    type: String,
    required: false
  },
  processingStartedAt: {
    type: Date,
    required: false
  },
  processingCompletedAt: {
    type: Date,
    required: false
  },
  errorMessage: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
founderCloningSchema.index({ shopId: 1 });
founderCloningSchema.index({ voiceStatus: 1, faceStatus: 1 });

module.exports = mongoose.model('FounderCloning', founderCloningSchema); 