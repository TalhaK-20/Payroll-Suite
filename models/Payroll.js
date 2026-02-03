const mongoose = require('mongoose');

// Bank Account Sub-schema
const bankAccountSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  sortCode: {
    type: String,
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  }
}, { _id: true });

// Payment Distribution Sub-schema
const paymentDistributionSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount'
  },
  amount: {
    type: Number,
    min: 0
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  sortOrder: {
    type: Number,
    default: 1
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: true });

const payrollSchema = new mongoose.Schema({
  // Client Information
  clientName: {
    type: String,
    trim: true
  },
  siteName: {
    type: String,
    trim: true,
    default: ''
  },

  // Guard Reference
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuardMaster',
    default: null
  },

  // Guard Basic Information
  guardName: {
    type: String,
    trim: true
  },
  nationality: {
    type: String,
    trim: true,
    default: ''
  },
  insuranceNumber: {
    type: String,
    trim: true,
    default: ''
  },

  // Immigration/Visa Information
  visaStatus: {
    type: String,
    default: ''
  },
  britishPassport: {
    type: Boolean,
    default: false
  },
  shareCode: {
    type: String,
    trim: true,
    default: null
  },
  shareCodeExpiryDate: {
    type: Date,
    default: null
  },

  // Working Hours (Separated)
  totalHours: {
    type: Number,
    min: 0,
    default: 0
  },
  totalMinutes: {
    type: Number,
    min: 0,
    max: 59,
    default: 0
  },

  // Associated Guard Hour Distribution
  hoursDistribution: {
    primaryGuardHours: {
      type: Number,
      min: 0,
      default: 0
    },
    associatedGuardHours: {
      type: Number,
      min: 0,
      default: 0
    },
    associatedGuardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuardMaster',
      default: null
    },
    associatedGuardName: {
      type: String,
      trim: true,
      default: ''
    }
  },

  // Payroll Status
  status: {
    type: String,
    enum: ['pending', 'ongoing', 'completed'],
    default: 'pending'
  },

  // Rates
  chargeRate: {
    type: Number,
    min: 0,
    default: 0
  },
  payRate: {
    type: Number,
    min: 0,
    default: 0
  },

  // Bank Accounts (Multiple)
  bankAccounts: [bankAccountSchema],

  // Payment Distribution (Multiple)
  payments: [paymentDistributionSchema],

  // Legacy fields (for backward compatibility)
  // Will be deprecated in future versions
  pay1: {
    type: Number,
    min: 0,
    default: 0
  },
  pay2: {
    type: Number,
    min: 0,
    default: 0
  },
  pay3: {
    type: Number,
    min: 0,
    default: 0
  },
  accountNo: {
    type: String,
    trim: true,
    default: ''
  },
  sortCode: {
    type: String,
    trim: true,
    default: ''
  },
  accountHolderName: {
    type: String,
    trim: true,
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
}, { timestamps: true });

// Virtual field for total hours in decimal format
payrollSchema.virtual('totalHoursDecimal').get(function() {
  return this.totalHours + (this.totalMinutes / 60);
});

// Virtual field for hours spent (sum of primary and associated guard hours)
payrollSchema.virtual('hoursSpent').get(function() {
  const primaryHours = this.hoursDistribution?.primaryGuardHours || 0;
  const associatedHours = this.hoursDistribution?.associatedGuardHours || 0;
  return primaryHours + associatedHours;
});

// Virtual field for remaining hours
payrollSchema.virtual('remainingHours').get(function() {
  return this.totalHoursDecimal - this.hoursSpent;
});

// Virtual field for total pay
payrollSchema.virtual('totalPay').get(function() {
  return this.totalHoursDecimal * this.payRate;
});

// Ensure virtuals are included in JSON
payrollSchema.set('toJSON', { virtuals: true });
payrollSchema.set('toObject', { virtuals: true });

// Indexes for better query performance
payrollSchema.index({ clientName: 1 });
payrollSchema.index({ guardName: 1 });
payrollSchema.index({ insuranceNumber: 1 }, { unique: true, sparse: true });
payrollSchema.index({ visaStatus: 1 });
payrollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);