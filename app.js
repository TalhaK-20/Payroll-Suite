require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

// Import models and utilities
const Payroll = require('./models/Payroll');
const DailyHours = require('./models/DailyHours');
const GuardMaster = require('./models/GuardMaster');
const MonthlyHours = require('./models/MonthlyHours');
const PayrollDeduction = require('./models/PayrollDeduction');
const Alert = require('./models/Alert');
const pdfGenerator = require('./utils/pdfGenerator');
const excelParser = require('./utils/excelParser');
const EnhancedPdfGenerator = require('./utils/enhancedPdfGenerator');
const EnhancedExcelGenerator = require('./utils/enhancedExcelGenerator');
const payrollValidation = require('./utils/payrollValidation');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE SETUP ====================

// Static files
app.use(express.static('public'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== MULTER CONFIGURATION ====================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==================== DATABASE CONNECTION ====================

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI not set in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  w: 'majority'
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    // Don't exit on error, allow graceful handling
  });

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to database');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from database');
});

// ==================== VALIDATION MIDDLEWARE ====================

// Use enhanced validation rules from utility
const payrollValidationRules = payrollValidation.payrollValidationRules;
const validate = payrollValidation.validate;

// ==================== PAGE ROUTES ====================

/**
 * GET / - Main dashboard page
 */
app.get('/', (req, res) => {
  res.render('index');
});

/**
 * GET /upload - Excel upload page
 */
app.get('/upload', (req, res) => {
  res.render('upload');
});

/**
 * GET /guards - Guard management page
 */
app.get('/guards', (req, res) => {
  res.render('guards');
});

/**
 * GET /monthly-hours - Monthly hours entry page
 */
app.get('/monthly-hours', (req, res) => {
  res.render('monthly-hours');
});

/**
 * GET /dashboard - Dashboard with metrics and alerts
 */
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

/**
 * GET /reports - Advanced reporting page
 */
app.get('/reports', (req, res) => {
  res.render('reports');
});

// ==================== API ROUTES - GUARD MASTER ====================

/**
 * GET /api/guards - Get all guards
 */
app.get('/api/guards', async (req, res) => {
  try {
    const { search, isActive } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { guardName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const guards = await GuardMaster.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: guards,
      count: guards.length
    });
  } catch (error) {
    console.error('Error fetching guards:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching guards',
      error: error.message
    });
  }
});

/**
 * GET /api/guards/:id - Get single guard
 */
app.get('/api/guards/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guard ID'
      });
    }

    const guard = await GuardMaster.findById(req.params.id);
    if (!guard) {
      return res.status(404).json({
        success: false,
        message: 'Guard not found'
      });
    }

    res.json({
      success: true,
      data: guard
    });
  } catch (error) {
    console.error('Error fetching guard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching guard',
      error: error.message
    });
  }
});

/**
 * POST /api/guards - Create new guard
 */
app.post('/api/guards', async (req, res) => {
  try {
    const {
      guardName,
      email,
      phoneNumber,
      nationality,
      visaType,
      britishPassport,
      shareCode,
      shareCodeExpiryDate,
      siaLicense,
      bankAccounts,
      notes
    } = req.body;

    if (!guardName || !nationality || !visaType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: guardName, nationality, visaType'
      });
    }

    // Validate Share Code for non-British passport
    if (!britishPassport && (!shareCode || !shareCodeExpiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Share code and expiry date required for non-British passport holders'
      });
    }

    const newGuard = new GuardMaster({
      guardName,
      email,
      phoneNumber,
      nationality,
      visaType,
      britishPassport,
      shareCode: britishPassport ? null : shareCode,
      shareCodeExpiryDate: britishPassport ? null : shareCodeExpiryDate,
      siaLicense: siaLicense || {},
      bankAccounts: bankAccounts || [],
      notes
    });

    await newGuard.save();
    res.status(201).json({
      success: true,
      message: 'Guard created successfully',
      data: newGuard
    });
  } catch (error) {
    console.error('Error creating guard:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating guard',
      error: error.message
    });
  }
});

