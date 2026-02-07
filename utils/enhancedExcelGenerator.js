const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Excel Report Generator
 * Supports visa information, multiple bank accounts, and comprehensive payroll data
 */
class EnhancedExcelGenerator {
  
  /**
   * Generate comprehensive Excel report with all guard information
   */
  static generatePayrollExcel(payrollRecords, outputPath) {
    try {
      // Create workbook and add worksheet
      const workbook = xlsx.utils.book_new();
      
      // Create summary sheet
      const summarySheet = this.createSummarySheet(payrollRecords);
      xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Create detailed records sheet
      const detailsSheet = this.createDetailedSheet(payrollRecords);
      xlsx.utils.book_append_sheet(workbook, detailsSheet, 'Detailed Records');
      
      // Create bank accounts sheet
      const bankSheet = this.createBankAccountsSheet(payrollRecords);
      xlsx.utils.book_append_sheet(workbook, bankSheet, 'Bank Details');
      
      // Create visa information sheet
      const visaSheet = this.createVisaSheet(payrollRecords);
      xlsx.utils.book_append_sheet(workbook, visaSheet, 'Visa Information');
      
      // Write to file
      if (outputPath) {
        xlsx.writeFile(workbook, outputPath);
        return outputPath;
      }
      
      // Return buffer if no path provided
      return xlsx.write(workbook, { type: 'buffer' });
    } catch (error) {
      throw new Error('Error generating Excel file: ' + error.message);
    }
  }

  /**
   * Create summary sheet with overview of all records
   */
  static createSummarySheet(records) {
    const headers = [
      'Guard Name',
      'Nationality',
      'Client Name',
      'Site Name',
      'Insurance Number',
      'Visa Status',
      'British Passport',
      'Total Hours',
      'Total Minutes',
      'Decimal Hours',
      'Pay Rate (£/hr)',
      'Charge Rate (£/hr)',
      'Total Pay (£)',
      'Bank Accounts',
      'Date Created'
    ];

    const data = records.map(record => {
      const decimalHours = record.totalHours + (record.totalMinutes / 60);
      const totalPay = decimalHours * parseFloat(record.payRate || 0);
      const bankAccountCount = record.bankAccounts ? record.bankAccounts.length : 1;
      
      return [
        record.guardName || '',
        record.nationality || '',
        record.clientName || '',
        record.siteName || '',
        record.insuranceNumber || '',
        record.visaStatus || '',
        record.britishPassport ? 'Yes' : 'No',
        record.totalHours || 0,
        record.totalMinutes || 0,
        decimalHours.toFixed(2),
        parseFloat(record.payRate || 0).toFixed(2),
        parseFloat(record.chargeRate || 0).toFixed(2),
        totalPay.toFixed(2),
        bankAccountCount,
        record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-GB') : ''
      ];
    });

    const sheet = xlsx.utils.aoa_to_sheet([headers, ...data]);
    
    // Set column widths
    sheet['!cols'] = [
      { wch: 15 }, // Guard Name
      { wch: 15 }, // Nationality
      { wch: 18 }, // Client Name
      { wch: 18 }, // Site Name
      { wch: 18 }, // Insurance Number
      { wch: 18 }, // Visa Status
      { wch: 12 }, // British Passport
      { wch: 12 }, // Total Hours
      { wch: 13 }, // Total Minutes
      { wch: 13 }, // Decimal Hours
      { wch: 13 }, // Pay Rate
      { wch: 14 }, // Charge Rate
      { wch: 13 }, // Total Pay
      { wch: 12 }, // Bank Accounts
      { wch: 14 }  // Date Created
    ];

    // Style header row
    for (let i = 0; i < headers.length; i++) {
      const cellRef = xlsx.utils.encode_col(i) + '1';
      sheet[cellRef].fill = { fgColor: { rgb: 'FF1a365d' } };
      sheet[cellRef].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
      sheet[cellRef].alignment = { horizontal: 'center', vertical: 'center' };
    }

    return sheet;
  }

