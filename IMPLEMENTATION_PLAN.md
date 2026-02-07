# Payroll System - Implementation Plan
**Date:** February 4, 2026  
**Client:** Security Guards Payroll System

---

## 📋 CURRENT vs REQUIRED STATE

### Current Implementation
- ✅ Basic payroll management (Client, Guard, Hours, Rates)
- ✅ Multiple payment splits (Pay1, Pay2, Pay3)
- ✅ Single bank account support
- ✅ PDF & Excel export
- ❌ No visa/immigration tracking
- ❌ No insurance number field
- ❌ No multiple bank accounts
- ❌ No nationality tracking
- ❌ No passport/share code management

---

## 🎯 REQUIRED ENHANCEMENTS

### Phase 1: Database Schema Updates (HIGH PRIORITY)

#### Guard Information Model
```
NEW FIELDS TO ADD:
├── Nationality (String)
├── Visa Status (Dropdown):
│   ├── Student
│   ├── Skilled Worker
│   ├── PSW (Points-Based System)
│   ├── Dependent/Spouse
│   ├── Permanent Resident
│   ├── Settled Status
│   ├── Pre-Settled Status
│   └── Refugee/Asylum
├── Insurance Number (String - Unique)
├── British Passport (Boolean)
├── Share Code (String - Conditional, if not British passport)
└── Share Code Expiry Date (Date - Conditional)
```

#### Bank Details Model (NEW - Support Multiple Accounts)
```
BankAccount Schema:
├── Account Holder Name (String)
├── Bank Name (String)
├── Sort Code (String)
├── Account Number (String)
├── Is Primary (Boolean)
└── Active (Boolean)
```

#### Working Hours Enhancement
```
CHANGE FROM:
├── totalHours (Number)

CHANGE TO:
├── totalHours (Number) - Only hours
├── totalMinutes (Number) - Only minutes
├── totalHoursDecimal (Number) - Calculated: hours + (minutes/60)
```

#### Payment Split Management
```
UPDATE:
├── Replace pay1, pay2, pay3
├── New: payments (Array of Objects):
│   ├── accountId (Reference to BankAccount)
│   ├── amount (Number)
│   ├── percentage (Number)
│   ├── sortOrder (Number)
│   └── notes (String)
```

---

### Phase 2: UI/Form Updates (HIGH PRIORITY)

#### Dashboard Enhancements
- Add filters for: Visa Status, Insurance Number, Nationality
- Add columns to table: Visa Status, Insurance Number, Multiple Bank Accounts (summary)
- Create "View Details" modal for full guard information

#### Add/Edit Form Structure
```
SECTION 1: Guard Basic Information
├── Guard Name (Text)
├── Nationality (Text/Dropdown)
└── Insurance Number (Text - Unique)

SECTION 2: Immigration Status
├── Visa Status (Dropdown with 8 options)
├── British Passport (Toggle/Checkbox)
├── Share Code (Text - Shows only if NOT British Passport)
└── Share Code Expiry Date (Date - Shows only if NOT British Passport)

SECTION 3: Working Hours
├── Total Hours (Number)
└── Total Minutes (Number)

SECTION 4: Bank Account(s)
├── [DYNAMIC TABLE]
├── Account Holder Name
├── Bank Name
├── Sort Code
├── Account Number
├── Primary Account (Checkbox)
├── [+ Add Another Account] Button
└── [Remove] Button (for each account)

SECTION 5: Rates & Payment Allocation
├── Charge Rate (Per Hour)
├── Base Pay Rate (Per Hour)
├── Payment Split Distribution:
│   ├── [Table showing split across bank accounts]
│   ├── Account + Amount + Percentage
│   └── Auto-calculate total = 100%

SECTION 6: Client Information
├── Client Name
└── Site Name (Optional)
```

---

### Phase 3: Report Generation Updates (HIGH PRIORITY)

#### Excel Report Fields
The Excel export should include:
```
| Field | Type | Notes |
|-------|------|-------|
| Guard Name | Text | |
| Nationality | Text | |
| Total Hours | Number | |
| Total Minutes | Number | |
| Visa Status | Text | |
| Insurance Number | Text | |
| Share Code | Text | Only if applicable |
| Share Code Expiry | Date | Only if applicable |
| British Passport | Yes/No | |
| Bank Account 1 Name | Text | |
| Bank 1 Name | Text | |
| Bank 1 Sort Code | Text | |
| Bank 1 Account Number | Text | |
| Bank Account 2 Name | Text | Optional |
| Bank 2 Name | Text | Optional |
| Bank 2 Sort Code | Text | Optional |
| Bank 2 Account Number | Text | Optional |
| Charge Rate | Currency | Per hour |
| Pay Rate | Currency | Per hour |
| Pay Account 1 Amount | Currency | |
| Pay Account 2 Amount | Currency | |
| Total Pay | Currency | Calculated |
```

#### PDF Report Fields
Same as Excel but with professional formatting:
- Guard profile section
- Visa/Immigration information
- Bank details clearly separated
- Payment breakdown
- Signature lines

---

## 🔧 TECHNICAL IMPLEMENTATION STEPS

### Step 1: Update Mongoose Model (`models/Payroll.js`)
- [ ] Replace current simple bank fields with array of BankAccount objects
- [ ] Add visa information fields
- [ ] Add minutes field separate from hours
- [ ] Add nationality and insurance number
- [ ] Create validation for share code (required if not British passport)
- [ ] Add indexes for insurance number (unique), visa status

