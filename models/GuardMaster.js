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

const guardMasterSchema = new mongoose.Schema({
  // Basic Information
  guardName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  nationality: {
    type: String,
    required: true,
    enum: [
      'British',
      'Afghan',
      'Albanian',
      'Algerian',
      'American',
      'Angolan',
      'Argentine',
      'Armenian',
      'Australian',
      'Austrian',
      'Azerbaijani',
      'Bahamian',
      'Bangladeshi',
      'Barbadian',
      'Belarusian',
      'Belgian',
      'Belizean',
      'Beninese',
      'Bhutanese',
      'Bolivian',
      'Bosnian',
      'Brazilian',
      'British',
      'Bruneian',
      'Bulgarian',
      'Burkinabe',
      'Burmese',
      'Burundian',
      'Cambodian',
      'Cameroonian',
      'Canadian',
      'Cape Verdean',
      'Central African',
      'Chadian',
      'Chilean',
      'Chinese',
      'Colombian',
      'Comoran',
      'Congolese',
      'Costa Rican',
      'Croatian',
      'Cuban',
      'Cypriot',
      'Czech',
      'Danish',
      'Djiboutian',
      'Dominican',
      'Dutch',
      'East Timorese',
      'Ecuadorian',
      'Egyptian',
      'Emirati',
      'Equatorial Guinean',
      'Eritrean',
      'Estonian',
      'Ethiopian',
      'Fijian',
      'Filipino',
      'Finnish',
      'French',
      'Gabonese',
      'Gambian',
      'Georgian',
      'German',
      'Ghanaian',
      'Greek',
      'Grenadian',
      'Guatemalan',
      'Guinean',
      'Guinea-Bissauan',
      'Guyanese',
      'Haitian',
      'Honduran',
      'Hungarian',
      'Icelander',
      'Indian',
      'Indonesian',
      'Iranian',
      'Iraqi',
      'Irish',
      'Israeli',
      'Italian',
      'Ivorian',
      'Jamaican',
      'Japanese',
      'Jordanian',
      'Kazakhstani',
      'Kenyan',
      'Kuwaiti',
      'Kyrgyz',
      'Laotian',
      'Latvian',
      'Lebanese',
      'Lesothan',
      'Liberian',
      'Libyan',
      'Liechtensteiner',
      'Lithuanian',
      'Luxembourgish',
      'Macedonian',
      'Malagasy',
      'Malawian',
      'Malaysian',
      'Maldivian',
      'Malian',
      'Maltese',
      'Marshallese',
      'Mauritanian',
      'Mauritian',
      'Mexican',
      'Micronesian',
      'Moldovan',
      'Monacan',
      'Mongolian',
      'Montenegrin',
      'Moroccan',
      'Mozambican',
      'Namibian',
      'Nauruan',
      'Nepalese',
      'New Zealander',
      'Nicaraguan',
      'Nigerian',
      'North Korean',
      'Northern Irish',
      'Norwegian',
      'Omani',
      'Pakistani',
      'Palauan',
      'Palestinian',
      'Panamanian',
      'Papua New Guinean',
      'Paraguayan',
      'Peruvian',
      'Polish',
      'Portuguese',
      'Qatari',
      'Romanian',
      'Russian',
      'Rwandan',
      'Saint Kitts and Nevisan',
      'Saint Lucian',
      'Saint Vincentian',
      'Samoan',
      'Sammarinese',
      'Sao Tomean',
      'Saudi',
      'Scottish',
      'Senegalese',
      'Serbian',
      'Seychellois',
      'Sierra Leonean',
      'Singaporean',
      'Slovak',
      'Slovenian',
      'Solomon Islander',
      'Somali',
      'South African',
      'South Korean',
      'Spanish',
      'Sri Lankan',
      'Sudanese',
      'Surinamese',
      'Swedish',
      'Swiss',
      'Syrian',
      'Taiwanese',
      'Tajik',
      'Tanzanian',
      'Thai',
      'Timorese',
      'Togolese',
      'Tongan',
      'Trinidad and Tobagonian',
      'Tunisian',
      'Turkish',
      'Turkmen',
      'Tuvaluan',
      'Ugandan',
      'Ukrainian',
      'Uruguayan',
      'Uzbek',
      'Vanuatu',
      'Vatican',
      'Venezuelan',
      'Vietnamese',
      'Welsh',
      'Yemeni',
      'Zambian',
      'Zimbabwean'
    ]
  },

  // Immigration/Visa Information
  visaType: {
    type: String,
    enum: [
      'British Citizen',
      'Student',
      'Skilled Worker',
      'PSW (Post-Study Work)',
      'Dependent/Spouse',
      'Permanent Resident',
      'Settled Status',
      'Pre-Settled Status',
      'Refugee/Asylum',
      'Other'
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
    validate: {
      validator: function(v) {
        if (this.britishPassport === true) {
          return true;
        }
        return v && v.trim().length > 0;
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
          return true;
        }
        return v !== null;
      },
      message: 'Share code expiry date is required for non-British passport holders'
    }
  },

  // SIA License Information
  siaLicense: {
    required: {
      type: Boolean,
      default: false
    },
    licenseNumber: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: ['Front of House', 'Close Protection', 'Security Guarding', 'Door Supervision', ''],
      default: ''
    },
    expiryDate: {
      type: Date,
      default: null
    }
  },

  // Bank Accounts (multiple)
  bankAccounts: [bankAccountSchema],

  // Associated Guard (for hour distribution when primary guard can't work 40 hours/week)
  associatedGuard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuardMaster',
    default: null,
    validate: {
      validator: function(v) {
        // Prevent self-reference
        return v === null || v.toString() !== this._id.toString();
      },
      message: 'Associated guard cannot be the same as the current guard'
    }
  },

  // Status and Tracking
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure only one primary bank account
guardMasterSchema.pre('save', function(next) {
  const primaryAccounts = this.bankAccounts.filter(acc => acc.isPrimary);
  if (primaryAccounts.length > 1) {
    // Keep only first primary
    this.bankAccounts = this.bankAccounts.map((acc, idx) => {
      acc.isPrimary = idx === 0 && acc.isPrimary;
      return acc;
    });
  }
  this.updatedAt = Date.now();
  next();
});

// Indexes for common queries
guardMasterSchema.index({ guardName: 'text', email: 'text' });
guardMasterSchema.index({ isActive: 1, createdAt: -1 });
guardMasterSchema.index({ 'siaLicense.expiryDate': 1 });
guardMasterSchema.index({ 'shareCodeExpiryDate': 1 });

module.exports = mongoose.model('GuardMaster', guardMasterSchema);
