const mongoose = require('mongoose');

// Bank Account Sub-schema
const bankAccountSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    required: true,
    trim: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  sortCode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{2}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Sort code must be in format: XX-XX-XX'
    }
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{8}$/.test(v);
      },
      message: 'Account number must be 8 digits'
    }
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
    ref: 'BankAccount',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
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
    required: true,
    trim: true
  },
  siteName: {
    type: String,
    trim: true,
    default: ''
  },

  // Guard Basic Information
  guardName: {
    type: String,
    required: true,
    trim: true
  },
  nationality: {
    type: String,
    trim: true,
    default: ''
  },
  insuranceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{2}\s\d{3}\s\d{3}\s[A-Z]$/.test(v);
      },
      message: 'Insurance number format: AB 123 456 C'
    }
  },

  // Immigration/Visa Information
  visaStatus: {
    type: String,
    enum: [
      'Student',
      'Skilled Worker',
      'PSW',
      'Dependent/Spouse',
      'Permanent Resident',
      'Settled Status',
      'Pre-Settled Status',
      'Refugee/Asylum'
    ],
    required: true
  },
  britishPassport: {
    type: Boolean,
    default: false
  },
  shareCode: {
    type: String,
    trim: true,
    default: null,
    // Only required if britishPassport is false
    validate: {
      validator: function(v) {
        if (this.britishPassport === true) {
          return true; // Not required for British passport holders
        }
        return v && v.trim().length > 0; // Required for others
      },
      message: 'Share code is required for non-British passport holders'
    }
  },
  shareCodeExpiryDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(v) {
        if (this.britishPassport === true) {
          return true; // Not required for British passport holders
        }
        return v !== null; // Required for others
      },
      message: 'Share code expiry date is required for non-British passport holders'
    }
  },

  // Working Hours (Separated)
  totalHours: {
    type: Number,
    required: true,
    min: 0
  },
  totalMinutes: {
    type: Number,
    required: true,
    min: 0,
    max: 59
  },

  // Rates
  chargeRate: {
    type: Number,
    required: true,
    min: 0
  },
  payRate: {
    type: Number,
    required: true,
    min: 0
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
payrollSchema.index({ insuranceNumber: 1 }, { unique: true });
payrollSchema.index({ visaStatus: 1 });
payrollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);