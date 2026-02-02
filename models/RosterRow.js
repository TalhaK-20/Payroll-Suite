const mongoose = require('mongoose');

const rosterRowSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  clientName: {
    type: String,
    trim: true,
    default: ''
  },
  siteName: {
    type: String,
    trim: true,
    default: ''
  },
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
  active: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

rosterRowSchema.index({ guardId: 1 });
rosterRowSchema.index({ clientId: 1 });
rosterRowSchema.index({ active: 1 });

module.exports = mongoose.model('RosterRow', rosterRowSchema);
