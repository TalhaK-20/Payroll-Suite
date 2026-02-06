const mongoose = require('mongoose');

const PayrollDeductionSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true,
    index: true
  },
  monthlyHoursId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonthlyHours',
    index: true
  },
  year: {
    type: Number,
    required: true,
    min: 2020,
    max: 2100
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  payrollEntryNumber: {
    type: Number,
    required: true,
    default: 1
  },
  deductedHours: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  deductedMinutes: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 59
  },
  paymentAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  bankAccountId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  reference: {
    type: String,
    default: ''
  },
  notes: {
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
  },
  paidDate: {
    type: Date,
    default: null
  }
});

// Index for efficient queries
PayrollDeductionSchema.index({ guardId: 1, year: 1, month: 1 });
PayrollDeductionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PayrollDeduction', PayrollDeductionSchema);