/**
 * PUT /api/guards/:id - Update guard
 */
app.put('/api/guards/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guard ID'
      });
    }

    const {
      guardName,
      email,
      phoneNumber,
      nationality,
      visaType,
      britishPassport,
      shareCode,
      shareCodeExpiryDate,
      siaLicense,
      bankAccounts,
      isActive,
      notes
    } = req.body;

    // Validate Share Code for non-British passport
    if (!britishPassport && (!shareCode || !shareCodeExpiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Share code and expiry date required for non-British passport holders'
      });
    }

    const updateData = {
      guardName,
      email,
      phoneNumber,
      nationality,
      visaType,
      britishPassport,
      shareCode: britishPassport ? null : shareCode,
      shareCodeExpiryDate: britishPassport ? null : shareCodeExpiryDate,
      siaLicense: siaLicense || {},
      bankAccounts: bankAccounts || [],
      isActive,
      notes
    };

    const guard = await GuardMaster.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    if (!guard) {
      return res.status(404).json({
        success: false,
        message: 'Guard not found'
      });
    }

    res.json({
      success: true,
      message: 'Guard updated successfully',
      data: guard
    });
  } catch (error) {
    console.error('Error updating guard:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating guard',
      error: error.message
    });
  }
});

/**
 * DELETE /api/guards/:id - Delete guard
 */
app.delete('/api/guards/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guard ID'
      });
    }

    const guard = await GuardMaster.findByIdAndDelete(req.params.id);
    if (!guard) {
      return res.status(404).json({
        success: false,
        message: 'Guard not found'
      });
    }

    // Also delete associated records
    await MonthlyHours.deleteMany({ guardId: req.params.id });
    await PayrollDeduction.deleteMany({ guardId: req.params.id });
    await Alert.deleteMany({ guardId: req.params.id });

    res.json({
      success: true,
      message: 'Guard and associated records deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting guard:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting guard',
      error: error.message
    });
  }
});

// ==================== API ROUTES - MONTHLY HOURS ====================

/**
 * GET /api/monthly-hours - Get monthly hours records
 */
app.get('/api/monthly-hours', async (req, res) => {
  try {
    const { year, month, guardId } = req.query;
    let query = {};

    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (guardId) query.guardId = guardId;

    const records = await MonthlyHours.find(query)
      .populate('guardId', 'guardName email')
      .sort({ year: -1, month: -1 });

    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    console.error('Error fetching monthly hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly hours',
      error: error.message
    });
  }
});

/**
 * POST /api/monthly-hours - Create/Update monthly hours
 */
app.post('/api/monthly-hours', async (req, res) => {
  try {
    const { guardId, year, month, totalHours, totalMinutes, notes } = req.body;

    if (!guardId || !year || !month || totalHours === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if guard exists
    const guard = await GuardMaster.findById(guardId);
    if (!guard) {
      return res.status(404).json({
        success: false,
        message: 'Guard not found'
      });
    }

    // Check for existing monthly hours
    let monthlyHours = await MonthlyHours.findOne({ guardId, year, month });

    if (monthlyHours) {
      // Update existing
      monthlyHours.totalHours = totalHours;
      monthlyHours.totalMinutes = totalMinutes || 0;
      monthlyHours.notes = notes || '';
      await monthlyHours.save();
    } else {
      // Create new
      monthlyHours = new MonthlyHours({
        guardId,
        year,
        month,
        totalHours,
        totalMinutes: totalMinutes || 0,
        notes: notes || ''
      });
      await monthlyHours.save();
    }

    res.status(monthlyHours._id ? 200 : 201).json({
      success: true,
      message: monthlyHours._id ? 'Monthly hours updated' : 'Monthly hours created',
      data: monthlyHours
    });
  } catch (error) {
    console.error('Error saving monthly hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving monthly hours',
      error: error.message
    });
  }
});

