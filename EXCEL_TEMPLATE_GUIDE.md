# Payroll Upload Template

This is a guide to create the Excel file for uploading payroll data.

## Required Columns

Your Excel file **MUST** have exactly these column headers in the first row:

1. **Client Name** - Name of the client/company
2. **Guard Name** - Name of the security guard
3. **Total Hours** - Total hours worked (number)
4. **Pay Rate** - Pay rate per hour in £ (number)
5. **Charge Rate** - Charge rate per hour in £ (number)
6. **Pay 1** - Payment amount for Payroll 01 in £ (number)
7. **Pay 2** - Payment amount for Payroll 02 in £ (number)
8. **Pay 3** - Payment amount for Payroll 03 in £ (number)
9. **Account No** - Bank account number (text, e.g., 12345678)
10. **Sort Code** - Bank sort code (text, e.g., 20-20-20)
11. **Account Holder Name** - Name on the bank account

## Example Data

| Client Name | Guard Name | Total Hours | Pay Rate | Charge Rate | Pay 1 | Pay 2 | Pay 3 | Account No | Sort Code | Account Holder Name |
|---|---|---|---|---|---|---|---|---|---|---|
| ABC Security Ltd | John Smith | 40 | 12.50 | 18.75 | 500 | 550 | 600 | 12345678 | 20-20-20 | John Smith |
| XYZ Protection | Sarah Johnson | 35 | 13.00 | 19.50 | 455 | 500 | 550 | 87654321 | 30-30-30 | Sarah Johnson |
| Guardian Services | Mike Brown | 40 | 12.50 | 18.75 | 500 | 525 | 575 | 11223344 | 40-40-40 | Mike Brown |

## Important Notes

### ✅ DO:
- Save file as **.xlsx** (Excel format)
- Use exactly the column headers shown above
- Ensure all numeric fields contain numbers (not text)
- Keep Sort Code format like: XX-XX-XX (e.g., 20-20-20)
- All required fields must be filled

### ❌ DON'T:
- Skip columns or change column names
- Leave required fields empty
- Use text for numeric values (hours, rates, pay)
- Upload .xls format (must be .xlsx)
- Upload files larger than 10MB

## How to Create the File

### Using Microsoft Excel:
1. Open Excel
2. Create headers in first row (copy from above)
3. Enter data starting from row 2
4. Save as: **Payroll_Data.xlsx**
5. Upload to the system

### Using Google Sheets:
1. Create new spreadsheet
2. Add headers and data
3. Download as Excel (.xlsx)
4. Upload to the system

### Using LibreOffice Calc:
1. Create spreadsheet with data
2. File → Save As
3. Choose ODS or XLSX format
4. Upload to the system

## Validation Rules

The system will check:

| Rule | Example |
|------|---------|
| Client Name required | Must not be empty |
| Guard Name required | Must not be empty |
| Total Hours ≥ 0 | 0, 40, 35.5 ✅ / -5 ❌ |
| Pay Rate ≥ 0 | 12.50, 13.00 ✅ / -5 ❌ |
| Charge Rate ≥ 0 | 18.75, 19.50 ✅ / -5 ❌ |
| Pay 1, 2, 3 ≥ 0 | 500, 550.50 ✅ / -100 ❌ |
| Account No required | 12345678 ✅ / empty ❌ |
| Sort Code required | 20-20-20 ✅ / empty ❌ |
| Account Holder required | Must not be empty |

## Error Messages

If you see these errors, fix your Excel file:

- **"Client Name is required"** → Add client name to empty cell
- **"Total Hours must be a positive number"** → Enter valid hours (0 or more)
- **"Excel file is empty"** → File has no data rows
- **"Only Excel files allowed"** → Upload .xlsx, not .xls or other formats

## After Upload

Once uploaded successfully:

1. You'll see a table with all records
2. Click **Payroll 01** to generate PDF using Pay 1
3. Click **Payroll 02** to generate PDF using Pay 2
4. Click **Payroll 03** to generate PDF using Pay 3
5. PDFs will download automatically

## Tips

💡 **Tip 1**: Create a master Excel file and update it each pay period

💡 **Tip 2**: Use consistent formatting (e.g., always 40 hours, or 35.5 hours)

💡 **Tip 3**: Keep Sort Code format consistent (XX-XX-XX)

💡 **Tip 4**: Double-check account numbers are correct before uploading

💡 **Tip 5**: Save file with descriptive names like "Payroll_Jan2024.xlsx"

---

**Need help?** Check the QUICK_START.md file or README.md for more information.
