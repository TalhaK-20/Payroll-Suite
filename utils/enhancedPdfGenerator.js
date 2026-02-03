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
    // Handle both array and object inputs - if array, use first element
    const record = Array.isArray(data) ? data[0] : data;
    
    if (!record) {
      throw new Error('No payroll data provided for PDF generation');
    }
    
    // Header
    this.addHeader(doc);

    // Guard Information Section
    this.addGuardInformation(doc, record);

    // Visa & Immigration Section
    this.addVisaInformation(doc, record);

    // Working Hours & Rates Section
    this.addWorkingHoursSection(doc, record);

    // Bank Account(s) Section
    this.addBankAccountsSection(doc, record);

    // Payment Summary Section
    this.addPaymentSummary(doc, record);

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

    // Get hours distribution if available
    const primaryGuardHours = (data.hoursDistribution?.primaryGuardHours) || 0;
    const associatedGuardHours = (data.hoursDistribution?.associatedGuardHours) || 0;
    const associatedGuardName = (data.hoursDistribution?.associatedGuardName) || '';

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

    // Add hours distribution section if applicable
    if (primaryGuardHours > 0 || associatedGuardHours > 0) {
      doc.y += 10;
      this.drawTableRow(doc, tableX, doc.y, [
        { text: 'Primary Guard Hours', width: colWidth / 2 },
        { text: primaryGuardHours.toFixed(2), width: colWidth / 2 },
        { text: 'Associated Guard Hours', width: colWidth / 2 },
        { text: associatedGuardHours.toFixed(2), width: colWidth / 2 }
      ]);

      // Associated guard info if present
      if (associatedGuardName) {
        this.drawTableRow(doc, tableX, doc.y, [
          { text: 'Associated Guard', width: colWidth / 2 },
          { text: associatedGuardName, width: colWidth / 2 },
          { text: 'Guard Pay', width: colWidth / 2 },
          { text: '£' + (associatedGuardHours * payRate).toFixed(2), width: colWidth / 2 }
        ]);
      }
    }

    doc.y += 20;
  }

  /**
   * Add bank accounts section
   */
  addBankAccountsSection(doc, data) {
    if (!data.bankAccounts || data.bankAccounts.length === 0) {
      return;
    }

    this.addSectionTitle(doc, '🏦 BANK ACCOUNT(S)');

    data.bankAccounts.forEach((account, index) => {
      const isActive = account.active !== false;
      const isPrimary = account.isPrimary === true;
      
      const statusColor = isActive ? this.accentColor : '#ccc';
      const statusText = isActive ? '✓ Active' : '✗ Inactive';

      // Account header
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.primaryColor);
      doc.text(`Account ${index + 1}${isPrimary ? ' (Primary)' : ''}`, this.margin, doc.y);

      // Account details box
      const boxX = this.margin;
      const boxWidth = this.pageWidth - 2 * this.margin;
      doc.rect(boxX, doc.y, boxWidth, 70).fill(this.lightGray);

      const boxY = doc.y + 10;
      doc.fontSize(9).font('Helvetica').fillColor('#666666');

      // Account holder name
      doc.text('Account Holder:', boxX + 10, boxY);
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
      doc.text(account.accountHolderName || 'N/A', boxX + 150, boxY - 9);

      // Bank name
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('Bank Name:', boxX + 10, boxY + 15);
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
      doc.text(account.bankName || 'N/A', boxX + 150, boxY + 6);

      // Sort code
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('Sort Code:', boxX + 10, boxY + 30);
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
      doc.text(account.sortCode || 'N/A', boxX + 150, boxY + 21);

      // Account number
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('Account #:', boxX + 10, boxY + 45);
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
      doc.text(account.accountNumber || 'N/A', boxX + 150, boxY + 36);

      // Status badge
      doc.fillColor(statusColor).fontSize(9).font('Helvetica-Bold');
      doc.text(statusText, boxX + boxWidth - 100, boxY);

      doc.y += 85;
    });
  }

  /**
   * Add payment summary section
   */
  addPaymentSummary(doc, data) {
    this.addSectionTitle(doc, '💰 PAYMENT SUMMARY');

    const totalHoursDecimal = (data.totalHours || 0) + ((data.totalMinutes || 0) / 60);
    const payRate = parseFloat(data.payRate) || 0;
    const chargeRate = parseFloat(data.chargeRate) || 0;
    const totalPay = totalHoursDecimal * payRate;
    const totalCharge = totalHoursDecimal * chargeRate;

    // Get hours distribution if available
    const primaryGuardHours = (data.hoursDistribution?.primaryGuardHours) || totalHoursDecimal;
    const associatedGuardHours = (data.hoursDistribution?.associatedGuardHours) || 0;
    const associatedGuardName = (data.hoursDistribution?.associatedGuardName) || '';

    const summaryBoxX = this.margin;
    const summaryBoxWidth = this.pageWidth - 2 * this.margin;

    // Summary box
    doc.rect(summaryBoxX, doc.y, summaryBoxWidth, 100)
      .stroke(this.borderColor);

    const summaryY = doc.y + 15;

    // Left column
    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text('Hours Worked:', summaryBoxX + 20, summaryY);
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.text(totalHoursDecimal.toFixed(2) + ' hours', summaryBoxX + 150, summaryY - 10);

    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text('Pay Rate:', summaryBoxX + 20, summaryY + 20);
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.text('£' + payRate.toFixed(2) + '/hour', summaryBoxX + 150, summaryY + 10);

    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text('Primary Guard Hours:', summaryBoxX + 20, summaryY + 40);
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.text(primaryGuardHours.toFixed(2) + ' hours', summaryBoxX + 150, summaryY + 30);

    // Right column
    doc.fontSize(12).font('Helvetica-Bold').fillColor(this.accentColor);
    doc.text('TOTAL PAY:', summaryBoxX + summaryBoxWidth / 2 + 20, summaryY);
    doc.fontSize(14).fillColor(this.accentColor);
    doc.text('£' + totalPay.toFixed(2), summaryBoxX + summaryBoxWidth / 2 + 150, summaryY - 10);

    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text('Charge Rate:', summaryBoxX + summaryBoxWidth / 2 + 20, summaryY + 20);
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.text('£' + chargeRate.toFixed(2) + '/hour', summaryBoxX + summaryBoxWidth / 2 + 150, summaryY + 10);

    // Associated guard info if present
    if (associatedGuardHours > 0 && associatedGuardName) {
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(associatedGuardName + ' Hours:', summaryBoxX + summaryBoxWidth / 2 + 20, summaryY + 40);
      doc.fillColor('#000000').font('Helvetica-Bold');
      doc.text(associatedGuardHours.toFixed(2) + ' hours', summaryBoxX + summaryBoxWidth / 2 + 150, summaryY + 30);
    }

    doc.y += 120;
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
    doc.fontSize(9)
      .fillColor('#999999')
      .text('This is a confidential payroll statement. For official use only.', 
        this.margin, footerY + 10, 
        { align: 'center', width: this.pageWidth - 2 * this.margin });

    doc.fontSize(8)
      .text('Generated on ' + new Date().toLocaleString('en-GB'), 
        this.margin, footerY + 25, 
        { align: 'center', width: this.pageWidth - 2 * this.margin });
  }

  /**
   * Add section title
   */
  addSectionTitle(doc, title) {
    const sectionY = doc.y + 10;

    // Background line
    doc.rect(this.margin, sectionY, this.pageWidth - 2 * this.margin, 30)
      .fill(this.primaryColor);

    // Title
    doc.fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text(title, this.margin + 15, sectionY + 6, { width: this.pageWidth - 2 * this.margin - 30 });

    doc.y = sectionY + 35;
  }

  /**
   * Draw a table row
   */
  drawTableRow(doc, startX, startY, cells) {
    const rowHeight = 30;
    const borderColor = this.borderColor;

    // Draw cells
    let currentX = startX;
    cells.forEach(cell => {
      const cellWidth = cell.width;

      // Cell background
      doc.rect(currentX, startY, cellWidth, rowHeight)
        .fillAndStroke(this.lightGray, borderColor);

      // Cell text
      doc.fontSize(10);
      if (cell.isBold) {
        doc.font('Helvetica-Bold').fillColor(this.primaryColor);
      } else {
        doc.font('Helvetica').fillColor('#333333');
      }

      doc.text(cell.text, currentX + 8, startY + 8, {
        width: cellWidth - 16,
        align: 'left'
      });

      currentX += cellWidth;
    });

    doc.y = startY + rowHeight;
  }
}

module.exports = EnhancedPayrollPDFGenerator;
