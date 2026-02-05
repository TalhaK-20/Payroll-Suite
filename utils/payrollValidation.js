// Backend Validation Rules and Route Handlers for Enhanced Payroll System
// This module contains all validation rules and route handlers for the new visa/immigration features

const { body, validationResult } = require('express-validator');

/**
 * VALIDATION RULES FOR PAYROLL RECORDS
 * All validations removed - accepting all data as-is
 */
const payrollValidationRules = () => {
  return [];
};

/**
 * VALIDATION RULES FOR BANK ACCOUNTS ARRAY
 * All validations removed - accepting all data as-is
 */
const bankAccountsValidationRules = () => {
  return [];
};

/**
 * VALIDATION RULES FOR PAYMENT DISTRIBUTION
 * All validations removed - accepting all data as-is
 */
const paymentDistributionValidationRules = () => {
  return [];
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
