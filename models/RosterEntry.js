const mongoose = require('mongoose');

const rosterAssignmentSchema = new mongoose.Schema({
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

const rosterEntrySchema = new mongoose.Schema({
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'unconfirmed'],
    default: 'unconfirmed',
    index: true
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
  primary: rosterAssignmentSchema,
  associated: [rosterAssignmentSchema],
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

rosterEntrySchema.index({ payrollId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('RosterEntry', rosterEntrySchema);
