const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Payroll PDF Generator
 * Supports visa information, multiple bank accounts, and immigration details
 */
class EnhancedPayrollPDFGenerator {
  constructor() {
    this.pageWidth = 595; // A4 width in points
    this.pageHeight = 842; // A4 height in points
    this.margin = 40;
    this.primaryColor = '#1a365d';
    this.secondaryColor = '#2d5a8c';
    this.accentColor = '#27ae60';
    this.dangerColor = '#dc3545';
    this.lightGray = '#f8f9fa';
    this.borderColor = '#dee2e6';
  }

  /**
   * Generate comprehensive payroll PDF with all guard information
   */
  generatePayrollPDF(payrollData, outputPath) {
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
          this.buildPDFContent(doc, payrollData);
          doc.end();

          stream.on('finish', () => resolve(outputPath));
          stream.on('error', reject);
        } else {
          doc.on('data', chunk => buffers.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(buffers)));
          doc.on('error', reject);

          this.buildPDFContent(doc, payrollData);
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
  buildPDFContent(doc, data) {
    // Header
    this.addHeader(doc);

    // Guard Information Section
    this.addGuardInformation(doc, data);

    // Visa & Immigration Section
    this.addVisaInformation(doc, data);

    // Working Hours & Rates Section
    this.addWorkingHoursSection(doc, data);

    // Bank Account(s) Section
    this.addBankAccountsSection(doc, data);

    // Payment Summary Section
    this.addPaymentSummary(doc, data);

    // Footer
    this.addFooter(doc);
  }

  /**
   * Add professional header with company branding
   */
  addHeader(doc) {
    // Background
    doc.rect(this.margin - 40, this.margin - 40, this.pageWidth - 2 * (this.margin - 40), 80)
      .fill(this.primaryColor);

    // Title
    doc.fontSize(28)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('PAYROLL STATEMENT', this.margin, 50, { align: 'left' })
      .fontSize(11)
      .font('Helvetica')
      .text('Security Guard Employment Record', this.margin, 80);

    // Date info on right
    doc.fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 
        this.pageWidth - this.margin - 150, 50, { width: 150, align: 'right' });

