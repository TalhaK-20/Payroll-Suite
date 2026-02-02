const XLSX = require('xlsx');
const fs = require('fs');

class ExcelParser {
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
          return {
            clientName: String(row['Client Name'] || '').trim(),
            guardName: String(row['Guard Name'] || '').trim(),
            totalHours: this.parseNumber(row['Total Hours']),
            payRate: this.parseNumber(row['Pay Rate']),
            chargeRate: this.parseNumber(row['Charge Rate']),
            pay1: this.parseNumber(row['Pay 1']),
            pay2: this.parseNumber(row['Pay 2']),
            pay3: this.parseNumber(row['Pay 3']),
            accountNo: String(row['Account No'] || '').trim(),
            sortCode: String(row['Sort Code'] || '').trim(),
            accountHolderName: String(row['Account Holder Name'] || '').trim()
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

      // Required fields validation
      if (!row.clientName) {
        errors.push(`Row ${rowNum}: Client Name is required`);
      }
      if (!row.guardName) {
        errors.push(`Row ${rowNum}: Guard Name is required`);
      }
      if (!row.accountNo) {
        errors.push(`Row ${rowNum}: Account No is required`);
      }
      if (!row.sortCode) {
        errors.push(`Row ${rowNum}: Sort Code is required`);
      }
      if (!row.accountHolderName) {
        errors.push(`Row ${rowNum}: Account Holder Name is required`);
      }

      // Numeric fields validation
      if (row.totalHours < 0) {
        errors.push(`Row ${rowNum}: Total Hours cannot be negative`);
      }
      if (row.payRate < 0) {
        errors.push(`Row ${rowNum}: Pay Rate cannot be negative`);
      }
      if (row.chargeRate < 0) {
        errors.push(`Row ${rowNum}: Charge Rate cannot be negative`);
      }
      if (row.pay1 < 0) {
        errors.push(`Row ${rowNum}: Pay 1 cannot be negative`);
      }
      if (row.pay2 < 0) {
        errors.push(`Row ${rowNum}: Pay 2 cannot be negative`);
      }
      if (row.pay3 < 0) {
        errors.push(`Row ${rowNum}: Pay 3 cannot be negative`);
      }

      // Warnings
      if (row.totalHours === 0) {
        warnings.push(`Row ${rowNum}: Total Hours is 0`);
      }
      if (row.payRate === 0) {
        warnings.push(`Row ${rowNum}: Pay Rate is 0`);
      }

      // Sort code format validation (typically NNNNNN format)
      if (!/^\d{6}$|^\d{2}-\d{2}-\d{2}$/.test(row.sortCode.replace(/\s/g, ''))) {
        warnings.push(`Row ${rowNum}: Sort Code format may be incorrect`);
      }

      // Account number validation (should be numbers)
      if (!/^\d+$/.test(row.accountNo.replace(/\s/g, ''))) {
        warnings.push(`Row ${rowNum}: Account No should contain only numbers`);
      }
    });

    return {
      isValid: errors.length === 0,
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

      XLSX.writeFile(workbook, outputPath);

      return {
        success: true,
        filePath: outputPath,
        message: 'Excel file generated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ExcelParser();