/**
 * GET /api/monthly-hours/:id - Get single monthly hours record
 */
app.get('/api/monthly-hours/:id', async (req, res) => {
  try {
    const record = await MonthlyHours.findById(req.params.id).populate('guardId');
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Monthly hours record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Error fetching monthly hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly hours',
      error: error.message
    });
  }
});

/**
 * DELETE /api/monthly-hours/:id - Delete monthly hours record
 */
app.delete('/api/monthly-hours/:id', async (req, res) => {
  try {
    const record = await MonthlyHours.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Monthly hours record not found'
      });
    }

    // Also delete associated payroll deductions
    await PayrollDeduction.deleteMany({ monthlyHoursId: req.params.id });

    res.json({
      success: true,
      message: 'Monthly hours record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting monthly hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting monthly hours',
      error: error.message
    });
  }
});

// ==================== API ROUTES - PAYROLL DEDUCTIONS ====================

/**
 * POST /api/payroll-deductions - Process payroll deduction
 */
app.post('/api/payroll-deductions', async (req, res) => {
  try {
    const {
      guardId,
      year,
      month,
      deductedHours,
      deductedMinutes,
      paymentAmount,
      paymentMethod,
      bankAccountId,
      reference,
      notes
    } = req.body;

    if (!guardId || !year || !month || deductedHours === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Get monthly hours record
    const monthlyHours = await MonthlyHours.findOne({ guardId, year, month });
    if (!monthlyHours) {
      return res.status(404).json({
        success: false,
        message: 'Monthly hours record not found for this guard/month'
      });
    }

    // Check if deduction would exceed available hours
    const totalAvailableMinutes = monthlyHours.totalHours * 60 + monthlyHours.totalMinutes;
    const paidMinutes = monthlyHours.paidHours * 60 + monthlyHours.paidMinutes;
    const deductMinutes = deductedHours * 60 + deductedMinutes;
    const remainingMinutes = totalAvailableMinutes - paidMinutes;

    if (deductMinutes > remainingMinutes) {
      return res.status(400).json({
        success: false,
        message: `Cannot deduct ${deductedHours}h ${deductedMinutes}m. Only ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining`,
        remainingHours: Math.floor(remainingMinutes / 60),
        remainingMinutes: remainingMinutes % 60
      });
    }

    // Get payroll entry number
    const lastDeduction = await PayrollDeduction.findOne({ guardId, year, month }).sort({ payrollEntryNumber: -1 });
    const payrollEntryNumber = (lastDeduction?.payrollEntryNumber || 0) + 1;

    // Create deduction record
    const deduction = new PayrollDeduction({
      guardId,
      monthlyHoursId: monthlyHours._id,
      year,
      month,
      payrollEntryNumber,
      deductedHours,
      deductedMinutes,
      paymentAmount,
      paymentMethod,
      bankAccountId,
      reference,
      notes,
      status: 'pending'
    });

    await deduction.save();

    // Update monthly hours with paid amount
    monthlyHours.paidHours += deductedHours;
    monthlyHours.paidMinutes += deductedMinutes;
    // Normalize minutes
    if (monthlyHours.paidMinutes >= 60) {
      monthlyHours.paidHours += Math.floor(monthlyHours.paidMinutes / 60);
      monthlyHours.paidMinutes = monthlyHours.paidMinutes % 60;
    }
    await monthlyHours.save();

    res.status(201).json({
      success: true,
      message: 'Payroll deduction processed successfully',
      data: deduction
    });
  } catch (error) {
    console.error('Error creating payroll deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payroll deduction',
      error: error.message
    });
  }
});

/**
 * GET /api/payroll-deductions - Get deductions
 */
app.get('/api/payroll-deductions', async (req, res) => {
  try {
    const { year, month, guardId, status } = req.query;
    let query = {};

    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (guardId) query.guardId = guardId;
    if (status) query.status = status;

    const deductions = await PayrollDeduction.find(query)
      .populate('guardId', 'guardName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: deductions,
      count: deductions.length
    });
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deductions',
      error: error.message
    });
  }
});

