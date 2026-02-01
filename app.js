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
const Client = require('./models/Client');
const RosterEntry = require('./models/RosterEntry');
const RosterMonthlyTarget = require('./models/RosterMonthlyTarget');
const RosterRow = require('./models/RosterRow');
const pdfGenerator = require('./utils/pdfGenerator');
const excelParser = require('./utils/excelParser');
const EnhancedPdfGenerator = require('./utils/enhancedPdfGenerator');
const EnhancedExcelGenerator = require('./utils/enhancedExcelGenerator');
const payrollValidation = require('./utils/payrollValidation');
const { setupPayrollRoutes } = require('./utils/payrollValidation');
const monthlyAnalytics = require('./utils/monthlyAnalytics');
const dataSynchronizer = require('./utils/dataSynchronizer');

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

// Determine upload directory - use /tmp for serverless environments (Vercel, AWS Lambda, etc.)
const getUploadDir = () => {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY;
  
  if (isServerless) {
    const tmpDir = path.join('/tmp', 'payroll_uploads');
    // Create /tmp directory (this is writable on all serverless platforms)
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
  
  // For local development, use public/uploads
  const uploadDir = path.join(__dirname, 'public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = getUploadDir();
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
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
mongoose.connection.on('connected', async () => {
  console.log('✅ Mongoose connected to database');
  
  // Fix the insuranceNumber index to be sparse (allow multiple empty values)
  try {
    // Drop the old unique index if it exists
    const collection = mongoose.connection.collection('payrolls');
    
    // Get indexes using the proper method for the MongoDB driver version
    let indexes = [];
    try {
      const cursor = collection.listIndexes();
      if (cursor && typeof cursor.toArray === 'function') {
        indexes = await cursor.toArray();
      } else if (cursor && cursor[Symbol.asyncIterator]) {
        indexes = await cursor.map(idx => idx).toArray();
      } else {
        // Fallback: try to get from indexInformation
        const indexInfo = await collection.indexInformation();
        indexes = Object.entries(indexInfo).map(([name, spec]) => ({ key: spec[0], name }));
      }
    } catch (indexErr) {
      console.log('ℹ️ Could not retrieve indexes:', indexErr.message);
      indexes = [];
    }
    
    const insuranceIndex = indexes.find(idx => idx.key && idx.key.insuranceNumber === 1);
    
    if (insuranceIndex && insuranceIndex.unique) {
      console.log('🔄 Dropping old unique index on insuranceNumber...');
      try {
        await collection.dropIndex('insuranceNumber_1');
        console.log('✅ Old index dropped');
      } catch (dropErr) {
        if (!dropErr.message.includes('index not found')) {
          console.error('⚠️ Error dropping index:', dropErr.message);
        }
      }
      
      // Recreate with sparse option
      console.log('🔄 Creating sparse unique index on insuranceNumber...');
      await collection.createIndex({ insuranceNumber: 1 }, { unique: true, sparse: true });
      console.log('✅ Sparse unique index created - allows multiple empty values');
    }
  } catch (err) {
    console.error('⚠️ Non-critical: Error managing indexes:', err.message);
  }
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
 * GET /clients - Client management page
 */
app.get('/clients', (req, res) => {
  res.render('clients');
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

/**
 * GET /roster - Client roster page
 */
app.get('/roster', (req, res) => {
  res.render('roster');
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
 * GET /api/bank-accounts - Get all bank accounts from all guards
 */
app.get('/api/bank-accounts', async (req, res) => {
  try {
    const guards = await GuardMaster.find({ isActive: true });
    
    // Aggregate all bank accounts from all guards
    const allBankAccounts = [];
    guards.forEach(guard => {
      if (guard.bankAccounts && Array.isArray(guard.bankAccounts)) {
        guard.bankAccounts.forEach(account => {
          if (account.active !== false) {
            allBankAccounts.push({
              _id: account._id || `${guard._id}-${account.accountNumber}`,
              guardId: guard._id,
              guardName: guard.guardName,
              accountHolderName: account.accountHolderName,
              bankName: account.bankName,
              sortCode: account.sortCode,
              accountNumber: account.accountNumber,
              isPrimary: account.isPrimary || false
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: allBankAccounts
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank accounts',
      error: error.message
    });
  }
});

/**
 * GET /api/clients - Get all clients (active and inactive)
 */
app.get('/api/clients', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const clients = await Client.find(query).sort({ name: 1 });
    res.json({
      success: true,
      data: clients,
      count: clients.length
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message
    });
  }
});

/**
 * POST /api/clients - Create new client
 */
app.post('/api/clients', async (req, res) => {
  try {
    const { name, contactPerson, phoneNumber, email, address, city, postalCode, country } = req.body;

    // Check if client already exists
    const existingClient = await Client.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this name already exists'
      });
    }

    const newClient = new Client({
      name,
      contactPerson,
      phoneNumber,
      email,
      address,
      city,
      postalCode,
      country: country || 'UK',
      active: true
    });

    await newClient.save();
    res.json({
      success: true,
      data: newClient,
      message: 'Client created successfully'
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating client',
      error: error.message
    });
  }
});

/**
 * PUT /api/clients/:id - Update client
 */
app.put('/api/clients/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }

    const { name, contactPerson, phoneNumber, email, address, city, postalCode, country, active } = req.body;

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      {
        name,
        contactPerson,
        phoneNumber,
        email,
        address,
        city,
        postalCode,
        country: country || 'UK',
        active: active !== undefined ? active : true
      },
      { new: true, runValidators: true }
    );

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: updatedClient,
      message: 'Client updated successfully'
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client',
      error: error.message
    });
  }
});

/**
 * DELETE /api/clients/:id - Delete client
 */
app.delete('/api/clients/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }

    const deletedClient = await Client.findByIdAndDelete(req.params.id);

    if (!deletedClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: deletedClient,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting client',
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
      associatedGuard,
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
      associatedGuard: associatedGuard || null,
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
      associatedGuard,
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
      associatedGuard: associatedGuard || null,
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
    let isNew = !monthlyHours;

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

    // Auto-sync with payroll and validate consistency
    try {
      await dataSynchronizer.syncMonthlyHoursToPayroll({
        guardId,
        year,
        month,
        totalHours,
        totalMinutes
      });

      // Validate data consistency
      const validation = await dataSynchronizer.validateDataConsistency(
        guardId,
        year,
        month
      );

      if (!validation.isConsistent) {
        // Create alerts for any issues found
        await dataSynchronizer.createConsistencyAlert(
          guardId,
          year,
          month,
          validation.issues
        );
      }
    } catch (syncError) {
      console.warn('Warning: Could not sync monthly hours to payroll:', syncError.message);
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Monthly hours created' : 'Monthly hours updated',
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
 * GET /api/monthly-hours/analysis - Get filtered analysis data for UI
 * MUST BE BEFORE /:id ROUTE to avoid Cast to ObjectId error
 */
app.get('/api/monthly-hours/analysis', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      guardId: req.query.guardId,
      clientId: req.query.clientId,
      status: req.query.status
    };

    const result = await monthlyAnalytics.getFilteredAnalysis(filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting filtered analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting filtered analysis',
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

// ==================== API ROUTES - MONTHLY ANALYTICS ====================

/**
 * GET /api/analytics/monthly - Get comprehensive monthly analytics
 */
app.get('/api/analytics/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    const analytics = await monthlyAnalytics.getMonthAnalytics(
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/guard/:guardId - Get guard-specific analytics
 */
app.get('/api/analytics/guard/:guardId', async (req, res) => {
  try {
    const { guardId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    const analytics = await monthlyAnalytics.getGuardAnalytics(
      guardId,
      parseInt(year),
      parseInt(month)
    );

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching guard analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching guard analytics',
      error: error.message
    });
  }
});

// ==================== API ROUTES - DATA SYNCHRONIZATION ====================

/**
 * POST /api/sync/payroll-to-monthly - Sync payroll data to monthly hours
 */
app.post('/api/sync/payroll-to-monthly', async (req, res) => {
  try {
    const payrollData = req.body;

    if (!payrollData.guardId || !payrollData.totalHours) {
      return res.status(400).json({
        success: false,
        message: 'Guard ID and total hours are required'
      });
    }

    const result = await dataSynchronizer.syncPayrollToMonthlyHours(payrollData);

    res.json(result);
  } catch (error) {
    console.error('Error syncing payroll to monthly hours:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing data',
      error: error.message
    });
  }
});

/**
 * POST /api/sync/monthly-to-payroll - Sync monthly hours to payroll
 */
app.post('/api/sync/monthly-to-payroll', async (req, res) => {
  try {
    const monthlyHoursData = req.body;

    if (!monthlyHoursData.guardId || !monthlyHoursData.year || !monthlyHoursData.month) {
      return res.status(400).json({
        success: false,
        message: 'Guard ID, year, and month are required'
      });
    }

    const result = await dataSynchronizer.syncMonthlyHoursToPayroll(monthlyHoursData);

    res.json(result);
  } catch (error) {
    console.error('Error syncing monthly hours to payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing data',
      error: error.message
    });
  }
});

/**
 * POST /api/sync/validate - Validate data consistency
 */
app.post('/api/sync/validate', async (req, res) => {
  try {
    const { guardId, year, month } = req.body;

    if (!guardId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Guard ID, year, and month are required'
      });
    }

    const validation = await dataSynchronizer.validateDataConsistency(
      guardId,
      parseInt(year),
      parseInt(month)
    );

    // Create alerts if issues found
    if (!validation.isConsistent && validation.issues.length > 0) {
      await dataSynchronizer.createConsistencyAlert(
        guardId,
        parseInt(year),
        parseInt(month),
        validation.issues
      );
    }

    res.json({
      success: true,
      validation: validation
    });
  } catch (error) {
    console.error('Error validating data:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating data',
      error: error.message
    });
  }
});

/**
 * GET /api/sync/status/:guardId - Get sync status for a guard
 */
app.get('/api/sync/status/:guardId', async (req, res) => {
  try {
    const { guardId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    const status = await dataSynchronizer.getSyncStatus(
      guardId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sync status',
      error: error.message
    });
  }
});

/**
 * POST /api/sync/bulk-month - Bulk sync entire month
 */
app.post('/api/sync/bulk-month', async (req, res) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    const results = await dataSynchronizer.bulkSyncMonth(
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk sync:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing month',
      error: error.message
    });
  }
});

/**
 * GET /api/monthly-hours/with-payroll - Get monthly hours with linked payroll data
 */
app.get('/api/monthly-hours/with-payroll', async (req, res) => {
  try {
    const { guardId, year, month } = req.query;

    if (!guardId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Guard ID, year, and month are required'
      });
    }

    // Get monthly hours
    const monthlyHours = await MonthlyHours.findOne({
      guardId,
      year: parseInt(year),
      month: parseInt(month)
    }).populate('guardId', 'guardName email');

    if (!monthlyHours) {
      return res.status(404).json({
        success: false,
        message: 'Monthly hours record not found'
      });
    }

    // Get payroll data for the same period
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const payrollData = await Payroll.find({
      guardId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).lean();

    // Get analytics for this guard
    const guardAnalytics = await monthlyAnalytics.getGuardAnalytics(
      guardId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: {
        monthlyHours: monthlyHours,
        payrollRecords: payrollData,
        analytics: guardAnalytics.success ? guardAnalytics.data : null,
        totalPayroll: payrollData.reduce((sum, p) => sum + ((p.pay1 || 0) + (p.pay2 || 0) + (p.pay3 || 0)), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching monthly hours with payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching data',
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
    let query = {};

    // Date filter
    if (req.query.date) {
      const date = new Date(req.query.date);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      query.createdAt = {
        $gte: date,
        $lt: nextDate
      };
    }

    // Client ID filter
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }

    const records = await Payroll.find(query)
      .populate({
        path: 'guardId',
        select: 'guardName email phoneNumber clientId'
      })
      .populate({
        path: 'hoursDistribution.associatedGuardId',
        select: 'guardName email phoneNumber',
        model: 'Payroll'
      })
      .sort({ createdAt: -1 });
    
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

    const records = await Payroll.find(query)
      .populate({
        path: 'guardId',
        select: 'guardName email phoneNumber clientId'
      })
      .populate({
        path: 'hoursDistribution.associatedGuardId',
        select: 'guardName email phoneNumber',
        model: 'Payroll'
      })
      .sort({ createdAt: -1 });

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

    const record = await Payroll.findById(req.params.id)
      .populate({
        path: 'guardId',
        select: 'guardName email phoneNumber clientId'
      })
      .populate({
        path: 'hoursDistribution.associatedGuardId',
        select: 'guardName email phoneNumber',
        model: 'Payroll'
      });
    
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
    console.log('POST /api/payroll - Received data:', JSON.stringify(req.body, null, 2));

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

    // Get guard details if guardId is provided
    let guard = null;
    if (req.body.guardId) {
      guard = await GuardMaster.findById(req.body.guardId);
    }

    const payrollData = {
      // Basic info
      clientName: req.body.clientName,
      guardName: req.body.guardName,
      guardId: req.body.guardId && req.body.guardId !== '' ? req.body.guardId : null,
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
      
      // Associated Guard Hour Distribution
      hoursDistribution: {
        primaryGuardHours: parseFloat(req.body.primaryGuardHours) || parseFloat(req.body.totalHours) || 0,
        associatedGuardHours: parseFloat(req.body.associatedGuardHours) || 0,
        associatedGuardId: req.body.associatedGuardId && req.body.associatedGuardId !== '' ? req.body.associatedGuardId : null,
        associatedGuardName: req.body.associatedGuardName || ''
      },
      
      // Legacy fields for compatibility
      pay1: parseFloat(req.body.pay1) || 0,
      pay2: parseFloat(req.body.pay2) || 0,
      pay3: parseFloat(req.body.pay3) || 0,
      accountNo: req.body.accountNo,
      sortCode: req.body.sortCode,
      accountHolderName: req.body.accountHolderName
    };

    console.log('Payroll Data to save:', JSON.stringify(payrollData, null, 2));

    // Check for duplicate insurance number if provided
    if (payrollData.insuranceNumber && payrollData.insuranceNumber.trim() !== '') {
      const duplicateRecord = await Payroll.findOne({
        insuranceNumber: payrollData.insuranceNumber.trim()
      });
      if (duplicateRecord) {
        return res.status(400).json({
          success: false,
          message: 'This insurance number is already in use. Please use a unique number.'
        });
      }
    } else {
      // Set to null if empty to avoid unique index issues
      payrollData.insuranceNumber = null;
    }

    const newRecord = new Payroll(payrollData);
    const savedRecord = await newRecord.save();

    // Auto-sync with monthly hours
    try {
      if (savedRecord.guardId && savedRecord.totalHours) {
        await dataSynchronizer.syncPayrollToMonthlyHours(savedRecord.toObject());
      }
    } catch (syncError) {
      console.warn('Warning: Could not sync payroll to monthly hours:', syncError.message);
      // Don't fail the entire request if sync fails
    }

    res.json({
      success: true,
      message: 'Payroll record created successfully',
      data: savedRecord
    });
  } catch (error) {
    console.error('Error creating payroll record:', error);
    
    // Handle MongoDB duplicate key error (E11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const value = error.keyValue?.[field];
      
      return res.status(400).json({
        success: false,
        message: `This ${field} "${value}" is already in use. Please use a unique value.`,
        errorCode: 'DUPLICATE_KEY'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating record',
      error: error.message
    });
  }
});

/**
 * POST /api/payroll/batch-create - Create multiple payroll records from Excel import
 */
app.post('/api/payroll/batch-create', async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records provided for batch creation'
      });
    }

    const savedRecords = [];
    const errors = [];

    // Process each record
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        
        // Parse bank accounts
        let bankAccounts = [];
        if (record.bankAccounts && Array.isArray(record.bankAccounts)) {
          bankAccounts = record.bankAccounts;
        } else if (record.accountHolderName || record.sortCode || record.accountNo) {
          // Build from flat fields if no structured data
          bankAccounts.push({
            accountHolderName: record.accountHolderName || '',
            bankName: '',
            sortCode: record.sortCode || '',
            accountNumber: record.accountNo || '',
            isPrimary: true,
            active: true
          });
        }

        const payrollData = {
          // Basic info
          clientName: record.clientName,
          guardName: record.guardName,
          guardId: record.guardId || null,
          siteName: record.siteName || '',
          
          // Visa information
          nationality: record.nationality || '',
          insuranceNumber: record.insuranceNumber || '',
          visaStatus: record.visaStatus || '',
          britishPassport: record.britishPassport || false,
          shareCode: record.shareCode || '',
          shareCodeExpiryDate: record.shareCodeExpiryDate || null,
          
          // Hours
          totalHours: parseFloat(record.totalHours) || 0,
          totalMinutes: parseInt(record.totalMinutes) || 0,
          
          // Rates
          payRate: parseFloat(record.payRate) || 0,
          chargeRate: parseFloat(record.chargeRate) || 0,
          
          // Bank accounts
          bankAccounts: bankAccounts,
          
          // Associated Guard Hour Distribution
          hoursDistribution: {
            primaryGuardHours: parseFloat(record.primaryGuardHours) || parseFloat(record.totalHours) || 0,
            associatedGuardHours: parseFloat(record.associatedGuardHours) || 0,
            associatedGuardId: record.associatedGuardId || null,
            associatedGuardName: record.associatedGuardName || ''
          },
          
          // Legacy fields for compatibility
          pay1: parseFloat(record.pay1) || 0,
          pay2: parseFloat(record.pay2) || 0,
          pay3: parseFloat(record.pay3) || 0,
          accountNo: record.accountNo || '',
          sortCode: record.sortCode || '',
          accountHolderName: record.accountHolderName || '',
          
          // Default status for batch imports
          status: 'pending'
        };

        const newRecord = new Payroll(payrollData);
        const savedRecord = await newRecord.save();
        savedRecords.push(savedRecord);

        // Auto-sync with monthly hours for each record
        try {
          if (savedRecord.guardId && savedRecord.totalHours) {
            await dataSynchronizer.syncPayrollToMonthlyHours(savedRecord.toObject());
          }
        } catch (syncError) {
          console.warn(`Warning: Could not sync record ${i + 1} to monthly hours:`, syncError.message);
          // Don't fail if sync fails - continue with next record
        }
      } catch (recordError) {
        console.error(`Error saving record ${i + 1}:`, recordError);
        errors.push({
          rowNumber: i + 1,
          error: recordError.message
        });
      }
    }

    res.json({
      success: errors.length === 0,
      message: `Successfully imported ${savedRecords.length} records${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      count: savedRecords.length,
      data: savedRecords,
      errors: errors
    });
  } catch (error) {
    console.error('Error in batch create:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating batch records',
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

    // Build update data only for fields that are provided
    const updateData = {};
    
    // Handle optional fields - only set if provided
    if (req.body.clientName !== undefined) updateData.clientName = req.body.clientName;
    if (req.body.clientId !== undefined) updateData.clientId = req.body.clientId && req.body.clientId !== '' ? req.body.clientId : null;
    if (req.body.guardName !== undefined) updateData.guardName = req.body.guardName;
    if (req.body.guardId !== undefined) updateData.guardId = req.body.guardId && req.body.guardId !== '' ? req.body.guardId : null;
    if (req.body.siteName !== undefined) updateData.siteName = req.body.siteName;
    
    // Visa information
    if (req.body.nationality !== undefined) updateData.nationality = req.body.nationality;
    if (req.body.insuranceNumber !== undefined) updateData.insuranceNumber = req.body.insuranceNumber;
    if (req.body.visaStatus !== undefined) updateData.visaStatus = req.body.visaStatus;
    if (req.body.britishPassport !== undefined) updateData.britishPassport = req.body.britishPassport === 'true' || req.body.britishPassport === true;
    if (req.body.shareCode !== undefined) updateData.shareCode = req.body.shareCode;
    if (req.body.shareCodeExpiryDate !== undefined) updateData.shareCodeExpiryDate = req.body.shareCodeExpiryDate;
    
    // Hours
    if (req.body.totalHours !== undefined) updateData.totalHours = parseFloat(req.body.totalHours) || 0;
    if (req.body.totalMinutes !== undefined) updateData.totalMinutes = parseInt(req.body.totalMinutes) || 0;
    
    // Rates
    if (req.body.payRate !== undefined) updateData.payRate = parseFloat(req.body.payRate) || 0;
    if (req.body.chargeRate !== undefined) updateData.chargeRate = parseFloat(req.body.chargeRate) || 0;
    
    // Bank accounts
    if (req.body.bankAccounts !== undefined) {
      updateData.bankAccounts = typeof req.body.bankAccounts === 'string' ? JSON.parse(req.body.bankAccounts) : req.body.bankAccounts;
    }
    
    // Associated Guard Hour Distribution - preserve existing data
    if (req.body.primaryGuardHours !== undefined || req.body.associatedGuardHours !== undefined || req.body.associatedGuardId !== undefined || req.body.associatedGuardName !== undefined) {
      // Fetch existing record to preserve hoursDistribution
      const existingRecord = await Payroll.findById(req.params.id);
      
      // Start with existing hoursDistribution or create new object
      updateData.hoursDistribution = existingRecord && existingRecord.hoursDistribution ? { ...existingRecord.hoursDistribution.toObject ? existingRecord.hoursDistribution.toObject() : existingRecord.hoursDistribution } : {};
      
      // Only update provided fields
      if (req.body.primaryGuardHours !== undefined) updateData.hoursDistribution.primaryGuardHours = parseFloat(req.body.primaryGuardHours) || 0;
      if (req.body.associatedGuardHours !== undefined) updateData.hoursDistribution.associatedGuardHours = parseFloat(req.body.associatedGuardHours) || 0;
      if (req.body.associatedGuardId !== undefined) updateData.hoursDistribution.associatedGuardId = req.body.associatedGuardId && req.body.associatedGuardId !== '' ? req.body.associatedGuardId : null;
      if (req.body.associatedGuardName !== undefined) updateData.hoursDistribution.associatedGuardName = req.body.associatedGuardName || '';
    }
    
    // Legacy fields for compatibility
    if (req.body.pay1 !== undefined) updateData.pay1 = parseFloat(req.body.pay1) || 0;
    if (req.body.pay2 !== undefined) updateData.pay2 = parseFloat(req.body.pay2) || 0;
    if (req.body.pay3 !== undefined) updateData.pay3 = parseFloat(req.body.pay3) || 0;
    if (req.body.accountNo !== undefined) updateData.accountNo = req.body.accountNo;
    if (req.body.sortCode !== undefined) updateData.sortCode = req.body.sortCode;
    if (req.body.accountHolderName !== undefined) updateData.accountHolderName = req.body.accountHolderName;
    
    // Status update
    if (req.body.status !== undefined) updateData.status = req.body.status;
    
    updateData.updatedAt = new Date();

    const updatedRecord = await Payroll.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
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

// ==================== API ROUTES - ROSTER ====================

/**
 * GET /api/roster - Get roster data for a date range (defaults to current week)
 */
app.get('/api/roster', async (req, res) => {
  try {
    const parseDate = (value) => {
      if (!value || typeof value !== 'string') return null;
      const parts = value.split('-').map(Number);
      if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    const toDateString = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const now = new Date();
    const startInput = parseDate(req.query.start);
    const endInput = parseDate(req.query.end);

    // Default to current week (Monday-Sunday)
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - diffToMonday);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 6);

    const startDate = startInput || defaultStart;
    const endDate = endInput || defaultEnd;

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const startStr = toDateString(startDate);
    const endStr = toDateString(endDate);

    const rosterYear = startDate.getFullYear();
    const rosterMonth = startDate.getMonth() + 1;
    const monthStart = new Date(rosterYear, rosterMonth - 1, 1);
    const monthEnd = new Date(rosterYear, rosterMonth, 0, 23, 59, 59, 999);

    const [clients, guards] = await Promise.all([
      Client.find({}).select('name').lean(),
      GuardMaster.find({ isActive: { $ne: false } }).select('guardName associatedGuard').lean()
    ]);

    let rosterRows = await RosterRow.find({ active: { $ne: false } })
      .sort({ clientName: 1, siteName: 1, guardName: 1 })
      .lean();

    const displayRows = rosterRows.filter(row =>
      (row.clientId && row.clientId.toString()) ||
      (row.clientName && row.clientName.trim())
    );

    const rowIdSet = new Set(displayRows.map(r => r._id.toString()));

    const [rosterEntries, monthlyTargets] = await Promise.all([
      RosterEntry.find({ rosterRowId: { $in: Array.from(rowIdSet) }, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
      RosterMonthlyTarget.find({ rosterRowId: { $in: Array.from(rowIdSet) }, year: rosterYear, month: rosterMonth }).lean()
    ]);

    const monthlyTargetMap = new Map(
      monthlyTargets.map(target => [target.rosterRowId.toString(), target])
    );

    const entriesByRow = new Map();
    let totalHoursRange = 0;
    let confirmedShifts = 0;
    let unconfirmedShifts = 0;
    let inProgressShifts = 0;
    let incompleteShifts = 0;
    let unassignedEntryShifts = 0;

    const statusPriority = ['in-progress', 'incomplete', 'unconfirmed', 'unassigned', 'confirmed'];
    const normalizeStatus = (value) => statusPriority.includes(value) ? value : 'unconfirmed';
    const resolveEntryStatus = (entry) => {
      const fallback = normalizeStatus(entry.status || 'unconfirmed');
      const statuses = [];
      const primaryHours = entry.primary?.hours || 0;
      if (primaryHours > 0) {
        statuses.push(normalizeStatus(entry.primary?.status || fallback));
      }
      (entry.associated || []).forEach(assoc => {
        if ((assoc.hours || 0) > 0) {
          statuses.push(normalizeStatus(assoc.status || fallback));
        }
      });
      if (statuses.length === 0) return fallback;
      for (const status of statusPriority) {
        if (statuses.includes(status)) {
          return status;
        }
      }
      return fallback;
    };

    rosterEntries.forEach(entry => {
      const rowId = entry.rosterRowId.toString();
      if (!rowIdSet.has(rowId)) {
        return;
      }

      const primaryHours = entry.primary?.hours || 0;
      const totalHours = entry.totalHours || 0;
      const entryStatus = resolveEntryStatus(entry);

      if (!entriesByRow.has(rowId)) {
        entriesByRow.set(rowId, {
          byDate: {},
          primaryHoursBeforeRange: 0,
          primaryHoursMonth: 0
        });
      }

      const bucket = entriesByRow.get(rowId);
      bucket.primaryHoursMonth += primaryHours;

      if (entry.dateString < startStr) {
        bucket.primaryHoursBeforeRange += primaryHours;
      }

      if (entry.dateString >= startStr && entry.dateString <= endStr) {
        bucket.byDate[entry.dateString] = {
          primary: entry.primary || {},
          associated: entry.associated || [],
          totalHours: totalHours,
          notes: entry.notes || '',
          status: entryStatus
        };
        totalHoursRange += totalHours;
        if (totalHours > 0) {
          if (entryStatus === 'confirmed') {
            confirmedShifts += 1;
          } else if (entryStatus === 'unconfirmed') {
            unconfirmedShifts += 1;
          } else if (entryStatus === 'in-progress') {
            inProgressShifts += 1;
          } else if (entryStatus === 'incomplete') {
            incompleteShifts += 1;
          } else if (entryStatus === 'unassigned') {
            unassignedEntryShifts += 1;
          } else {
            unconfirmedShifts += 1;
          }
        }
      }
    });

    const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalCells = displayRows.length * dayCount;
    const assignedCells = confirmedShifts + unconfirmedShifts + inProgressShifts + incompleteShifts + unassignedEntryShifts;
    const emptyCells = displayRows.length === 0 ? 0 : Math.max(totalCells - assignedCells, 0);
    const unassignedShifts = emptyCells + unassignedEntryShifts;

    const rows = displayRows.map(row => {
      const rid = row._id.toString();
      const entryData = entriesByRow.get(rid) || {
        byDate: {},
        primaryHoursBeforeRange: 0,
        primaryHoursMonth: 0
      };

      const target = monthlyTargetMap.get(rid);
      const associatedTargets = target?.associated || [];
      const monthlyPrimary = target?.primaryHours || 0;
      const monthlyAssociatedTotal = associatedTargets.reduce((sum, item) => sum + (item.hours || 0), 0);
      const monthlyTotal = typeof target?.totalHours === 'number'
        ? target.totalHours
        : monthlyPrimary + monthlyAssociatedTotal;

      return {
        rowId: rid,
        sid: rid.slice(-4).toUpperCase(),
        clientName: row.clientName || '',
        clientId: row.clientId || null,
        siteName: row.siteName || '',
        guardName: row.guardName || '',
        guardId: row.guardId || null,
        totalHoursTarget: monthlyTotal || 0,
        primaryTargetHours: monthlyPrimary || 0,
        monthlyAssociatedTargets: associatedTargets,
        primaryHoursBeforeRange: entryData.primaryHoursBeforeRange,
        primaryHoursMonth: entryData.primaryHoursMonth,
        rosterByDate: entryData.byDate
      };
    });

    res.json({
      success: true,
      data: {
        start: startStr,
        end: endStr,
        totalHours: totalHoursRange,
        confirmedShifts,
        unconfirmedShifts,
        inProgressShifts,
        incompleteShifts,
        unassignedShifts,
        clients: clients,
        guards: guards,
        rows
      }
    });
  } catch (error) {
    console.error('Error fetching roster data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roster data',
      error: error.message
    });
  }
});

/**
 * POST /api/roster/rows - Create roster row
 */
app.post('/api/roster/rows', async (req, res) => {
  try {
    const { clientId, clientName, siteName, guardId, guardName } = req.body;

    let resolvedClientName = clientName || '';
    let resolvedGuardName = guardName || '';
    let resolvedClientId = clientId || null;
    let resolvedGuardId = guardId || null;

    if (resolvedClientId) {
      const client = await Client.findById(resolvedClientId).lean();
      if (client) {
        resolvedClientName = client.name || resolvedClientName;
      }
    }

    if (resolvedGuardId) {
      const guard = await GuardMaster.findById(resolvedGuardId).lean();
      if (guard) {
        resolvedGuardName = guard.guardName || resolvedGuardName;
      }
    }

    const row = new RosterRow({
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      siteName: siteName || '',
      guardId: resolvedGuardId,
      guardName: resolvedGuardName,
      active: true
    });

    await row.save();

    res.json({
      success: true,
      message: 'Roster row created',
      data: row
    });
  } catch (error) {
    console.error('Error creating roster row:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating roster row',
      error: error.message
    });
  }
});

/**
 * PUT /api/roster/rows/:id - Update roster row
 */
app.put('/api/roster/rows/:id', async (req, res) => {
  try {
    const { clientId, clientName, siteName, guardId, guardName, active } = req.body;

    let updateData = {
      siteName: siteName,
      active: active
    };

    if (clientId !== undefined) {
      updateData.clientId = clientId || null;
      if (clientId) {
        const client = await Client.findById(clientId).lean();
        if (client) updateData.clientName = client.name || '';
      } else {
        updateData.clientName = clientName || '';
      }
    } else if (clientName !== undefined) {
      updateData.clientName = clientName;
    }

    if (guardId !== undefined) {
      updateData.guardId = guardId || null;
      if (guardId) {
        const guard = await GuardMaster.findById(guardId).lean();
        if (guard) updateData.guardName = guard.guardName || '';
      } else {
        updateData.guardName = guardName || '';
      }
    } else if (guardName !== undefined) {
      updateData.guardName = guardName;
    }

    const row = await RosterRow.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Roster row not found'
      });
    }

    res.json({
      success: true,
      message: 'Roster row updated',
      data: row
    });
  } catch (error) {
    console.error('Error updating roster row:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating roster row',
      error: error.message
    });
  }
});

/**
 * POST /api/roster/assign - Create/update roster entry
 */
app.post('/api/roster/assign', async (req, res) => {
  try {
    const {
      rowId,
      payrollId,
      date,
      primaryHours,
      associated,
      notes,
      status,
      primaryStatus,
      primaryChargeRate
    } = req.body;
    const rosterRowId = rowId || payrollId;

    if (!rosterRowId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rowId, date'
      });
    }

    const rosterRow = await RosterRow.findById(rosterRowId);
    if (!rosterRow) {
      return res.status(404).json({
        success: false,
        message: 'Roster row not found'
      });
    }

    const dateObj = new Date(date);
    if (Number.isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date'
      });
    }

    const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

    const statusOptions = ['confirmed', 'unconfirmed', 'unassigned', 'in-progress', 'incomplete'];
    const normalizeStatus = (value) => statusOptions.includes(value) ? value : 'unconfirmed';

    const primaryHoursValue = parseFloat(primaryHours) || 0;
    const primaryStatusValue = normalizeStatus(primaryStatus || status);
    const primaryChargeRateValue = parseFloat(primaryChargeRate) || 0;

    const associatedAssignments = Array.isArray(associated)
      ? associated
          .map(item => ({
            guardId: item.guardId || null,
            guardName: item.guardName || '',
            hours: parseFloat(item.hours) || 0,
            status: normalizeStatus(item.status),
            chargeRate: parseFloat(item.chargeRate) || 0
          }))
          .filter(item => item.hours > 0)
      : [];

    const totalHoursValue = primaryHoursValue + associatedAssignments.reduce((sum, item) => sum + (item.hours || 0), 0);

    if (totalHoursValue <= 0) {
      await RosterEntry.findOneAndDelete({ rosterRowId, dateString });
      return res.json({
        success: true,
        message: 'Roster entry cleared',
        data: null
      });
    }

    const guardIds = [];
    if (rosterRow.guardId) {
      guardIds.push(rosterRow.guardId.toString());
    }
    associatedAssignments.forEach(item => {
      if (item.guardId) {
        guardIds.push(item.guardId.toString());
      }
    });
    const uniqueGuardIds = [...new Set(guardIds)];

    const payrollRates = uniqueGuardIds.length > 0
      ? await Payroll.find({ guardId: { $in: uniqueGuardIds } })
        .sort({ createdAt: -1 })
        .select('guardId payRate chargeRate')
        .lean()
      : [];

    const payRateMap = new Map();
    const chargeRateMap = new Map();
    payrollRates.forEach(record => {
      const gid = record.guardId ? record.guardId.toString() : null;
      if (!gid || payRateMap.has(gid)) return;
      payRateMap.set(gid, parseFloat(record.payRate) || 0);
      chargeRateMap.set(gid, parseFloat(record.chargeRate) || 0);
    });

    const primaryPayRate = rosterRow.guardId ? (payRateMap.get(rosterRow.guardId.toString()) || 0) : 0;
    const primaryPayAmount = primaryHoursValue * primaryPayRate;
    const primaryChargeAmount = primaryHoursValue * primaryChargeRateValue;

    const enrichedAssociated = associatedAssignments.map(item => {
      const rate = item.guardId ? (payRateMap.get(item.guardId.toString()) || 0) : 0;
      const chargeRateValue = item.chargeRate || 0;
      return {
        guardId: item.guardId,
        guardName: item.guardName || '',
        hours: item.hours,
        status: item.status,
        payRate: rate,
        payAmount: item.hours * rate,
        chargeRate: chargeRateValue,
        chargeAmount: item.hours * chargeRateValue
      };
    });

    const statusCandidates = [];
    if (primaryHoursValue > 0) statusCandidates.push(primaryStatusValue);
    enrichedAssociated.forEach(item => {
      if (item.hours > 0) statusCandidates.push(item.status);
    });
    const statusPriority = ['in-progress', 'incomplete', 'unconfirmed', 'unassigned', 'confirmed'];
    const entryStatus = statusCandidates.length === 0
      ? normalizeStatus(status)
      : statusPriority.find(item => statusCandidates.includes(item)) || normalizeStatus(status);
    const totalChargeValue = primaryChargeAmount + enrichedAssociated.reduce((sum, item) => sum + (item.chargeAmount || 0), 0);

    const updateData = {
      rosterRowId: rosterRowId,
      payrollId: null,
      status: entryStatus,
      date: dateObj,
      dateString: dateString,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      primary: {
        guardId: rosterRow.guardId || null,
        guardName: rosterRow.guardName || '',
        hours: primaryHoursValue,
        status: primaryStatusValue,
        payRate: primaryPayRate,
        payAmount: primaryPayAmount,
        chargeRate: primaryChargeRateValue,
        chargeAmount: primaryChargeAmount
      },
      associated: enrichedAssociated,
      totalHours: totalHoursValue,
      totalCharge: totalChargeValue,
      notes: notes || ''
    };

    const entry = await RosterEntry.findOneAndUpdate(
      { rosterRowId, dateString },
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Roster entry saved',
      data: entry
    });
  } catch (error) {
    console.error('Error saving roster entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving roster entry',
      error: error.message
    });
  }
});

/**
 * POST /api/roster/delete - Delete roster entry
 */
app.post('/api/roster/delete', async (req, res) => {
  try {
    const { rowId, payrollId, date } = req.body;
    const rosterRowId = rowId || payrollId;

    if (!rosterRowId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rowId, date'
      });
    }

    const deleted = await RosterEntry.findOneAndDelete({
      rosterRowId,
      dateString: date
    });

    res.json({
      success: true,
      message: deleted ? 'Roster entry deleted' : 'Roster entry not found'
    });
  } catch (error) {
    console.error('Error deleting roster entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting roster entry',
      error: error.message
    });
  }
});

/**
 * POST /api/roster/monthly-target - Create/update monthly roster target
 */
app.post('/api/roster/monthly-target', async (req, res) => {
  try {
    const { rowId, payrollId, year, month, primaryHours, associated, notes } = req.body;
    const rosterRowId = rowId || payrollId;

    if (!rosterRowId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rowId, year, month'
      });
    }

    const primaryHoursValue = parseFloat(primaryHours) || 0;
    const associatedAssignments = Array.isArray(associated)
      ? associated
          .map(item => ({
            guardId: item.guardId || null,
            guardName: item.guardName || '',
            hours: parseFloat(item.hours) || 0
          }))
          .filter(item => item.hours > 0)
      : [];

    const totalHoursValue = primaryHoursValue + associatedAssignments.reduce((sum, item) => sum + (item.hours || 0), 0);

    if (totalHoursValue <= 0) {
      await RosterMonthlyTarget.findOneAndDelete({ rosterRowId, year, month });
      return res.json({
        success: true,
        message: 'Monthly target cleared'
      });
    }

    const target = await RosterMonthlyTarget.findOneAndUpdate(
      { rosterRowId, year, month },
      {
        rosterRowId,
        year,
        month,
        primaryHours: primaryHoursValue,
        associated: associatedAssignments,
        totalHours: totalHoursValue,
        notes: notes || ''
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Monthly target saved',
      data: target
    });
  } catch (error) {
    console.error('Error saving monthly target:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving monthly target',
      error: error.message
    });
  }
});

/**
 * POST /api/roster/row-payroll-pdf - Generate payroll PDF for a roster row within a date range
 */
app.post('/api/roster/row-payroll-pdf', async (req, res) => {
  try {
    const { rowId, start, end } = req.body;

    const parseDate = (value) => {
      if (!value || typeof value !== 'string') return null;
      const parts = value.split('-').map(Number);
      if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    if (!rowId || !start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rowId, start, end'
      });
    }

    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range'
      });
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const rosterRow = await RosterRow.findById(rowId).lean();
    if (!rosterRow) {
      return res.status(404).json({
        success: false,
        message: 'Roster row not found'
      });
    }

    const entries = await RosterEntry.find({
      rosterRowId: rowId,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    if (!entries || entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No roster entries found for this period'
      });
    }

    const guardIds = new Set();
    if (rosterRow.guardId) {
      guardIds.add(rosterRow.guardId.toString());
    }
    entries.forEach(entry => {
      if (entry.primary?.guardId) {
        guardIds.add(entry.primary.guardId.toString());
      }
      (entry.associated || []).forEach(assoc => {
        if (assoc.guardId) guardIds.add(assoc.guardId.toString());
      });
    });

    const payrollRates = guardIds.size > 0
      ? await Payroll.find({ guardId: { $in: Array.from(guardIds) } })
        .sort({ createdAt: -1 })
        .select('guardId payRate chargeRate')
        .lean()
      : [];

    const payRateMap = new Map();
    const chargeRateMap = new Map();
    payrollRates.forEach(record => {
      const gid = record.guardId ? record.guardId.toString() : null;
      if (!gid || payRateMap.has(gid)) return;
      payRateMap.set(gid, parseFloat(record.payRate) || 0);
      chargeRateMap.set(gid, parseFloat(record.chargeRate) || 0);
    });

    let primaryHours = 0;
    let primaryPay = 0;
    let primaryPayRate = 0;
    let associatedHours = 0;
    let associatedPay = 0;
    const associatedNames = new Set();
    const associatedTotals = new Map();

    entries.forEach(entry => {
      const pHours = entry.primary?.hours || 0;
      const fallbackPrimaryRate = entry.primary?.guardId
        ? (payRateMap.get(entry.primary.guardId.toString()) || 0)
        : 0;
      const pRate = entry.primary?.payRate || fallbackPrimaryRate;
      const pPay = entry.primary?.payAmount || (pHours * pRate);

      primaryHours += pHours;
      primaryPay += pPay;
      if (!primaryPayRate && pRate > 0) primaryPayRate = pRate;

      (entry.associated || []).forEach(assoc => {
        const hours = assoc.hours || 0;
        if (hours <= 0) return;
        const fallbackRate = assoc.guardId
          ? (payRateMap.get(assoc.guardId.toString()) || 0)
          : 0;
        const rate = assoc.payRate || fallbackRate;
        const pay = assoc.payAmount || (hours * rate);

        associatedHours += hours;
        associatedPay += pay;
        if (assoc.guardName) associatedNames.add(assoc.guardName);

        const key = assoc.guardId ? assoc.guardId.toString() : assoc.guardName || 'associated';
        const current = associatedTotals.get(key) || {
          guardName: assoc.guardName || 'Associated Guard',
          hours: 0,
          payRate: rate,
          payAmount: 0
        };
        current.hours += hours;
        current.payAmount += pay;
        if (!current.payRate && rate > 0) current.payRate = rate;
        associatedTotals.set(key, current);
      });
    });

    if (!primaryPayRate && primaryHours > 0) {
      primaryPayRate = primaryPay / primaryHours;
    }

    const totalHoursDecimal = primaryHours + associatedHours;
    let totalHours = Math.floor(totalHoursDecimal);
    let totalMinutes = Math.round((totalHoursDecimal - totalHours) * 60);
    if (totalMinutes === 60) {
      totalHours += 1;
      totalMinutes = 0;
    }

    const totalPay = primaryPay + associatedPay;
    const associatedNameLabel = associatedNames.size > 0
      ? Array.from(associatedNames).join(', ')
      : '';

    const payrollData = {
      clientName: rosterRow.clientName || '',
      siteName: rosterRow.siteName || '',
      guardName: rosterRow.guardName || '',
      guardId: rosterRow.guardId || null,
      payRate: primaryPayRate || (rosterRow.guardId ? (payRateMap.get(rosterRow.guardId.toString()) || 0) : 0),
      chargeRate: rosterRow.guardId ? (chargeRateMap.get(rosterRow.guardId.toString()) || 0) : 0,
      totalHours,
      totalMinutes,
      hoursDistribution: {
        primaryGuardHours: primaryHours,
        associatedGuardHours: associatedHours,
        associatedGuardId: { guardName: associatedNameLabel }
      },
      pay1: totalPay,
      totalPayOverride: totalPay,
      primaryPayAmount: primaryPay,
      associatedPayAmount: associatedPay,
      associatedPayDetails: Array.from(associatedTotals.values())
    };

    const pdfBuffer = await pdfGenerator.generatePayrollPDF(payrollData, 1);
    const safeName = (rosterRow.guardName || 'guard').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-${safeName}-${start}-to-${end}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating roster payroll PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating roster payroll PDF',
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
 * GET /api/export/payroll-pdf/:id - Export single record as enhanced PDF
 */
app.get('/api/export/payroll-pdf/:id', async (req, res) => {
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

// Setup payroll routes
setupPayrollRoutes(app, Payroll, mongoose);

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

// ==================== MAINTENANCE ROUTES ====================

/**
 * GET /api/maintenance/monthly-hours-count - Check monthly hours data count
 */
app.get('/api/maintenance/monthly-hours-count', async (req, res) => {
  try {
    const total = await MonthlyHours.countDocuments();
    const lastAdded = await MonthlyHours.findOne({}).sort({ createdAt: -1 }).lean();
    const last30Days = await MonthlyHours.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      success: true,
      data: {
        totalMonthlyHours: total,
        hoursInLast30Days: last30Days,
        lastAdded: lastAdded,
        sampleRecords: await MonthlyHours.find({})
          .limit(5)
          .populate('guardId', 'guardName')
          .sort({ createdAt: -1 })
          .lean()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking monthly hours data',
      error: error.message
    });
  }
});

/**
 * POST /api/maintenance/fix-insurance-index - Fix the insuranceNumber index
 */
app.post('/api/maintenance/fix-insurance-index', async (req, res) => {
  try {
    const collection = mongoose.connection.collection('payrolls');
    
    // Drop the old index if it exists
    try {
      await collection.dropIndex('insuranceNumber_1');
      console.log('✅ Old insuranceNumber index dropped');
    } catch (dropErr) {
      if (!dropErr.message.includes('index not found')) {
        console.error('⚠️ Error dropping index:', dropErr.message);
      }
    }
    
    // Recreate with sparse option
    await collection.createIndex({ insuranceNumber: 1 }, { unique: true, sparse: true });
    console.log('✅ Sparse unique index created');
    
    res.json({
      success: true,
      message: 'Insurance number index fixed successfully. The index now allows multiple empty values.'
    });
  } catch (error) {
    console.error('Error fixing index:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing index',
      error: error.message
    });
  }
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