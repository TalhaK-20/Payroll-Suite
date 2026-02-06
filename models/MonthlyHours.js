const mongoose = require('mongoose');

const MonthlyHoursSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true,
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
  totalHours: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  totalMinutes: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 59
  },
  paidHours: {
    type: Number,
    default: 0,
    min: 0
  },
  paidMinutes: {
    type: Number,
    default: 0,
    min: 0,
    max: 59
  },
  remainingHours: {
    type: Number,
    default: 0
  },
  remainingMinutes: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
MonthlyHoursSchema.index({ guardId: 1, year: 1, month: 1 }, { unique: true });

// Auto-calculate remaining hours
MonthlyHoursSchema.pre('save', function(next) {
  const totalMinutesAll = this.totalHours * 60 + this.totalMinutes;
  const paidMinutesAll = this.paidHours * 60 + this.paidMinutes;
  const remainingMinutesAll = totalMinutesAll - paidMinutesAll;
  
  this.remainingHours = Math.floor(remainingMinutesAll / 60);
  this.remainingMinutes = remainingMinutesAll % 60;
  
  if (this.remainingMinutes < 0) {
    this.remainingHours = 0;
    this.remainingMinutes = 0;
  }
  
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MonthlyHours', MonthlyHoursSchema);