/**
 * PUT /api/payroll-deductions/:id - Update deduction status
 */
app.put('/api/payroll-deductions/:id', async (req, res) => {
  try {
    const { status, paidDate, reference } = req.body;

    const deduction = await PayrollDeduction.findByIdAndUpdate(
      req.params.id,
      {
        status,
        paidDate: status === 'paid' ? paidDate || new Date() : null,
        reference
      },
      { new: true }
    );

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: 'Deduction record not found'
      });
    }

    res.json({
      success: true,
      message: 'Deduction updated successfully',
      data: deduction
    });
  } catch (error) {
    console.error('Error updating deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating deduction',
      error: error.message
    });
  }
});

/**
 * DELETE /api/payroll-deductions/:id - Delete payroll deduction
 */
app.delete('/api/payroll-deductions/:id', async (req, res) => {
  try {
    const deduction = await PayrollDeduction.findByIdAndDelete(req.params.id);
    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: 'Deduction record not found'
      });
    }

    // Recalculate monthly hours remaining
    if (deduction.monthlyHoursId) {
      const monthlyHours = await MonthlyHours.findById(deduction.monthlyHoursId);
      if (monthlyHours) {
        monthlyHours.paidHours -= deduction.deductedHours;
        monthlyHours.paidMinutes -= deduction.deductedMinutes;
        
        // Normalize
        if (monthlyHours.paidMinutes < 0) {
          monthlyHours.paidHours -= 1;
          monthlyHours.paidMinutes += 60;
        }
        if (monthlyHours.paidHours < 0) {
          monthlyHours.paidHours = 0;
          monthlyHours.paidMinutes = 0;
        }
        
        await monthlyHours.save();
      }
    }

    res.json({
      success: true,
      message: 'Deduction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting deduction',
      error: error.message
    });
  }
});

// ==================== API ROUTES - ALERTS ====================

/**
 * GET /api/alerts - Get alerts
 */
app.get('/api/alerts', async (req, res) => {
  try {
    const { guardId, isResolved, severity } = req.query;
    let query = {};

    if (guardId) query.guardId = guardId;
    if (isResolved !== undefined) query.isResolved = isResolved === 'true';
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .populate('guardId', 'guardName email')
      .sort({ severity: -1, createdAt: -1 });

    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
      error: error.message
    });
  }
});

/**
 * POST /api/alerts - Create alert (internal use)
 */
app.post('/api/alerts', async (req, res) => {
  try {
    const { guardId, alertType, severity, title, description, relatedData, actionUrl } = req.body;

    const alert = new Alert({
      guardId,
      alertType,
      severity: severity || 'warning',
      title,
      description,
      relatedData,
      actionUrl
    });

    await alert.save();
    res.status(201).json({
      success: true,
      message: 'Alert created',
      data: alert
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating alert',
      error: error.message
    });
  }
});

/**
 * PUT /api/alerts/:id - Mark alert as read/resolved
 */