  /**
   * Create detailed records sheet with comprehensive information
   */
  static createDetailedSheet(records) {
    const headers = [
      'Guard ID',
      'Guard Name',
      'Nationality',
      'Insurance Number',
      'Client Name',
      'Site Name',
      'Visa Status',
      'British Passport',
      'Share Code',
      'Share Code Expiry',
      'Total Hours',
      'Total Minutes',
      'Hours (Decimal)',
      'Pay Rate (£/hr)',
      'Charge Rate (£/hr)',
      'Total Pay (£)',
      'Account Holder',
      'Bank Name',
      'Sort Code',
      'Account Number',
      'Pay 1',
      'Pay 2',
      'Pay 3',
      'Created Date',
      'Updated Date'
    ];

    const data = records.map((record, index) => {
      const decimalHours = record.totalHours + (record.totalMinutes / 60);
      const totalPay = decimalHours * parseFloat(record.payRate || 0);
      
      // Get first bank account info or use legacy fields
      let accountHolder = '';
      let bankName = '';
      let sortCode = '';
      let accountNumber = '';
      
      if (record.bankAccounts && record.bankAccounts.length > 0) {
        const primaryAccount = record.bankAccounts.find(a => a.isPrimary) || record.bankAccounts[0];
        accountHolder = primaryAccount.accountHolderName || '';
        bankName = primaryAccount.bankName || '';
        sortCode = primaryAccount.sortCode || '';
        accountNumber = primaryAccount.accountNumber || '';
      } else {
        accountHolder = record.accountHolderName || '';
        bankName = '';
        sortCode = record.sortCode || '';
        accountNumber = record.accountNo || '';
      }

      return [
        record._id ? record._id.toString().slice(-6) : '',
        record.guardName || '',
        record.nationality || '',
        record.insuranceNumber || '',
        record.clientName || '',
        record.siteName || '',
        record.visaStatus || '',
        record.britishPassport ? 'Yes' : 'No',
        record.shareCode || '',
        record.shareCodeExpiryDate ? new Date(record.shareCodeExpiryDate).toLocaleDateString('en-GB') : '',
        record.totalHours || 0,
        record.totalMinutes || 0,
        decimalHours.toFixed(2),
        parseFloat(record.payRate || 0).toFixed(2),
        parseFloat(record.chargeRate || 0).toFixed(2),
        totalPay.toFixed(2),
        accountHolder,
        bankName,
        sortCode,
        accountNumber,
        record.pay1 || 0,
        record.pay2 || 0,
        record.pay3 || 0,
        record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-GB') : '',
        record.updatedAt ? new Date(record.updatedAt).toLocaleDateString('en-GB') : ''
      ];
    });

    const sheet = xlsx.utils.aoa_to_sheet([headers, ...data]);
    
    sheet['!cols'] = [
      { wch: 10 }, // Guard ID
      { wch: 15 }, // Guard Name
      { wch: 15 }, // Nationality
      { wch: 18 }, // Insurance Number
      { wch: 18 }, // Client Name
      { wch: 18 }, // Site Name
      { wch: 18 }, // Visa Status
      { wch: 12 }, // British Passport
      { wch: 12 }, // Share Code
      { wch: 15 }, // Share Code Expiry
      { wch: 12 }, // Total Hours
      { wch: 13 }, // Total Minutes
      { wch: 13 }, // Hours (Decimal)
      { wch: 13 }, // Pay Rate
      { wch: 14 }, // Charge Rate
      { wch: 13 }, // Total Pay
      { wch: 16 }, // Account Holder
      { wch: 16 }, // Bank Name
      { wch: 12 }, // Sort Code
      { wch: 14 }, // Account Number
      { wch: 10 }, // Pay 1
      { wch: 10 }, // Pay 2
      { wch: 10 }, // Pay 3
      { wch: 14 }, // Created Date
      { wch: 14 }  // Updated Date
    ];

    // Style header
    for (let i = 0; i < headers.length; i++) {
      const cellRef = xlsx.utils.encode_col(i) + '1';
      sheet[cellRef].fill = { fgColor: { rgb: 'FF2d5a8c' } };
      sheet[cellRef].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
      sheet[cellRef].alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    }

    return sheet;
  }