    doc.fillColor('#000000');
    doc.y = 130;
  }

  /**
   * Add guard basic information section
   */
  addGuardInformation(doc, data) {
    this.addSectionTitle(doc, '👤 GUARD INFORMATION');

    const infoBoxX = this.margin;
    const infoBoxWidth = this.pageWidth - 2 * this.margin;
    const infoBoxHeight = 100;

    // Background
    doc.rect(infoBoxX, doc.y, infoBoxWidth, infoBoxHeight)
      .fill(this.lightGray);

    const infoY = doc.y + 10;
    doc.fontSize(10);

    // Left column
    doc.fillColor('#666666');
    doc.text('Guard Name:', infoBoxX + 10, infoY, { continued: false });
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.guardName || 'N/A', infoBoxX + 110, infoY - 10);

    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#666666');
    doc.text('Nationality:', infoBoxX + 10, infoY + 20, { continued: false });
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.nationality || 'N/A', infoBoxX + 110, infoY + 10);

    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#666666');
    doc.text('Insurance Number:', infoBoxX + 10, infoY + 40, { continued: false });
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.insuranceNumber || 'N/A', infoBoxX + 110, infoY + 30);

    // Right column
    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#666666');
    doc.text('Client Name:', infoBoxX + infoBoxWidth / 2 + 10, infoY, { continued: false });
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.clientName || 'N/A', infoBoxX + infoBoxWidth / 2 + 110, infoY - 10);

    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#666666');
    doc.text('Site Name:', infoBoxX + infoBoxWidth / 2 + 10, infoY + 20, { continued: false });
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.siteName || 'N/A', infoBoxX + infoBoxWidth / 2 + 110, infoY + 10);

    doc.y = infoY + 100;
  }

  /**
   * Add visa and immigration information
   */
  addVisaInformation(doc, data) {
    this.addSectionTitle(doc, '🛂 VISA & IMMIGRATION STATUS');

    const infoBoxX = this.margin;
    const infoBoxWidth = this.pageWidth - 2 * this.margin;

    // Background
    doc.rect(infoBoxX, doc.y, infoBoxWidth, 70)
      .fill(this.lightGray);

    const infoY = doc.y + 10;
    doc.fontSize(10);

    // Visa Status
    doc.fillColor('#666666');
    doc.text('Visa Status:', infoBoxX + 10, infoY);
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.visaStatus || 'N/A', infoBoxX + 110, infoY - 10);

    // British Passport
    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#666666');
    doc.text('British Passport:', infoBoxX + 10, infoY + 20);
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(data.britishPassport ? '✓ Yes' : '✗ No', infoBoxX + 110, infoY + 10);

    // Share Code (if applicable)
    if (!data.britishPassport && data.shareCode) {
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#666666');
      doc.text('Share Code:', infoBoxX + infoBoxWidth / 2 + 10, infoY);
      doc.fillColor('#000000');
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(data.shareCode || 'N/A', infoBoxX + infoBoxWidth / 2 + 110, infoY - 10);

      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#666666');
      doc.text('Expiry Date:', infoBoxX + infoBoxWidth / 2 + 10, infoY + 20);
      doc.fillColor('#000000');
      doc.fontSize(11).font('Helvetica-Bold');
      const expiryDate = data.shareCodeExpiryDate ? new Date(data.shareCodeExpiryDate).toLocaleDateString('en-GB') : 'N/A';
      doc.text(expiryDate, infoBoxX + infoBoxWidth / 2 + 110, infoY + 10);
    }

    doc.y += 80;
  }

  /**
   * Add working hours and rates section
   */
  addWorkingHoursSection(doc, data) {
    this.addSectionTitle(doc, '⏰ WORKING HOURS & RATES');

    const tableX = this.margin;
    const tableWidth = this.pageWidth - 2 * this.margin;
    const colWidth = tableWidth / 2;

    // Set default values for missing data
    const totalHours = data.totalHours || 0;
    const totalMinutes = data.totalMinutes || 0;
    const payRate = parseFloat(data.payRate) || 0;
    const chargeRate = parseFloat(data.chargeRate) || 0;
    const totalHoursDecimal = totalHours + totalMinutes / 60;

    // Draw table
    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Total Hours', width: colWidth / 2 },
      { text: totalHours.toString(), width: colWidth / 2 },
      { text: 'Total Minutes', width: colWidth / 2 },
      { text: totalMinutes.toString(), width: colWidth / 2 }
    ]);

    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Hours in Decimal', width: colWidth / 2 },
      { text: totalHoursDecimal.toFixed(2), width: colWidth / 2 },
      { text: 'Pay Rate (£/hour)', width: colWidth / 2 },
      { text: '£' + payRate.toFixed(2), width: colWidth / 2 }
    ]);

    this.drawTableRow(doc, tableX, doc.y, [
      { text: 'Charge Rate (£/hour)', width: colWidth / 2 },
      { text: '£' + chargeRate.toFixed(2), width: colWidth / 2 },
      { text: 'Total Pay', width: colWidth / 2 },
      { text: '£' + (totalHoursDecimal * payRate).toFixed(2), width: colWidth / 2, isBold: true }
    ]);

    doc.y += 20;
  }

  /**
   * Add bank account(s) section
   */
  addBankAccountsSection(doc, data) {
    this.addSectionTitle(doc, '🏦 BANK ACCOUNT DETAILS');

    if (!data.bankAccounts || data.bankAccounts.length === 0) {
      // Fallback to legacy fields
      this.addLegacyBankDetails(doc, data);
      return;
    }

    data.bankAccounts.forEach((account, index) => {
      const infoBoxX = this.margin;
      const infoBoxWidth = this.pageWidth - 2 * this.margin;

      // Account header
      doc.fontSize(11).font('Helvetica-Bold')
        .fillColor(this.secondaryColor);
      if (account.isPrimary) {
        doc.text(`Account ${index + 1} (PRIMARY)`, infoBoxX, doc.y);
      } else {
        doc.text(`Account ${index + 1}`, infoBoxX, doc.y);
      }

      doc.fontSize(10).font('Helvetica');

      // Background
      doc.rect(infoBoxX, doc.y + 5, infoBoxWidth, 65)
        .fill(this.lightGray);

      const infoY = doc.y + 15;
      doc.fillColor('#000000');

      // Account details in 2x2 grid
      doc.text('Account Holder:', infoBoxX + 10, infoY);
      doc.text(account.accountHolderName || 'N/A', infoBoxX + 140, infoY);

      doc.text('Bank Name:', infoBoxX + 10, infoY + 15);
      doc.text(account.bankName || 'N/A', infoBoxX + 140, infoY + 15);

      doc.text('Sort Code:', infoBoxX + 10, infoY + 30);
      doc.text(account.sortCode || 'N/A', infoBoxX + 140, infoY + 30);

      doc.text('Account Number:', infoBoxX + 10, infoY + 45);
      doc.text(account.accountNumber || 'N/A', infoBoxX + 140, infoY + 45);

      doc.y += 75;
    });
  }

  /**
   * Add legacy bank details (fallback)
   */
  addLegacyBankDetails(doc, data) {
    const infoBoxX = this.margin;
    const infoBoxWidth = this.pageWidth - 2 * this.margin;

    doc.rect(infoBoxX, doc.y, infoBoxWidth, 65)
      .fill(this.lightGray);

    const infoY = doc.y + 10;
    doc.fontSize(10);

    doc.fillColor('#666666');
    doc.text('Account Holder:', infoBoxX + 10, infoY);
    doc.fillColor('#000000');
    doc.text(data.accountHolderName || 'N/A', infoBoxX + 140, infoY);

    doc.fillColor('#666666');
    doc.text('Sort Code:', infoBoxX + 10, infoY + 15);
    doc.fillColor('#000000');
    doc.text(data.sortCode || 'N/A', infoBoxX + 140, infoY + 15);

    doc.fillColor('#666666');
    doc.text('Account Number:', infoBoxX + 10, infoY + 30);
    doc.fillColor('#000000');
    doc.text(data.accountNo || 'N/A', infoBoxX + 140, infoY + 30);

    doc.y += 75;
  }

  /**
   * Add payment summary
   */
  addPaymentSummary(doc, data) {
    this.addSectionTitle(doc, '💰 PAYMENT SUMMARY');

    const summaryBoxX = this.margin;
    const summaryBoxWidth = this.pageWidth - 2 * this.margin;

    // Summary info
    const totalHoursDecimal = data.totalHours + data.totalMinutes / 60;
    const totalPay = totalHoursDecimal * parseFloat(data.payRate);

    doc.rect(summaryBoxX, doc.y, summaryBoxWidth, 50)
      .fill(this.accentColor);

    doc.fontSize(14).font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('Total Payment Due: £' + totalPay.toFixed(2), summaryBoxX + 20, doc.y + 15);

    doc.fontSize(10).font('Helvetica')
      .text(`Calculation: ${totalHoursDecimal.toFixed(2)} hours × £${parseFloat(data.payRate).toFixed(2)}/hour = £${totalPay.toFixed(2)}`, 
        summaryBoxX + 20, doc.y + 15);

    doc.y += 60;
  }

  /**
   * Add section title with decorative line
   */
  addSectionTitle(doc, title) {
    doc.fontSize(12).font('Helvetica-Bold')
      .fillColor(this.primaryColor)
      .text(title, this.margin, doc.y);

    doc.moveTo(this.margin, doc.y + 3)
      .lineTo(this.pageWidth - this.margin, doc.y + 3)
      .strokeColor(this.accentColor)
      .stroke();

    doc.y += 25;
  }

  /**
   * Draw a table row
   */
  drawTableRow(doc, startX, startY, cols) {
    const rowHeight = 25;
    const padding = 8;

    // Draw background for alternate rows
    let currentX = startX;
    
    cols.forEach(col => {
      doc.rect(currentX, startY, col.width, rowHeight)
        .fillAndStroke(this.lightGray, this.borderColor);

      doc.fontSize(10);
      if (col.isBold) {
        doc.font('Helvetica-Bold');
      } else {
        doc.font('Helvetica');
      }
      doc.fillColor('#000000')
        .text(col.text, currentX + padding, startY + padding + 2, { 
          width: col.width - 2 * padding,
          align: 'left'
        });

      currentX += col.width;
    });

    doc.y = startY + rowHeight;
  }

  /**
   * Add professional footer
   */
  addFooter(doc) {
    const footerY = this.pageHeight - 60;

    // Line separator
    doc.moveTo(this.margin, footerY)
      .lineTo(this.pageWidth - this.margin, footerY)
      .strokeColor(this.borderColor)
      .stroke();

    // Footer text
    doc.fontSize(8).font('Helvetica')
      .fillColor('#999999')
      .text('This is an official payroll statement. Please retain for your records.', 
        this.margin, footerY + 10, { align: 'center' });

    doc.text(`Document generated on ${new Date().toLocaleString('en-GB')}`, 
      this.margin, footerY + 20, { align: 'center' });

    doc.text('Confidential - For Employee Use Only', 
      this.margin, footerY + 30, { align: 'center' });
  }
}

module.exports = EnhancedPayrollPDFGenerator;
