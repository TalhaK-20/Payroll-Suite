const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PayrollPDFGenerator {
  constructor() {
    this.pageWidth = 595; // A4 width in points
    this.pageHeight = 842; // A4 height in points
    this.margin = 40;
    this.primaryColor = '#0f172a';
    this.secondaryColor = '#1f2937';
    this.accentColor = '#0f766e';
    this.dangerColor = '#dc2626';
    this.lightGray = '#f8fafc';
    this.borderColor = '#e5e7eb';
    this.mutedText = '#64748b';
  }

  formatCurrency(value) {
    const amount = Number(value) || 0;
    return `GBP ${amount.toFixed(2)}`;
  }

  ensureSpace(doc, height) {
    if (doc.y + height > this.pageHeight - this.margin) {
      doc.addPage();
    }
  }

  /**
   * Generate comprehensive payroll PDF with all guard information
   */
  generatePayrollPDF(payrollData, payNumber, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.margin,
          bufferPages: true
        });

        let buffers = [];
        
        if (outputPath) {
          const stream = fs.createWriteStream(outputPath);
          doc.pipe(stream);
          this.buildPDFContent(doc, payrollData, payNumber);
          doc.end();

          stream.on('finish', () => resolve(outputPath));
          stream.on('error', reject);
        } else {
          doc.on('data', chunk => buffers.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(buffers)));
          doc.on('error', reject);

          this.buildPDFContent(doc, payrollData, payNumber);
          doc.end();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build the complete PDF content
   */
  buildPDFContent(doc, data, payNumber = 1) {
    // Handle both array and object inputs
    const record = Array.isArray(data) ? data[0] : data;
    
    if (!record) {
      throw new Error('No payroll data provided for PDF generation');
    }
    
    // Header
    this.addHeader(doc, payNumber);

    // Guard Information Section
    this.addGuardInformation(doc, record);

    // Working Hours & Rates Section
    this.addWorkingHoursSection(doc, record);

    // Bank Account(s) Section
    this.addBankAccountsSection(doc, record);

    // Payment Summary Section
    this.addPaymentSummary(doc, record, payNumber);

    // Footer
    this.addFooter(doc);
  }

  /**
   * Add professional header with company branding
   */
  addHeader(doc, payNumber = 1) {
    const titleY = this.margin - 10;

    doc.fontSize(20)
      .fillColor(this.primaryColor)
      .font('Helvetica-Bold')
      .text('Payroll Statement', this.margin, titleY);

    doc.fontSize(9)
      .fillColor(this.mutedText)
      .font('Helvetica')
      .text('Security Guard Employment Record', this.margin, titleY + 24);

    const rightX = this.pageWidth - this.margin - 180;
    doc.fontSize(9)
      .fillColor(this.mutedText)
      .text(`Generated: ${new Date().toLocaleDateString('en-GB')}`,
        rightX, titleY + 4, { width: 180, align: 'right' })
      .text(`Pay Run: ${String(payNumber).padStart(2, '0')}`,
        rightX, titleY + 18, { width: 180, align: 'right' });

    doc.moveTo(this.margin, titleY + 36)
      .lineTo(this.pageWidth - this.margin, titleY + 36)
      .stroke(this.borderColor);

    doc.y = titleY + 48;
  }

  /**
   * Add section title
   */
  addSectionTitle(doc, title) {
    this.ensureSpace(doc, 28);
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(this.secondaryColor)
      .text(title, this.margin, doc.y);

    doc.moveTo(this.margin, doc.y + 14)
      .lineTo(this.pageWidth - this.margin, doc.y + 14)
      .stroke(this.borderColor);

    doc.y = doc.y + 22;
  }

  drawLabelValue(doc, x, y, labelWidth, valueWidth, label, value) {
    doc.fontSize(9).font('Helvetica').fillColor(this.mutedText);
    doc.text(label, x, y, { width: labelWidth });

    doc.fontSize(10).font('Helvetica-Bold').fillColor(this.primaryColor);
    doc.text(value, x + labelWidth, y, { width: valueWidth });
  }

  /**
   * Add guard basic information section
   */
  addGuardInformation(doc, data) {
    this.addSectionTitle(doc, 'GUARD INFORMATION');
    this.ensureSpace(doc, 80);

    const leftItems = [
      { label: 'Guard Name', value: data.guardName || 'N/A' },
      { label: 'Insurance Number', value: data.insuranceNumber || 'N/A' },
      { label: 'Pay Rate (GBP/hour)', value: this.formatCurrency(data.payRate || 0) }
    ];

    const rightItems = [
      { label: 'Client Name', value: data.clientName || 'N/A' },
      { label: 'Charge Rate (GBP/hour)', value: this.formatCurrency(data.chargeRate || 0) },
      { label: 'Status', value: data.status || 'Pending' }
    ];

    const rowHeight = 18;
    const labelWidth = 120;
    const colGap = 20;
    const colWidth = (this.pageWidth - 2 * this.margin - colGap) / 2;
    const leftX = this.margin;
    const rightX = this.margin + colWidth + colGap;
    const startY = doc.y;

    for (let i = 0; i < leftItems.length; i++) {
      const y = startY + i * rowHeight;
      const left = leftItems[i];
      const right = rightItems[i];
      this.drawLabelValue(doc, leftX, y, labelWidth, colWidth - labelWidth, left.label, left.value);
      this.drawLabelValue(doc, rightX, y, labelWidth, colWidth - labelWidth, right.label, right.value);
    }

    doc.y = startY + leftItems.length * rowHeight + 6;
  }

  /**
   * Add working hours and rates section with associated guard data
   */
  addWorkingHoursSection(doc, data) {
    this.addSectionTitle(doc, 'WORKING HOURS AND RATES');
    this.ensureSpace(doc, 160);

    const tableX = this.margin;
    const tableWidth = this.pageWidth - 2 * this.margin;
    const colWidth = tableWidth / 2;

    // Set default values for missing data
    const totalHours = data.totalHours || 0;
    const totalMinutes = data.totalMinutes || 0;
    const payRate = parseFloat(data.payRate) || 0;
    const chargeRate = parseFloat(data.chargeRate) || 0;
    const totalHoursDecimal = totalHours + totalMinutes / 60;
    const totalPayValue = typeof data.totalPayOverride === 'number'
      ? data.totalPayOverride
      : totalHoursDecimal * payRate;

    // Get hours distribution if available
    const primaryGuardHours = (data.hoursDistribution?.primaryGuardHours) || totalHoursDecimal;
    const associatedGuardHours = (data.hoursDistribution?.associatedGuardHours) || 0;
    const associatedGuardName = (data.hoursDistribution?.associatedGuardId?.guardName) || '';

    // Draw table
    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Total Hours', width: colWidth / 2 },
      { text: totalHours.toString(), width: colWidth / 2, align: 'right' },
      { text: 'Total Minutes', width: colWidth / 2 },
      { text: totalMinutes.toString(), width: colWidth / 2, align: 'right' }
    ]);

    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Hours (Decimal)', width: colWidth / 2 },
      { text: totalHoursDecimal.toFixed(2), width: colWidth / 2, align: 'right' },
      { text: 'Pay Rate (GBP/hour)', width: colWidth / 2 },
      { text: this.formatCurrency(payRate), width: colWidth / 2, align: 'right' }
    ]);

    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Charge Rate (GBP/hour)', width: colWidth / 2 },
      { text: this.formatCurrency(chargeRate), width: colWidth / 2, align: 'right' },
      { text: 'Total Pay', width: colWidth / 2 },
      { text: this.formatCurrency(totalPayValue), width: colWidth / 2, align: 'right', isBold: true }
    ]);

    // Add hours distribution section if applicable
    if (primaryGuardHours > 0 || associatedGuardHours > 0) {
      doc.y += 8;
      this.drawTableRow(doc, tableX, doc.y, [
        { text: 'Primary Guard Hours', width: colWidth / 2 },
        { text: primaryGuardHours.toFixed(2), width: colWidth / 2, align: 'right' },
        { text: 'Associated Guard Hours', width: colWidth / 2 },
        { text: associatedGuardHours.toFixed(2), width: colWidth / 2, align: 'right' }
      ]);

      // Associated guard info if present
      if (associatedGuardName) {
        this.drawTableRow(doc, tableX, doc.y, [
          { text: 'Associated Guard', width: colWidth / 2 },
          { text: associatedGuardName, width: colWidth / 2 },
          { text: 'Associated Pay', width: colWidth / 2 },
          { text: this.formatCurrency(associatedGuardHours * payRate), width: colWidth / 2, align: 'right' }
        ]);
      }

      if (typeof data.primaryPayAmount === 'number' || typeof data.associatedPayAmount === 'number') {
        const primaryPay = typeof data.primaryPayAmount === 'number' ? data.primaryPayAmount : 0;
        const associatedPay = typeof data.associatedPayAmount === 'number' ? data.associatedPayAmount : 0;
        this.drawTableRow(doc, tableX, doc.y, [
          { text: 'Primary Pay', width: colWidth / 2 },
          { text: this.formatCurrency(primaryPay), width: colWidth / 2, align: 'right' },
          { text: 'Associated Pay', width: colWidth / 2 },
          { text: this.formatCurrency(associatedPay), width: colWidth / 2, align: 'right' }
        ]);
      }

      if (Array.isArray(data.associatedPayDetails) && data.associatedPayDetails.length > 0) {
        doc.y += 6;
        doc.fontSize(9).font('Helvetica').fillColor(this.mutedText);
        doc.text('Associated Guard Breakdown:', tableX, doc.y);
        doc.y += 4;
        data.associatedPayDetails.forEach(item => {
          this.ensureSpace(doc, 14);
          doc.fontSize(9).font('Helvetica').fillColor('#374151');
          doc.text(
            `${item.guardName || 'Associated'} - ${Number(item.hours || 0).toFixed(2)}h, ${this.formatCurrency(item.payAmount || 0)}`,
            tableX + 10,
            doc.y + 6
          );
          doc.y += 12;
        });
      }
    }

    doc.y += 16;
  }

  /**
   * Add bank accounts section
   */
  addBankAccountsSection(doc, data) {
    // Check for single account in old format or multiple accounts
    const hasOldFormat = data.accountNo || data.sortCode || data.accountHolderName;
    const bankAccounts = data.bankAccounts || [];
    
    if (!hasOldFormat && bankAccounts.length === 0) {
      return;
    }

    this.addSectionTitle(doc, 'BANK ACCOUNT(S)');

    const drawBankBox = (account) => {
      const boxX = this.margin;
      const boxWidth = this.pageWidth - 2 * this.margin;
      const boxHeight = 72;

      this.ensureSpace(doc, boxHeight + 10);
      doc.roundedRect(boxX, doc.y, boxWidth, boxHeight, 6)
        .fillAndStroke(this.lightGray, this.borderColor);

      const startY = doc.y + 10;
      const labelWidth = 120;
      const valueWidth = boxWidth - labelWidth - 20;
      const x = boxX + 10;

      this.drawLabelValue(doc, x, startY, labelWidth, valueWidth, 'Account Holder', account.accountHolderName || 'N/A');
      this.drawLabelValue(doc, x, startY + 16, labelWidth, valueWidth, 'Bank Name', account.bankName || 'N/A');
      this.drawLabelValue(doc, x, startY + 32, labelWidth, valueWidth, 'Sort Code', account.sortCode || 'N/A');
      this.drawLabelValue(doc, x, startY + 48, labelWidth, valueWidth, 'Account Number', account.accountNumber || account.accountNo || 'N/A');

      doc.y += boxHeight + 12;
    };

    // Handle old format (single account)
    if (hasOldFormat) {
      drawBankBox({
        accountHolderName: data.accountHolderName,
        bankName: data.bankName,
        sortCode: data.sortCode,
        accountNumber: data.accountNo
      });
    } else {
      // Handle new format (multiple accounts)
      bankAccounts.forEach(account => drawBankBox(account));
    }
  }

  /**
   * Add payment summary section
   */
  addPaymentSummary(doc, data, payNumber = 1) {
    this.addSectionTitle(doc, 'PAYMENT SUMMARY');

    const totalHoursDecimal = (data.totalHours || 0) + ((data.totalMinutes || 0) / 60);
    const payRate = parseFloat(data.payRate) || 0;
    const chargeRate = parseFloat(data.chargeRate) || 0;
    const hasTotalOverride = typeof data.totalPayOverride === 'number';
    const totalPay = hasTotalOverride ? data.totalPayOverride : (totalHoursDecimal * payRate);
    const totalCharge = totalHoursDecimal * chargeRate;

    // Get the appropriate payment amount based on payNumber
    let paymentAmount = 0;
    if (payNumber === 1) paymentAmount = data.pay1 || totalPay;
    else if (payNumber === 2) paymentAmount = data.pay2 || totalPay;
    else if (payNumber === 3) paymentAmount = data.pay3 || totalPay;
    else paymentAmount = totalPay;

    // Get hours distribution if available
    const primaryGuardHours = (data.hoursDistribution?.primaryGuardHours) || totalHoursDecimal;
    const associatedGuardHours = (data.hoursDistribution?.associatedGuardHours) || 0;

    const leftItems = [
      { label: 'Hours Worked', value: `${totalHoursDecimal.toFixed(2)} hours` },
      { label: 'Pay Rate', value: `${this.formatCurrency(payRate)}/hour` },
      { label: 'Charge Rate', value: `${this.formatCurrency(chargeRate)}/hour` },
      { label: 'Primary Guard Hours', value: `${primaryGuardHours.toFixed(2)} hours` }
    ];

    if (associatedGuardHours > 0) {
      leftItems.push({ label: 'Associated Guard Hours', value: `${associatedGuardHours.toFixed(2)} hours` });
    }

    const rightItems = [
      { label: 'Total Pay', value: this.formatCurrency(totalPay) },
      { label: 'Payment Amount', value: this.formatCurrency(paymentAmount) },
      { label: 'Total Charge', value: this.formatCurrency(totalCharge) }
    ];

    const summaryBoxX = this.margin;
    const summaryBoxWidth = this.pageWidth - 2 * this.margin;
    const rowHeight = 18;
    const rows = Math.max(leftItems.length, rightItems.length);
    const boxHeight = rows * rowHeight + 16;

    this.ensureSpace(doc, boxHeight + 10);

    // Summary box
    doc.roundedRect(summaryBoxX, doc.y, summaryBoxWidth, boxHeight, 6)
      .fillAndStroke(this.lightGray, this.borderColor);

    const colGap = 20;
    const colWidth = (summaryBoxWidth - colGap) / 2;
    const labelWidth = 120;
    const leftX = summaryBoxX + 12;
    const rightX = summaryBoxX + colWidth + colGap;
    const startY = doc.y + 10;

    for (let i = 0; i < rows; i++) {
      const y = startY + i * rowHeight;
      const left = leftItems[i];
      const right = rightItems[i];

      if (left) {
        this.drawLabelValue(doc, leftX, y, labelWidth, colWidth - labelWidth - 12, left.label, left.value);
      }
      if (right) {
        this.drawLabelValue(doc, rightX, y, labelWidth, colWidth - labelWidth - 12, right.label, right.value);
      }
    }

    doc.y += boxHeight + 14;
  }

  /**
   * Add footer
   */
  addFooter(doc) {
    const footerY = this.pageHeight - this.margin - 20;

    // Divider line
    doc.moveTo(this.margin, footerY)
      .lineTo(this.pageWidth - this.margin, footerY)
      .stroke(this.borderColor);

    // Footer text
    doc.fontSize(8)
      .fillColor(this.mutedText)
      .text('This is a confidential payroll statement for internal use only.',
        this.margin, footerY + 10,
        { align: 'center', width: this.pageWidth - 2 * this.margin });

    doc.fontSize(8)
      .text('Generated on ' + new Date().toLocaleString('en-GB'),
        this.margin, footerY + 24,
        { align: 'center', width: this.pageWidth - 2 * this.margin });
  }

  /**
   * Draw a table row
   */
  drawTableRow(doc, startX, startY, cells) {
    const rowHeight = 26;

    // Draw cells
    let currentX = startX;
    cells.forEach(cell => {
      const cellWidth = cell.width;

      // Cell background
      doc.rect(currentX, startY, cellWidth, rowHeight)
        .fillAndStroke(this.lightGray, this.borderColor);

      // Cell text
      doc.fontSize(9);
      if (cell.isBold) {
        doc.font('Helvetica-Bold').fillColor(this.primaryColor);
      } else {
        doc.font('Helvetica').fillColor('#111827');
      }

      doc.text(cell.text, currentX + 8, startY + 7, {
        width: cellWidth - 16,
        align: cell.align || 'left'
      });

      currentX += cellWidth;
    });

    doc.y = startY + rowHeight;
  }

  /**
   * Generate bulk payroll PDF
   */
  async generateBulkPayrollPDF(payrollDataArray, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.margin,
          bufferPages: true
        });

        let buffers = [];

        if (outputPath) {
          const stream = fs.createWriteStream(outputPath);
          doc.pipe(stream);

          payrollDataArray.forEach((data, index) => {
            if (index > 0) {
              doc.addPage();
            }
            this.buildPDFContent(doc, data, 1);
          });

          doc.end();

          stream.on('finish', () => resolve(outputPath));
          stream.on('error', reject);
        } else {
          doc.on('data', chunk => buffers.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(buffers)));
          doc.on('error', reject);

          payrollDataArray.forEach((data, index) => {
            if (index > 0) {
              doc.addPage();
            }
            this.buildPDFContent(doc, data, 1);
          });

          doc.end();
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PayrollPDFGenerator();
