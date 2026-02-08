const mongoose = require('mongoose');

const DailyHoursSchema = new mongoose.Schema({
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  dateString: {
    type: String,
    required: true,
    index: true
  },
  signInTime: {
    type: String,
    required: true
  },
  signOffTime: {
    type: String,
    required: true
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  minutesWorked: {
    type: Number,
    default: 0
  },
  totalHoursDecimal: {
    type: Number,
    default: 0
  },
  dutyCompleted: {
    type: Boolean,
    default: false
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

// Index for efficient queries by payrollId and date
DailyHoursSchema.index({ payrollId: 1, dateString: 1 }, { unique: true });

// Auto-update updatedAt
DailyHoursSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DailyHours', DailyHoursSchema);
