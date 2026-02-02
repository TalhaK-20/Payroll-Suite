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
  },
  status: {
    type: String,
    enum: ['confirmed', 'unconfirmed', 'unassigned', 'in-progress', 'incomplete'],
    default: 'unconfirmed'
  },
  payRate: {
    type: Number,
    min: 0,
    default: 0
  },
  payAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  chargeRate: {
    type: Number,
    min: 0,
    default: 0
  },
  chargeAmount: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: false });

const rosterEntrySchema = new mongoose.Schema({
  rosterRowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RosterRow',
    required: true,
    index: true
  },
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    default: null
  },
  status: {
    type: String,
    enum: ['confirmed', 'unconfirmed', 'unassigned', 'in-progress', 'incomplete'],
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
  totalCharge: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

rosterEntrySchema.index({ rosterRowId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('RosterEntry', rosterEntrySchema);
