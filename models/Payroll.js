const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  guardName: {
    type: String,
    required: true,
    trim: true
  },
  totalHours: {
    type: Number,
    required: true,
    min: 0
  },
  payRate: {
    type: Number,
    required: true,
    min: 0
  },
  chargeRate: {
    type: Number,
    required: true,
    min: 0
  },
  pay1: {
    type: Number,
    required: true,
    min: 0
  },
  pay2: {
    type: Number,
    required: true,
    min: 0
  },
  pay3: {
    type: Number,
    required: true,
    min: 0
  },
  accountNo: {
    type: String,
    required: true,
    trim: true
  },
  sortCode: {
    type: String,
    required: true,
    trim: true
  },
  accountHolderName: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for better query performance
payrollSchema.index({ clientName: 1 });
payrollSchema.index({ guardName: 1 });
payrollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);