  /**
   * Create bank accounts sheet with all account details
   */
  static createBankAccountsSheet(records) {
    const headers = [
      'Guard Name',
      'Client Name',
      'Account #',
      'Account Holder Name',
      'Bank Name',
      'Sort Code',
      'Account Number',
      'Is Primary',
      'Active',
      'Insurance Number'
    ];

    const data = [];

    records.forEach(record => {
      if (record.bankAccounts && record.bankAccounts.length > 0) {
        record.bankAccounts.forEach((account, idx) => {
          data.push([
            record.guardName || '',
            record.clientName || '',
            idx + 1,
            account.accountHolderName || '',
            account.bankName || '',
            account.sortCode || '',
            account.accountNumber || '',
            account.isPrimary ? 'Yes' : 'No',
            account.active ? 'Yes' : 'No',
            record.insuranceNumber || ''
          ]);
        });
      } else if (record.accountHolderName) {
        // Fallback to legacy account data
        data.push([
          record.guardName || '',
          record.clientName || '',
          1,
          record.accountHolderName || '',
          '',
          record.sortCode || '',
          record.accountNo || '',
          'Yes',
          'Yes',
          record.insuranceNumber || ''
        ]);
      }
    });

    const sheet = xlsx.utils.aoa_to_sheet([headers, ...data]);
    
    sheet['!cols'] = [
      { wch: 15 }, // Guard Name
      { wch: 18 }, // Client Name
      { wch: 10 }, // Account #
      { wch: 18 }, // Account Holder Name
      { wch: 16 }, // Bank Name
      { wch: 12 }, // Sort Code
      { wch: 14 }, // Account Number
      { wch: 12 }, // Is Primary
      { wch: 10 }, // Active
      { wch: 18 }  // Insurance Number
    ];

    // Style header
    for (let i = 0; i < headers.length; i++) {
      const cellRef = xlsx.utils.encode_col(i) + '1';
      sheet[cellRef].fill = { fgColor: { rgb: 'FF27ae60' } };
      sheet[cellRef].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    }

    return sheet;
  }

  /**
   * Create visa information sheet
   */
  static createVisaSheet(records) {
    const headers = [
      'Guard Name',
      'Insurance Number',
      'Nationality',
      'Visa Status',
      'British Passport',
      'Share Code',
      'Share Code Expiry',
      'Days Until Expiry',
      'Client Name',
      'Contact Updated'
    ];

    const data = records.map(record => {
      let daysUntilExpiry = '';
      if (record.shareCodeExpiryDate) {
        const expiry = new Date(record.shareCodeExpiryDate);
        const today = new Date();
        const diffTime = expiry - today;
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return [
        record.guardName || '',
        record.insuranceNumber || '',
        record.nationality || '',
        record.visaStatus || '',
        record.britishPassport ? 'Yes' : 'No',
        record.shareCode || '',
        record.shareCodeExpiryDate ? new Date(record.shareCodeExpiryDate).toLocaleDateString('en-GB') : '',
        daysUntilExpiry,
        record.clientName || '',
        record.updatedAt ? new Date(record.updatedAt).toLocaleDateString('en-GB') : ''
      ];
    });

    const sheet = xlsx.utils.aoa_to_sheet([headers, ...data]);
    
    sheet['!cols'] = [
      { wch: 15 }, // Guard Name
      { wch: 18 }, // Insurance Number
      { wch: 15 }, // Nationality
      { wch: 18 }, // Visa Status
      { wch: 12 }, // British Passport
      { wch: 12 }, // Share Code
      { wch: 16 }, // Share Code Expiry
      { wch: 16 }, // Days Until Expiry
      { wch: 18 }, // Client Name
      { wch: 14 }  // Contact Updated
    ];

    // Highlight expiring share codes (30 days or less)
    for (let i = 1; i < data.length + 1; i++) {
      const daysRef = xlsx.utils.encode_col(7) + (i + 1);
      const daysValue = data[i - 1][7];
      
      if (daysValue && !isNaN(daysValue)) {
        if (daysValue <= 30 && daysValue > 0) {
          sheet[daysRef].fill = { fgColor: { rgb: 'FFFFFF99' } }; // Yellow
          sheet[daysRef].font = { bold: true };
        } else if (daysValue <= 0) {
          sheet[daysRef].fill = { fgColor: { rgb: 'FFDC3545' } }; // Red
          sheet[daysRef].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
        }
      }
    }

    // Style header
    for (let i = 0; i < headers.length; i++) {
      const cellRef = xlsx.utils.encode_col(i) + '1';
      sheet[cellRef].fill = { fgColor: { rgb: 'FFdc3545' } };
      sheet[cellRef].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    }

    return sheet;
  }
}

module.exports = EnhancedExcelGenerator;
