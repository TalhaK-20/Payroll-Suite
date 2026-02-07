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
