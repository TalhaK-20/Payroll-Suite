const mongoose = require('mongoose');

const monthlyAssignmentSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuardMaster',
    default: null
  },
  guardName: {
    type: String,
    trim: true,
    default: ''
  },
  hours: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: false });

const rosterMonthlyTargetSchema = new mongoose.Schema({
  payrollId: {
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
  primaryHours: {
    type: Number,
    min: 0,
    default: 0
  },
  associated: [monthlyAssignmentSchema],
  totalHours: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

rosterMonthlyTargetSchema.index({ payrollId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('RosterMonthlyTarget', rosterMonthlyTargetSchema);