app.put('/api/alerts/:id', async (req, res) => {
  try {
    const { isRead, isResolved, resolvedNotes } = req.body;

    const updateData = {
      isRead,
      isResolved,
      resolvedNotes: isResolved ? resolvedNotes : ''
    };

    if (isResolved) {
      updateData.resolvedAt = new Date();
    }

    const alert = await Alert.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert updated',
      data: alert
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating alert',
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard-metrics - Get dashboard metrics
 */
app.get('/api/dashboard-metrics', async (req, res) => {
  try {
    const totalGuards = await GuardMaster.countDocuments({ isActive: true });
    
    // Get current month/year
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthlyStats = await MonthlyHours.aggregate([
      { $match: { year: currentYear, month: currentMonth } },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalMinutes: { $sum: '$totalMinutes' },
          paidHours: { $sum: '$paidHours' },
          paidMinutes: { $sum: '$paidMinutes' }
        }
      }
    ]);

    const pendingPayrolls = await PayrollDeduction.countDocuments({ status: 'pending' });
    
    const expiringAlerts = await Alert.countDocuments({
      alertType: 'expiring_share_code',
      isResolved: false
    });

    res.json({
      success: true,
      data: {
        totalGuards,
        monthlyStats: monthlyStats[0] || {
          totalHours: 0,
          totalMinutes: 0,
          paidHours: 0,
          paidMinutes: 0
        },
        pendingPayrolls,
        expiringAlerts,
        currentMonth,
        currentYear
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard metrics',
      error: error.message
    });
  }
});

// ==================== API ROUTES - PAYROLL OPERATIONS ====================

/**
 * GET /api/payroll - Get all payroll records
 */
app.get('/api/payroll', async (req, res) => {
  try {
    const records = await Payroll.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching records',
      error: error.message
    });
  }
});

/**
 * GET /api/payroll/filter - Filter payroll records (MUST BE BEFORE /:id ROUTE)
 */
app.get('/api/payroll/filter', async (req, res) => {
  try {
    const query = {};

    // Guard name filter
    if (req.query.guardName) {
      query.guardName = { $regex: req.query.guardName, $options: 'i' };
    }

    // Insurance number filter (new)
    if (req.query.insuranceNumber) {
      query.insuranceNumber = { $regex: req.query.insuranceNumber, $options: 'i' };
    }

    // Visa status filter (new)
    if (req.query.visaStatus) {
      query.visaStatus = req.query.visaStatus;
    }

    // Nationality filter (new)
    if (req.query.nationality) {
      query.nationality = { $regex: req.query.nationality, $options: 'i' };
    }

    // Client name filter (legacy)
    if (req.query.clientName) {
      query.clientName = { $regex: req.query.clientName, $options: 'i' };
    }

    const records = await Payroll.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: records,
      count: records.length,
      filters: req.query
    });
  } catch (error) {
    console.error('Error filtering payroll records:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering records',
      error: error.message
    });
  }
});

/**
 * GET /api/payroll/:id - Get specific payroll record
 */
app.get('/api/payroll/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const record = await Payroll.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Error fetching payroll record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching record',
      error: error.message
    });
  }
});

/**
 * POST /api/payroll - Create new payroll record
 */
app.post('/api/payroll', payrollValidationRules(), validate, async (req, res) => {
  try {
    // Parse bank accounts
    let bankAccounts = [];
    if (req.body.bankAccounts && typeof req.body.bankAccounts === 'string') {
      try {
        bankAccounts = JSON.parse(req.body.bankAccounts);
      } catch (e) {
        console.log('Bank accounts parse error, using empty array');
      }
    } else if (Array.isArray(req.body.bankAccounts)) {
      bankAccounts = req.body.bankAccounts;
    }

    const payrollData = {
      // Basic info
      clientName: req.body.clientName,
      guardName: req.body.guardName,
      siteName: req.body.siteName,
      
      // Visa information
      nationality: req.body.nationality,
      insuranceNumber: req.body.insuranceNumber,
      visaStatus: req.body.visaStatus,
      britishPassport: req.body.britishPassport === 'true' || req.body.britishPassport === true,
      shareCode: req.body.shareCode,
      shareCodeExpiryDate: req.body.shareCodeExpiryDate,
      
      // Hours
      totalHours: parseFloat(req.body.totalHours) || 0,
      totalMinutes: parseInt(req.body.totalMinutes) || 0,
      
      // Rates
      payRate: parseFloat(req.body.payRate) || 0,
      chargeRate: parseFloat(req.body.chargeRate) || 0,
      
      // Bank accounts
      bankAccounts: bankAccounts,
      
      // Legacy fields for compatibility
      pay1: parseFloat(req.body.pay1) || 0,
      pay2: parseFloat(req.body.pay2) || 0,
      pay3: parseFloat(req.body.pay3) || 0,
      accountNo: req.body.accountNo,
      sortCode: req.body.sortCode,
      accountHolderName: req.body.accountHolderName
    };

    const newRecord = new Payroll(payrollData);
    const savedRecord = await newRecord.save();

    res.json({
      success: true,
      message: 'Payroll record created successfully',
      data: savedRecord
    });
  } catch (error) {
    console.error('Error creating payroll record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating record',
      error: error.message
    });
  }
});

