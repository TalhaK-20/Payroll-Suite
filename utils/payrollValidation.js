// Backend Validation Rules and Route Handlers for Enhanced Payroll System
// This module contains all validation rules and route handlers for the new visa/immigration features

const { body, validationResult } = require('express-validator');

/**
 * VALIDATION RULES FOR PAYROLL RECORDS
 * Enhanced with visa, immigration, and multiple bank account support
 */
const payrollValidationRules = () => {
  return [
    // Guard Basic Information
    body('guardName')
      .trim()
      .notEmpty().withMessage('Guard Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Guard Name must be between 2 and 100 characters'),
    
    body('nationality')
      .trim()
      .notEmpty().withMessage('Nationality is required')
      .isLength({ min: 2, max: 50 }).withMessage('Nationality must be valid'),
    
    body('insuranceNumber')
      .trim()
      .notEmpty().withMessage('Insurance Number is required')
      .matches(/^[A-Z]{2}\s\d{3}\s\d{3}\s[A-Z]$/).withMessage('Insurance Number format must be: AB 123 456 C'),
    
    // Site information (optional)
    body('siteName')
      .trim()
      .optional({ checkFalsy: true })
      .isLength({ max: 100 }).withMessage('Site Name is too long'),
    
    // Client Information
    body('clientName')
      .trim()
      .notEmpty().withMessage('Client Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Client Name must be valid'),
    
    // Visa Information
    body('visaStatus')
      .notEmpty().withMessage('Visa Status is required')
      .isIn([
        'Student',
        'Skilled Worker',
        'PSW',
        'Dependent/Spouse',
        'Permanent Resident',
        'Settled Status',
        'Pre-Settled Status',
        'Refugee/Asylum'
      ]).withMessage('Invalid Visa Status selected'),
    
    body('britishPassport')
      .optional()
      .isBoolean().withMessage('British Passport must be true or false'),
    
    // Conditional: Share Code (required if NOT British Passport)
    body('shareCode')
      .custom((value, { req }) => {
        if (req.body.britishPassport === false || req.body.britishPassport === 'false') {
          if (!value || value.trim().length === 0) {
            throw new Error('Share Code is required for non-British passport holders');
          }
        }
        return true;
      }),
    
    // Conditional: Share Code Expiry Date (required if NOT British Passport)
    body('shareCodeExpiryDate')
      .custom((value, { req }) => {
        if (req.body.britishPassport === false || req.body.britishPassport === 'false') {
          if (!value) {
            throw new Error('Share Code Expiry Date is required for non-British passport holders');
          }
          // Validate it's a valid date
          if (isNaN(Date.parse(value))) {
            throw new Error('Share Code Expiry Date must be a valid date');
          }
        }
        return true;
      }),
    
    // Working Hours
    body('totalHours')
      .notEmpty().withMessage('Total Hours is required')
      .isFloat({ min: 0 }).withMessage('Total Hours must be a positive number'),
    
    body('totalMinutes')
      .notEmpty().withMessage('Total Minutes is required')
      .isInt({ min: 0, max: 59 }).withMessage('Total Minutes must be between 0 and 59'),
    
    // Rates
    body('chargeRate')
      .notEmpty().withMessage('Charge Rate is required')
      .isFloat({ min: 0 }).withMessage('Charge Rate must be a positive number'),
    
    body('payRate')
      .notEmpty().withMessage('Pay Rate is required')
      .isFloat({ min: 0 }).withMessage('Pay Rate must be a positive number'),
    
    // Legacy fields (for backward compatibility)
    body('pay1')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Pay 1 must be a positive number'),
    
    body('pay2')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Pay 2 must be a positive number'),
    
    body('pay3')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Pay 3 must be a positive number'),
    
    body('accountNo')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 20 }).withMessage('Account Number is too long'),
    
    body('sortCode')
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^\d{2}-\d{2}-\d{2}$/).withMessage('Sort code format must be: XX-XX-XX'),
    
    body('accountHolderName')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 100 }).withMessage('Account Holder Name is too long')
  ];
};

/**
 * VALIDATION RULES FOR BANK ACCOUNTS ARRAY
 * Validates multiple bank account entries
 */
const bankAccountsValidationRules = () => {
  return [
    body('bankAccounts')
      .custom((value, { req }) => {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('At least one bank account is required');
        }
        
        // Validate each bank account
        value.forEach((account, index) => {
          if (!account.accountHolderName || account.accountHolderName.trim() === '') {
            throw new Error(`Account ${index + 1}: Account Holder Name is required`);
          }
          if (!account.bankName || account.bankName.trim() === '') {
            throw new Error(`Account ${index + 1}: Bank Name is required`);
          }
          if (!account.sortCode || !/^\d{2}-\d{2}-\d{2}$/.test(account.sortCode)) {
            throw new Error(`Account ${index + 1}: Sort Code must be in format XX-XX-XX`);
          }
          if (!account.accountNumber || !/^\d{8}$/.test(account.accountNumber)) {
            throw new Error(`Account ${index + 1}: Account Number must be 8 digits`);
          }
        });
        
        return true;
      })
  ];
};

/**
 * VALIDATION RULES FOR PAYMENT DISTRIBUTION
 * Validates that payment splits add up to 100%
 */