### Step 2: Update Form Views (`views/index.ejs`)
- [ ] Add conditional visa/passport fields (show/hide based on British Passport checkbox)
- [ ] Add dynamic bank account section with add/remove buttons
- [ ] Implement payment split calculator
- [ ] Add nationality field
- [ ] Add insurance number field
- [ ] Separate hours and minutes inputs

### Step 3: Update Backend Routes (`app.js`)
- [ ] Update POST /add-record validation rules
- [ ] Update PUT /update-record for new fields
- [ ] Add validation for multiple bank accounts
- [ ] Add validation for conditional share code
- [ ] Add validation for insurance number uniqueness
- [ ] Implement payment split logic

### Step 4: Update Export Utilities
- [ ] Modify `utils/excelParser.js` for new fields
- [ ] Modify `utils/pdfGenerator.js` for professional layout
- [ ] Add bank account loop in both export functions
- [ ] Add conditional share code in exports
- [ ] Format visa information properly

### Step 5: Update Dashboard
- [ ] Add new filter fields
- [ ] Add new table columns
- [ ] Create "View Full Details" modal
- [ ] Update export logic to include all fields

---

## 📊 DATA STRUCTURE EXAMPLES

### Guard Record Example (JSON)
```json
{
  "_id": "ObjectId",
  "clientName": "SES Security",
  "siteName": "Arnold Laver Peterborough",
  "guardName": "John Smith",
  "nationality": "British",
  "visaStatus": "Settled Status",
  "insuranceNumber": "AB 123 456 C",
  "britishPassport": true,
  "shareCode": null,
  "shareCodeExpiryDate": null,
  "totalHours": 40,
  "totalMinutes": 30,
  "chargeRate": 15.50,
  "payRate": 12.00,
  "bankAccounts": [
    {
      "_id": "ObjectId",
      "accountHolderName": "John Smith",
      "bankName": "Barclays",
      "sortCode": "20-00-00",
      "accountNumber": "12345678",
      "isPrimary": true,
      "active": true
    },
    {
      "_id": "ObjectId",
      "accountHolderName": "JS Family Account",
      "bankName": "HSBC",
      "sortCode": "40-00-00",
      "accountNumber": "87654321",
      "isPrimary": false,
      "active": true
    }
  ],
  "payments": [
    {
      "accountId": "ObjectId",
      "amount": 486.00,
      "percentage": 70,
      "sortOrder": 1,
      "notes": "Primary salary"
    },
    {
      "accountId": "ObjectId",
      "amount": 208.20,
      "percentage": 30,
      "sortOrder": 2,
      "notes": "Secondary account"
    }
  ],
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

---

## ✅ VALIDATION RULES

### Insurance Number
- Must be unique across all guards
- Format: Letters + Spaces + Numbers (e.g., AB 123 456 C)

### Share Code
- Required if: `britishPassport === false`
- Optional if: `britishPassport === true`
- Format: Alphanumeric

### Bank Accounts
- At least 1 account required
- Sort code format: DD-DD-DD
- Account number: 8 digits

### Payment Splits
- Total percentage must equal 100%
- Total amount must equal (totalHours + totalMinutes/60) × payRate
- Each account must be active

### Visa Status
- Dropdown only (no free text)
- 8 fixed options as specified

---

## 🎨 UI/UX NOTES

### Conditional Field Display
```javascript
// Show share code fields only if British Passport is NOT checked
if (britishPassport === false) {
  showFields(['shareCode', 'shareCodeExpiryDate']);
} else {
  hideFields(['shareCode', 'shareCodeExpiryDate']);
  clearValues(['shareCode', 'shareCodeExpiryDate']);
}
```

### Bank Account Management
- Drag-and-drop to reorder accounts
- Visual indication of primary account
- Quick-add button below table
- Inline editing with save/cancel
- Confirmation before delete

### Payment Split Calculator
- Auto-calculate when hours/minutes or pay rate changes
- Show estimated total pay
- Show distribution across accounts
- Warn if percentages don't equal 100%

---

## 📋 TESTING CHECKLIST

- [ ] Create guard with British Passport → share code fields hidden
- [ ] Create guard without British Passport → share code fields required
- [ ] Add multiple bank accounts → all saved correctly
- [ ] Edit payment split → recalculates automatically
- [ ] Export to PDF → shows all guard details correctly
- [ ] Export to Excel → matches all fields
- [ ] Filter by visa status → works correctly
- [ ] Search by insurance number → returns correct guard
- [ ] Update guard info → timestamps update
- [ ] Delete account from multi-account guard → remaining accounts work

---

## 🚀 DEPLOYMENT ORDER

1. **Database** - Update Payroll.js schema
2. **Forms** - Update frontend form structure
3. **Routes** - Update backend validation & logic
4. **Exports** - Update PDF & Excel generators
5. **Dashboard** - Update table & filters
6. **Testing** - Full system test
7. **Documentation** - Update guides

---

## 📞 NOTES FOR CLIENT

✅ **All requirements are achievable with the current tech stack**
- Node.js/Express/MongoDB support all needed fields
- EJS templating supports conditional fields
- XLSX and PDFKit support all export needs

⚠️ **Design Decisions Made:**
- Multiple bank accounts stored in array (normalized design)
- Share code only shown for non-British passport holders
- Payment splits stored as separate records for flexibility
- Insurance number marked as unique for data integrity