/**
 * PUT /api/payroll/:id - Update payroll record
 */
app.put('/api/payroll/:id', payrollValidationRules(), validate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const updateData = {
      // Basic info
      clientName: req.body.clientName,
      guardName: req.body.guardName,
      siteName: req.body.siteName,
      
      // Visa information
      nationality: req.body.nationality,
      insuranceNumber: req.body.insuranceNumber,
      visaStatus: req.body.visaStatus,
      britishPassport: req.body.britishPassport === 'true' || req.body.britishPassport === true,
      shareCode: req.body.shareCode,
      shareCodeExpiryDate: req.body.shareCodeExpiryDate,
      
      // Hours
      totalHours: parseFloat(req.body.totalHours) || 0,
      totalMinutes: parseInt(req.body.totalMinutes) || 0,
      
      // Rates
      payRate: parseFloat(req.body.payRate) || 0,
      chargeRate: parseFloat(req.body.chargeRate) || 0,
      
      // Bank accounts
      bankAccounts: req.body.bankAccounts ? (typeof req.body.bankAccounts === 'string' ? JSON.parse(req.body.bankAccounts) : req.body.bankAccounts) : [],
      
      // Legacy fields for compatibility
      pay1: parseFloat(req.body.pay1) || 0,
      pay2: parseFloat(req.body.pay2) || 0,
      pay3: parseFloat(req.body.pay3) || 0,
      accountNo: req.body.accountNo,
      sortCode: req.body.sortCode,
      accountHolderName: req.body.accountHolderName,
      
      updatedAt: new Date()
    };

    const updatedRecord = await Payroll.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Payroll record updated successfully',
      data: updatedRecord
    });
  } catch (error) {
    console.error('Error updating payroll record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating record',
      error: error.message
    });
  }
});

/**
 * DELETE /api/payroll/:id - Delete payroll record
 */
app.delete('/api/payroll/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const deletedRecord = await Payroll.findByIdAndDelete(req.params.id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Payroll record deleted successfully',
      data: deletedRecord
    });
  } catch (error) {
    console.error('Error deleting payroll record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting record',
      error: error.message
    });
  }
});

// Filter route moved before /:id route for proper matching

// ==================== API ROUTES - EXCEL UPLOAD ====================

/**
 * POST /api/upload/excel - Upload and parse Excel file
 */
app.post('/api/upload/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Parse Excel file
    const parseResult = excelParser.parseExcelFile(req.file.path);

    if (!parseResult.success) {
      fs.unlinkSync(req.file.path); // Delete uploaded file
      return res.status(400).json({
        success: false,
        message: 'Error parsing Excel file',
        errors: parseResult.errors
      });
    }

    // Validate data
    const validation = excelParser.validateData(parseResult.data);

    if (!validation.isValid) {
      fs.unlinkSync(req.file.path); // Delete uploaded file
      return res.status(400).json({
        success: false,
        message: 'Data validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Successfully imported ${parseResult.data.length} records`,
      data: parseResult.data,
      count: parseResult.data.length,
      warnings: validation.warnings
    });
  } catch (error) {
    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error uploading Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// ==================== API ROUTES - PDF GENERATION ====================

/**
 * POST /api/payroll/generate-pdf - Generate payroll PDF for individual record
 */
app.post('/api/payroll/generate-pdf', async (req, res) => {
  try {
    const { payrollData, payNumber } = req.body;

    if (!payrollData || !payNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing payroll data or pay number'
      });
    }

    if (![1, 2, 3].includes(payNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Pay number must be 1, 2, or 3'
      });
    }

    // Generate PDF as buffer (works on serverless platforms)
    const pdfBuffer = await pdfGenerator.generatePayrollPDF(payrollData, payNumber);

    // Set headers and send
    const filename = `payroll_${String(payNumber).padStart(2, '0')}_${payrollData.guardName}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

// ==================== API ROUTES - EXPORT ====================

/**
 * POST /api/export/pdf - Export all payroll records as PDF
 */
app.post('/api/export/pdf', async (req, res) => {
  try {
    const records = await Payroll.find().sort({ createdAt: -1 });

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to export'
      });
    }

    // Generate bulk PDF as buffer (works on serverless platforms)
    const pdfBuffer = await pdfGenerator.generateBulkPayrollPDF(records);

    // Set headers and send
    const filename = `payroll_export_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting PDF',
      error: error.message
    });
  }
});