const paymentDistributionValidationRules = () => {
  return [
    body('payments')
      .custom((value, { req }) => {
        if (!Array.isArray(value) || value.length === 0) {
          // Payments are optional, but if provided must be valid
          return true;
        }
        
        let totalPercentage = 0;
        let totalAmount = 0;
        const totalPay = (parseFloat(req.body.totalHours) || 0 + 
                         (parseFloat(req.body.totalMinutes) || 0) / 60) * 
                        (parseFloat(req.body.payRate) || 0);
        
        value.forEach((payment, index) => {
          if (payment.percentage) {
            totalPercentage += parseFloat(payment.percentage);
          }
          if (payment.amount) {
            totalAmount += parseFloat(payment.amount);
          }
        });
        
        // If percentages are specified, they must total 100
        if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.01) {
          throw new Error('Payment percentages must total 100%');
        }
        
        // If amounts are specified, they must equal total pay
        if (totalAmount > 0 && Math.abs(totalAmount - totalPay) > 0.01) {
          throw new Error('Payment amounts must equal total calculated pay');
        }
        
        return true;
      })
  ];
};

/**
 * Validation middleware to check for errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * ROUTE HANDLERS FOR ENHANCED PAYROLL OPERATIONS
 */

const setupPayrollRoutes = (app, Payroll, mongoose) => {
  
  /**
   * POST /add-record - Create new payroll record (legacy naming)
   */
  app.post('/add-record', payrollValidationRules(), validate, async (req, res) => {
    try {
      const payrollData = {
        clientName: req.body.clientName,
        siteName: req.body.siteName || '',
        guardName: req.body.guardName,
        nationality: req.body.nationality,
        insuranceNumber: req.body.insuranceNumber,
        visaStatus: req.body.visaStatus,
        britishPassport: req.body.britishPassport === true || req.body.britishPassport === 'true',
        shareCode: req.body.shareCode || null,
        shareCodeExpiryDate: req.body.shareCodeExpiryDate || null,
        totalHours: parseFloat(req.body.totalHours),
        totalMinutes: parseInt(req.body.totalMinutes),
        chargeRate: parseFloat(req.body.chargeRate),
        payRate: parseFloat(req.body.payRate),
        // Legacy fields
        pay1: parseFloat(req.body.pay1) || 0,
        pay2: parseFloat(req.body.pay2) || 0,
        pay3: parseFloat(req.body.pay3) || 0,
        accountNo: req.body.accountNo || '',
        sortCode: req.body.sortCode || '',
        accountHolderName: req.body.accountHolderName || '',
        // Bank accounts
        bankAccounts: req.body.bankAccounts || [],
        payments: req.body.payments || []
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
   * PUT /update-record/:id - Update existing payroll record
   */
  app.put('/update-record/:id', payrollValidationRules(), validate, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid record ID'
        });
      }

      const updateData = {
        clientName: req.body.clientName,
        siteName: req.body.siteName || '',
        guardName: req.body.guardName,
        nationality: req.body.nationality,
        insuranceNumber: req.body.insuranceNumber,
        visaStatus: req.body.visaStatus,
        britishPassport: req.body.britishPassport === true || req.body.britishPassport === 'true',
        shareCode: req.body.shareCode || null,
        shareCodeExpiryDate: req.body.shareCodeExpiryDate || null,
        totalHours: parseFloat(req.body.totalHours),
        totalMinutes: parseInt(req.body.totalMinutes),
        chargeRate: parseFloat(req.body.chargeRate),
        payRate: parseFloat(req.body.payRate),
        // Legacy fields
        pay1: parseFloat(req.body.pay1) || 0,
        pay2: parseFloat(req.body.pay2) || 0,
        pay3: parseFloat(req.body.pay3) || 0,
        accountNo: req.body.accountNo || '',
        sortCode: req.body.sortCode || '',
        accountHolderName: req.body.accountHolderName || '',
        // Bank accounts
        bankAccounts: req.body.bankAccounts || [],
        payments: req.body.payments || [],
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
   * GET /get-record/:id - Get specific record (for editing)
   */
  app.get('/get-record/:id', async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid record ID'
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
      console.error('Error fetching record:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching record',
        error: error.message
      });
    }
  });

  /**
   * GET /api/payroll/filter - Enhanced filter with new fields
   */
  app.get('/api/payroll/filter', async (req, res) => {
    try {
      const query = {};

      // Guard name filter
      if (req.query.guardName) {
        query.guardName = { $regex: req.query.guardName, $options: 'i' };
      }

      // Insurance number filter
      if (req.query.insuranceNumber) {
        query.insuranceNumber = { $regex: req.query.insuranceNumber, $options: 'i' };
      }

      // Nationality filter
      if (req.query.nationality) {
        query.nationality = { $regex: req.query.nationality, $options: 'i' };
      }

      // Visa status filter
      if (req.query.visaStatus) {
        query.visaStatus = req.query.visaStatus;
      }

      // Client name filter
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
      console.error('Error filtering records:', error);
      res.status(500).json({
        success: false,
        message: 'Error filtering records',
        error: error.message
      });
    }
  });
};

module.exports = {
  payrollValidationRules,
  bankAccountsValidationRules,
  paymentDistributionValidationRules,
  validate,
  setupPayrollRoutes
};
