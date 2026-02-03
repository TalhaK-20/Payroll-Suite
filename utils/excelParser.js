const XLSX = require('xlsx');
const fs = require('fs');

class ExcelParser {
  /**
   * Helper to find column by various name patterns
   */
  findColumn(row, patterns) {
    const keys = Object.keys(row);
    for (const pattern of patterns) {
      for (const key of keys) {
        if (key.toLowerCase().includes(pattern.toLowerCase())) {
          return row[key];
        }
      }
    }
    return '';
  }

  parseExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData || jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      // Validate and transform data
      const transformedData = jsonData.map((row, index) => {
        try {
          // Extract account fields using flexible column matching
          const accountHolderName = String(
            this.findColumn(row, ['account holder', 'account holder name', 'holder name']) || ''
          ).trim();
          const sortCode = String(
            this.findColumn(row, ['sort code', 'sortcode', 'sort']) || ''
          ).trim();
          const accountNo = String(
            this.findColumn(row, ['account no', 'account number', 'account num', 'accountno']) || ''
          ).trim();
          
          // Build bank accounts array if we have account information
          const bankAccounts = [];
          if (accountHolderName || sortCode || accountNo) {
            bankAccounts.push({
              accountHolderName: accountHolderName,
              bankName: '',
              sortCode: sortCode,
              accountNumber: accountNo,
              isPrimary: true,
              active: true
            });
          }
          
          return {
            clientName: String(this.findColumn(row, ['client name', 'client']) || '').trim(),
            guardName: String(this.findColumn(row, ['guard name', 'guard']) || '').trim(),
            totalHours: this.parseNumber(this.findColumn(row, ['total hours', 'hours'])),
            payRate: this.parseNumber(this.findColumn(row, ['pay rate', 'pay'])),
            chargeRate: this.parseNumber(this.findColumn(row, ['charge rate', 'charge'])),
            pay1: this.parseNumber(this.findColumn(row, ['pay 1', 'payroll 01', 'payroll 1'])),
            pay2: this.parseNumber(this.findColumn(row, ['pay 2', 'payroll 02', 'payroll 2'])),
            pay3: this.parseNumber(this.findColumn(row, ['pay 3', 'payroll 03', 'payroll 3'])),
            // Keep flat fields for compatibility
            accountNo: accountNo,
            sortCode: sortCode,
            accountHolderName: accountHolderName,
            // Add structured bank accounts array
            bankAccounts: bankAccounts
          };
        } catch (error) {
          throw new Error(`Error parsing row ${index + 1}: ${error.message}`);
        }
      });

      return {
        success: true,
        data: transformedData,
        count: transformedData.length,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        count: 0,
        errors: [error.message]
      };
    }
  }

  parseNumber(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }

    return num;
  }

  validateData(data) {
    const errors = [];
    const warnings = [];

    data.forEach((row, index) => {
      const rowNum = index + 1;

      // Minimal validation - only check for negative values if fields are provided
      if (row.totalHours < 0) {
        warnings.push(`Row ${rowNum}: Total Hours cannot be negative`);
      }
      if (row.payRate < 0) {
        warnings.push(`Row ${rowNum}: Pay Rate cannot be negative`);
      }
      if (row.chargeRate < 0) {
        warnings.push(`Row ${rowNum}: Charge Rate cannot be negative`);
      }
    });

    return {
      isValid: true,
      errors,
      warnings
    };
  }

  generateExcelFromData(payrollData, outputPath) {
    try {
      const data = payrollData.map(item => ({
        'Client Name': item.clientName,
        'Guard Name': item.guardName,
        'Total Hours': item.totalHours,
        'Pay Rate': item.payRate,
        'Charge Rate': item.chargeRate,
        'Pay 1': item.pay1,
        'Pay 2': item.pay2,
        'Pay 3': item.pay3,
        'Account No': item.accountNo,
        'Sort Code': item.sortCode,
        'Account Holder Name': item.accountHolderName
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll');

      // If outputPath is provided, write to file; otherwise return buffer
      if (outputPath) {
        XLSX.writeFile(workbook, outputPath);
        return {
          success: true,
          filePath: outputPath,
          message: 'Excel file generated successfully'
        };
      } else {
        // For serverless platforms, write to buffer
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        return {
          success: true,
          buffer: buffer,
          message: 'Excel file generated successfully'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ExcelParser();