/**
 * POST /api/export/excel - Export all payroll records as Excel
 */
app.post('/api/export/excel', async (req, res) => {
  try {
    const records = await Payroll.find().sort({ createdAt: -1 });

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to export'
      });
    }

    // Generate Excel file as buffer (works on serverless platforms)
    const result = excelParser.generateExcelFromData(records);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error generating Excel file',
        error: result.error
      });
    }

    // Set headers and send
    const filename = `payroll_export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    
    res.send(result.buffer);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting Excel',
      error: error.message
    });
  }
});

// ==================== API ROUTES - ENHANCED EXPORTS ====================

/**
 * POST /api/export/enhanced-pdf - Export with enhanced PDF including visa information
 */
app.post('/api/export/enhanced-pdf', async (req, res) => {
  try {
    const records = await Payroll.find().sort({ createdAt: -1 });

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to export'
      });
    }

    const generator = new EnhancedPdfGenerator();
    const pdfBuffer = await generator.generatePayrollPDF(records);

    const filename = `payroll_enhanced_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting enhanced PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting enhanced PDF',
      error: error.message
    });
  }
});

/**
 * POST /api/export/enhanced-excel - Export with enhanced Excel (4 sheets)
 */
app.post('/api/export/enhanced-excel', async (req, res) => {
  try {
    const records = await Payroll.find().sort({ createdAt: -1 });

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to export'
      });
    }

    const generator = new EnhancedExcelGenerator();
    const excelBuffer = await generator.generatePayrollExcel(records);

    const filename = `payroll_enhanced_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting enhanced Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting enhanced Excel',
      error: error.message
    });
  }
});

/**
 * POST /api/export/payroll-pdf/:id - Export single record as enhanced PDF
 */
app.post('/api/export/payroll-pdf/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const record = await Payroll.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    const generator = new EnhancedPdfGenerator();
    const pdfBuffer = await generator.generatePayrollPDF([record]);

    const filename = `payroll_${record.guardName}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting payroll PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting payroll PDF',
      error: error.message
    });
  }
});

// ==================== DAILY HOURS ENDPOINTS ====================

