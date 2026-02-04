const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PayrollPDFGenerator {
  constructor() {
    this.pageWidth = 595; // A4 width
    this.pageHeight = 842; // A4 height
    this.margin = 50;
    this.primaryColor = '#1a365d';
    this.secondaryColor = '#2d5a8c';
    this.accentColor = '#27ae60';
    this.lightGray = '#f8f9fa';
    this.borderColor = '#e0e0e0';
  }

  generatePayrollPDF(payrollData, payNumber, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.margin
        });

        // If outputPath is provided, use file stream; otherwise use buffer
        let buffers = [];
        
        if (outputPath) {
          // For local file system (localhost)
          const stream = fs.createWriteStream(outputPath);
          doc.pipe(stream);
          
          // Professional Header
          this.addProfessionalHeader(doc, payNumber);

          // Employee Information
          this.addProfessionalEmployeeInfo(doc, payrollData);

          // Payment Details Table
          this.addProfessionalPaymentDetails(doc, payrollData, payNumber);

          // Bank Details Section
          this.addBankDetailsSection(doc, payrollData);

          // Professional Footer
          this.addProfessionalFooter(doc);

          doc.end();

          stream.on('finish', () => {
            resolve(outputPath);
          });

          stream.on('error', (error) => {
            reject(error);
          });
        } else {
          // For serverless (Vercel) - return buffer
          doc.on('data', (chunk) => {
            buffers.push(chunk);
          });

          doc.on('end', () => {
            resolve(Buffer.concat(buffers));
          });

          doc.on('error', (error) => {
            reject(error);
          });

          // Professional Header
          this.addProfessionalHeader(doc, payNumber);

          // Employee Information
          this.addProfessionalEmployeeInfo(doc, payrollData);

          // Payment Details Table
          this.addProfessionalPaymentDetails(doc, payrollData, payNumber);

          // Bank Details Section
          this.addBankDetailsSection(doc, payrollData);

          // Professional Footer
          this.addProfessionalFooter(doc);

          doc.end();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  addProfessionalHeader(doc, payNumber) {
    // Background gradient effect with rectangles
    doc.rect(0, 0, this.pageWidth, 120)
      .fill(this.primaryColor);

    // Company branding
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('PAYROLL DOCUMENT', this.margin, 30);

    // Payroll type badge
    const payNumberText = payNumber === 1 ? 'PAYROLL 01' : payNumber === 2 ? 'PAYROLL 02' : 'PAYROLL 03';
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(this.accentColor)
      .text(payNumberText, this.margin, 60);

    // Generation date
    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#cccccc')
      .text(`Generated: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString()}`, this.margin, 85);

    doc.moveDown(4);
  }

  addProfessionalEmployeeInfo(doc, data) {
    doc.fillColor('#000');
    
    // Section title with underline
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text('EMPLOYEE INFORMATION', this.margin, doc.y);

    // Underline
    doc.moveTo(this.margin, doc.y + 5)
      .lineTo(this.pageWidth - this.margin, doc.y + 5)
      .strokeColor(this.secondaryColor)
      .stroke();

    doc.moveDown(1.5);

    // Two column layout
    const col1X = this.margin;
    const col2X = this.margin + (this.pageWidth - 2 * this.margin) / 2;
    const lineHeight = 20;

    const currentY = doc.y;

    // Left column
    doc.fontSize(9)
      .font('Helvetica');

    const leftCol = [
      { label: 'Guard Name:', value: data.guardName },
      { label: 'Client Name:', value: data.clientName },
      { label: 'Total Hours:', value: `${data.totalHours} hours` }
    ];

    leftCol.forEach((item, idx) => {
      doc.font('Helvetica-Bold')
        .fillColor(this.secondaryColor)
        .text(item.label, col1X, currentY + idx * lineHeight, { width: 100 });

      doc.font('Helvetica')
        .fillColor('#000')
        .text(item.value, col1X + 110, currentY + idx * lineHeight);
    });

    // Right column
    const rightCol = [
      { label: 'Account Holder:', value: data.accountHolderName },
      { label: 'Account Number:', value: data.accountNo },
      { label: 'Sort Code:', value: data.sortCode }
    ];

    rightCol.forEach((item, idx) => {
      doc.font('Helvetica-Bold')
        .fillColor(this.secondaryColor)
        .text(item.label, col2X, currentY + idx * lineHeight, { width: 100 });

      doc.font('Helvetica')
        .fillColor('#000')
        .text(item.value, col2X + 110, currentY + idx * lineHeight);
    });

    doc.moveDown(3.5);
  }

  addProfessionalPaymentDetails(doc, data, payNumber) {
    // Section title
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text('PAYMENT SUMMARY', this.margin, doc.y);

    // Underline
    doc.moveTo(this.margin, doc.y + 5)
      .lineTo(this.pageWidth - this.margin, doc.y + 5)
      .strokeColor(this.secondaryColor)
      .stroke();

    doc.moveDown(1.5);

    const payAmount = payNumber === 1 ? data.pay1 : payNumber === 2 ? data.pay2 : data.pay3;
    const calculatedAmount = data.totalHours * data.payRate;

    // Table dimensions
    const tableX = this.margin;
    const tableWidth = this.pageWidth - 2 * this.margin;
    const col1Width = tableWidth * 0.65;
    const col2Width = tableWidth * 0.35;
    const rowHeight = 25;

    // Table header
    const headerY = doc.y;
    doc.rect(tableX, headerY, col1Width, rowHeight)
      .fillAndStroke(this.primaryColor, this.primaryColor);

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('Description', tableX + 12, headerY + 6, { width: col1Width - 24 });

    doc.rect(tableX + col1Width, headerY, col2Width, rowHeight)
      .fillAndStroke(this.primaryColor, this.primaryColor);

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('Amount', tableX + col1Width + 12, headerY + 6, { width: col2Width - 24, align: 'right' });

    doc.moveDown(1.8);

    // Table rows
    const rows = [
      { label: 'Hours Worked', value: data.totalHours.toString() },
      { label: 'Hourly Rate', value: `£${data.payRate.toFixed(2)}` },
      { label: 'Calculated Amount (Hours × Rate)', value: `£${calculatedAmount.toFixed(2)}` },
      { label: 'Approved Payment Amount', value: `£${payAmount.toFixed(2)}` }
    ];

    rows.forEach((row, idx) => {
      const bgColor = idx % 2 === 0 ? this.lightGray : '#ffffff';
      const borderColor = this.borderColor;
      const rowY = doc.y;

      // Left cell
      doc.rect(tableX, rowY, col1Width, rowHeight)
        .fillAndStroke(bgColor, borderColor);

      doc.fontSize(9)
        .font(idx === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(idx === rows.length - 1 ? this.primaryColor : '#000')
        .text(row.label, tableX + 12, rowY + 7, { width: col1Width - 24 });

      // Right cell - use same rowY for alignment
      doc.rect(tableX + col1Width, rowY, col2Width, rowHeight)
        .fillAndStroke(bgColor, borderColor);

      doc.fontSize(9)
        .font(idx === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(idx === rows.length - 1 ? this.accentColor : '#000')
        .text(row.value, tableX + col1Width + 12, rowY + 7, { width: col2Width - 24, align: 'right' });

      doc.moveDown(1.8);
    });

    // Total row
    const totalY = doc.y;
    doc.rect(tableX, totalY, col1Width, rowHeight * 1.2)
      .fillAndStroke(this.primaryColor, this.primaryColor);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('TOTAL PAYMENT DUE', tableX + 12, totalY + 8, { width: col1Width - 24 });

    doc.rect(tableX + col1Width, totalY, col2Width, rowHeight * 1.2)
      .fillAndStroke(this.accentColor, this.accentColor);

    doc.fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text(`£${payAmount.toFixed(2)}`, tableX + col1Width + 12, totalY + 8, { width: col2Width - 24, align: 'right' });

    doc.moveDown(2.5);
  }

  addBankDetailsSection(doc, data) {
    // Section title
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text('BANK TRANSFER DETAILS', this.margin, doc.y);

    // Underline
    doc.moveTo(this.margin, doc.y + 5)
      .lineTo(this.pageWidth - this.margin, doc.y + 5)
      .strokeColor(this.secondaryColor)
      .stroke();

    doc.moveDown(1.5);

    // Info box
    doc.rect(this.margin, doc.y, this.pageWidth - 2 * this.margin, 70)
      .fillAndStroke(this.lightGray, this.borderColor);

    const boxX = this.margin + 12;
    const boxY = doc.y + 10;

    doc.fontSize(9)
      .font('Helvetica');

    doc.fillColor(this.secondaryColor)
      .font('Helvetica-Bold')
      .text('Account Holder:', boxX, boxY);

    doc.fillColor('#000')
      .font('Helvetica')
      .text(data.accountHolderName, boxX + 110, boxY);

    doc.fillColor(this.secondaryColor)
      .font('Helvetica-Bold')
      .text('Account Number:', boxX, boxY + 20);

    doc.fillColor('#000')
      .font('Helvetica')
      .text(data.accountNo, boxX + 110, boxY + 20);

    doc.fillColor(this.secondaryColor)
      .font('Helvetica-Bold')
      .text('Sort Code:', boxX, boxY + 40);

    doc.fillColor('#000')
      .font('Helvetica')
      .text(data.sortCode, boxX + 110, boxY + 40);

    doc.moveDown(4.5);
  }

  addProfessionalFooter(doc) {
    // Divider line
    doc.moveTo(this.margin, doc.y)
      .lineTo(this.pageWidth - this.margin, doc.y)
      .strokeColor(this.borderColor)
      .stroke();

    doc.moveDown(1);

    // Footer text
    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text('This is an automatically generated payroll document. Please retain for your records. For any discrepancies, contact your administrator.', 
            this.margin, doc.y, { align: 'center', width: this.pageWidth - 2 * this.margin });

    doc.moveDown(0.5);

    doc.fontSize(7)
      .fillColor('#999999')
      .text(`Generated on ${new Date().toLocaleDateString()} | Document ID: ${Date.now()}`, 
            { align: 'center' });

    doc.fillColor('#000');
  }

  async generateBulkPayrollPDF(payrollDataArray, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.margin
        });

        let buffers = [];

        if (outputPath) {
          // For local file system (localhost)
          const stream = fs.createWriteStream(outputPath);
          doc.pipe(stream);

          payrollDataArray.forEach((data, index) => {
            if (index > 0) {
              doc.addPage();
            }

            this.addProfessionalHeader(doc, 1);
            this.addProfessionalEmployeeInfo(doc, data);
            this.addProfessionalPaymentDetails(doc, data, 1);
            this.addBankDetailsSection(doc, data);
            this.addProfessionalFooter(doc);
          });

          doc.end();

          stream.on('finish', () => {
            resolve(outputPath);
          });

          stream.on('error', (error) => {
            reject(error);
          });
        } else {
          // For serverless (Vercel) - return buffer
          doc.on('data', (chunk) => {
            buffers.push(chunk);
          });

          doc.on('end', () => {
            resolve(Buffer.concat(buffers));
          });

          doc.on('error', (error) => {
            reject(error);
          });

          payrollDataArray.forEach((data, index) => {
            if (index > 0) {
              doc.addPage();
            }

            this.addProfessionalHeader(doc, 1);
            this.addProfessionalEmployeeInfo(doc, data);
            this.addProfessionalPaymentDetails(doc, data, 1);
            this.addBankDetailsSection(doc, data);
            this.addProfessionalFooter(doc);
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
