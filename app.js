require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

// Import models and utilities
const Payroll = require('./models/Payroll');
const pdfGenerator = require('./utils/pdfGenerator');
const excelParser = require('./utils/excelParser');

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

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

// ==================== VALIDATION MIDDLEWARE ====================

const payrollValidationRules = () => {
  return [
    body('clientName').trim().notEmpty().withMessage('Client Name is required'),
    body('guardName').trim().notEmpty().withMessage('Guard Name is required'),
    body('totalHours').isFloat({ min: 0 }).withMessage('Total Hours must be a positive number'),
    body('payRate').isFloat({ min: 0 }).withMessage('Pay Rate must be a positive number'),
    body('chargeRate').isFloat({ min: 0 }).withMessage('Charge Rate must be a positive number'),
    body('pay1').isFloat({ min: 0 }).withMessage('Pay 1 must be a positive number'),
    body('pay2').isFloat({ min: 0 }).withMessage('Pay 2 must be a positive number'),
    body('pay3').isFloat({ min: 0 }).withMessage('Pay 3 must be a positive number'),
    body('accountNo').trim().notEmpty().withMessage('Account Number is required'),
    body('sortCode').trim().notEmpty().withMessage('Sort Code is required'),
    body('accountHolderName').trim().notEmpty().withMessage('Account Holder Name is required')
  ];
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

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

    // Client name filter
    if (req.query.clientName) {
      query.clientName = { $regex: req.query.clientName, $options: 'i' };
    }

    // Guard name filter
    if (req.query.guardName) {
      query.guardName = { $regex: req.query.guardName, $options: 'i' };
    }

    // Hours range filter
    if (req.query.minHours || req.query.maxHours) {
      query.totalHours = {};
      if (req.query.minHours) {
        query.totalHours.$gte = parseFloat(req.query.minHours);
      }
      if (req.query.maxHours) {
        query.totalHours.$lte = parseFloat(req.query.maxHours);
      }
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
    const payrollData = {
      clientName: req.body.clientName,
      guardName: req.body.guardName,
      totalHours: parseFloat(req.body.totalHours),
      payRate: parseFloat(req.body.payRate),
      chargeRate: parseFloat(req.body.chargeRate),
      pay1: parseFloat(req.body.pay1),
      pay2: parseFloat(req.body.pay2),
      pay3: parseFloat(req.body.pay3),
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
      clientName: req.body.clientName,
      guardName: req.body.guardName,
      totalHours: parseFloat(req.body.totalHours),
      payRate: parseFloat(req.body.payRate),
      chargeRate: parseFloat(req.body.chargeRate),
      pay1: parseFloat(req.body.pay1),
      pay2: parseFloat(req.body.pay2),
      pay3: parseFloat(req.body.pay3),
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

    // Create unique filename
    const timestamp = Date.now();
    const filename = `payroll_${String(payNumber).padStart(2, '0')}_${payrollData.guardName}_${timestamp}.pdf`;
    const filepath = path.join(__dirname, 'public/uploads', filename);

    // Generate PDF
    await pdfGenerator.generatePayrollPDF(payrollData, payNumber, filepath);

    // Read file and send
    const fileStream = fs.createReadStream(filepath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    fileStream.pipe(res);

    // Clean up file after sending
    res.on('finish', () => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
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

    const filename = `payroll_export_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, 'public/uploads', filename);

    // Generate bulk PDF
    await pdfGenerator.generateBulkPayrollPDF(records, filepath);

    // Read file and send
    const fileStream = fs.createReadStream(filepath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    fileStream.pipe(res);

    // Clean up file after sending
    res.on('finish', () => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
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

    const filename = `payroll_export_${Date.now()}.xlsx`;
    const filepath = path.join(__dirname, 'public/uploads', filename);

    // Generate Excel file
    const result = excelParser.generateExcelFromData(records, filepath);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error generating Excel file',
        error: result.error
      });
    }

    // Read file and send
    const fileStream = fs.createReadStream(filepath);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    fileStream.pipe(res);

    // Clean up file after sending
    res.on('finish', () => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting Excel',
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