// POST - Add or update daily hours
app.post('/api/daily-hours', async (req, res) => {
  try {
    const { payrollId, date, signInTime, signOffTime, dutyCompleted, notes } = req.body;

    if (!payrollId || !date || !signInTime || !signOffTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: payrollId, date, signInTime, signOffTime'
      });
    }

    // Calculate hours worked
    const [inHour, inMin] = signInTime.split(':').map(Number);
    const [outHour, outMin] = signOffTime.split(':').map(Number);

    let inMinutes = inHour * 60 + inMin;
    let outMinutes = outHour * 60 + outMin;

    if (outMinutes < inMinutes) {
      outMinutes += 24 * 60; // Handle overnight shifts
    }

    const totalMinutes = outMinutes - inMinutes;
    const hoursWorked = Math.floor(totalMinutes / 60);
    const minutesWorked = totalMinutes % 60;
    const totalHoursDecimal = hoursWorked + minutesWorked / 60;

    // Find or create daily hours record
    const dateObj = new Date(date);
    const dateString = date;

    let dailyHours = await DailyHours.findOne({
      payrollId: payrollId,
      dateString: dateString
    });

    if (dailyHours) {
      // Update existing record
      dailyHours.signInTime = signInTime;
      dailyHours.signOffTime = signOffTime;
      dailyHours.hoursWorked = hoursWorked;
      dailyHours.minutesWorked = minutesWorked;
      dailyHours.totalHoursDecimal = totalHoursDecimal;
      dailyHours.dutyCompleted = dutyCompleted || totalHoursDecimal >= 8;
      dailyHours.notes = notes || '';
      dailyHours.updatedAt = new Date();
    } else {
      // Create new record
      dailyHours = new DailyHours({
        payrollId,
        date: dateObj,
        dateString,
        signInTime,
        signOffTime,
        hoursWorked,
        minutesWorked,
        totalHoursDecimal,
        dutyCompleted: dutyCompleted || totalHoursDecimal >= 8,
        notes: notes || ''
      });
    }

    await dailyHours.save();

    // Update total hours in payroll record
    const allDailyHours = await DailyHours.find({ payrollId });
    const totalMinutesAll = allDailyHours.reduce((sum, record) => {
      return sum + (record.hoursWorked * 60 + record.minutesWorked);
    }, 0);

    const totalHoursAll = Math.floor(totalMinutesAll / 60);
    const totalMinutesRemainder = totalMinutesAll % 60;

    await Payroll.findByIdAndUpdate(payrollId, {
      totalHours: totalHoursAll,
      totalMinutes: totalMinutesRemainder
    });

    res.json({
      success: true,
      message: 'Daily hours logged successfully',
      data: dailyHours
    });
  } catch (error) {
    console.error('Error logging daily hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging daily hours',
      error: error.message
    });
  }
});

// GET - Get daily hours for a guard
app.get('/api/daily-hours/:payrollId', async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { month, year } = req.query;

    let query = { payrollId };

    // Filter by month and year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const dailyHours = await DailyHours.find(query).sort({ dateString: 1 });

    res.json({
      success: true,
      data: dailyHours
    });
  } catch (error) {
    console.error('Error fetching daily hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily hours',
      error: error.message
    });
  }
});

// DELETE - Delete daily hours record
app.delete('/api/daily-hours/:id', async (req, res) => {
  try {
    const dailyHours = await DailyHours.findByIdAndDelete(req.params.id);

    if (!dailyHours) {
      return res.status(404).json({
        success: false,
        message: 'Daily hours record not found'
      });
    }

    // Recalculate total hours
    const allDailyHours = await DailyHours.find({ payrollId: dailyHours.payrollId });
    const totalMinutesAll = allDailyHours.reduce((sum, record) => {
      return sum + (record.hoursWorked * 60 + record.minutesWorked);
    }, 0);

    const totalHoursAll = Math.floor(totalMinutesAll / 60);
    const totalMinutesRemainder = totalMinutesAll % 60;

    await Payroll.findByIdAndUpdate(dailyHours.payrollId, {
      totalHours: totalHoursAll,
      totalMinutes: totalMinutesRemainder
    });

    res.json({
      success: true,
      message: 'Daily hours record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting daily hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting daily hours',
      error: error.message
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 10MB limit'
      });
    }
    if (err.code === 'FILE_TYPE_ERROR') {
      return res.status(400).json({
        success: false,
        message: 'Only Excel files are allowed'
      });
    }
  }

  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   PAYROLL MANAGEMENT SYSTEM STARTED        ║
╠════════════════════════════════════════════╣
║   Server is running on: http://localhost:${PORT}
║   Database: ${process.env.MONGODB_URI}
║   Environment: ${process.env.NODE_ENV || 'development'}
╚════════════════════════════════════════════╝
  `);
});

module.exports = app;
