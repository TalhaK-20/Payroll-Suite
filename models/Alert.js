const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true,
    index: true
  },
  alertType: {
    type: String,
    enum: ['unpaid_hours', 'expiring_share_code', 'visa_expiry', 'missing_hours', 'overpayment_risk'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  relatedData: {
    year: Number,
    month: Number,
    unpaidHours: Number,
    unpaidMinutes: Number,
    expiringDaysLeft: Number,
    shareCodeValue: String
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedNotes: {
    type: String,
    default: ''
  },
  actionUrl: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
AlertSchema.index({ guardId: 1, isRead: 1, isResolved: 1 });
AlertSchema.index({ alertType: 1, createdAt: -1 });
AlertSchema.index({ severity: 1, isResolved: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
