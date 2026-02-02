# 💼 Payroll Management System

A production-level payroll management system built with Node.js, Express, EJS, and MongoDB. Features modern design with animations, advanced filtering, PDF/Excel export, and payroll document generation.

## 🌟 Features

### Core Features
- ✅ **Add/Edit/Delete** payroll records with form validation
- ✅ **Modern Dashboard** with responsive design and smooth animations
- ✅ **Advanced Filtering** by client name, guard name, and hours
- ✅ **Real-time Data Display** in sortable tables
- ✅ **Export Functionality** - PDF and Excel exports for all records

### Excel Import & Payroll Generation
- 📥 **Upload Excel Files** with drag-and-drop support
- 📊 **Auto-parse** Excel data with validation
- 📄 **Generate Individual Payroll PDFs**:
  - Payroll 01 (Pay 1)
  - Payroll 02 (Pay 2)
  - Payroll 03 (Pay 3)
- 🏦 **Bank Details** included in payroll documents

### Database Fields
- Client Name
- Guard Name
- Total Hours
- Pay Rate (£/hour)
- Charge Rate (£/hour)
- Pay 1, Pay 2, Pay 3 (£)
- Account Number
- Sort Code
- Account Holder Name

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local or Atlas)
- **npm** or **yarn**

## 🚀 Installation

### 1. Clone/Setup the Project

```bash
cd "Payroll App"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create/Update `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/payroll_system
PORT=5000
NODE_ENV=development
```

**MongoDB Options:**
- **Local MongoDB**: `mongodb://localhost:27017/payroll_system`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/payroll_system?retryWrites=true&w=majority`

### 4. Start MongoDB (if using local)

```bash
mongod
```

### 5. Start the Application

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The application will be available at: **http://localhost:5000**

## 📁 Project Structure

```
Payroll App/
├── app.js                      # Main server file (all backend logic)
├── .env                        # Environment variables
├── package.json                # Dependencies
├── models/
│   └── Payroll.js             # MongoDB Payroll model
├── public/
│   ├── css/
│   │   └── style.css          # Modern styling with animations
│   ├── js/
│   │   └── main.js            # Frontend interactions & AJAX
│   └── uploads/               # Temporary file storage
├── views/
│   ├── index.ejs              # Main dashboard
│   └── upload.ejs             # Excel upload page
└── utils/
    ├── pdfGenerator.js        # PDF generation (PDFKit)
    └── excelParser.js         # Excel parsing (XLSX)
```

## 📖 Usage Guide

### 🏠 Dashboard (Main Page)

1. **View Records**: All payroll records displayed in a table
2. **Add Record**: Click "Add Record" button or use the form
3. **Edit Record**: Click the pencil (✏️) button next to any record
4. **Delete Record**: Click the delete (🗑️) button
5. **Filter Data**: Use advanced filters at the top
6. **Export Data**: Export all records to PDF or Excel

### 📥 Excel Upload & Payroll Generation

1. Navigate to **Upload Excel** page
2. **Upload File**: Drag & drop or click to select Excel file
3. **Required Columns** (in Excel):
   - Client Name
   - Guard Name
   - Total Hours
   - Pay Rate
   - Charge Rate
   - Pay 1
   - Pay 2
   - Pay 3
   - Account No
   - Sort Code
   - Account Holder Name

4. **Generate Payroll**:
   - Click **Payroll 01** to generate PDF using Pay 1
   - Click **Payroll 02** to generate PDF using Pay 2
   - Click **Payroll 03** to generate PDF using Pay 3

### 📊 Advanced Filters

- **Client Name**: Search by client name (case-insensitive)
- **Guard Name**: Search by guard name (case-insensitive)
- **Min Hours**: Filter by minimum hours worked
- **Max Hours**: Filter by maximum hours worked
- **Apply Filters**: Show filtered results
- **Reset**: Clear all filters and show all records

### 💾 Export Options

**Export All Records:**
- **PDF**: Creates a multi-page PDF with all records
- **Excel**: Creates an Excel spreadsheet with all data

**Individual Payroll PDFs:**
- Generated from uploaded Excel data
- Includes employee info, hours, pay rate, and bank details
- Professional formatting ready for printing

## 🔐 Data Validation

The system validates:
- ✅ Required fields (not empty)
- ✅ Numeric fields (positive numbers)
- ✅ Sort code format
- ✅ Account number format
- ✅ File type (Excel only)
- ✅ File size (max 10MB)

## 🎨 Design Features

- **Modern UI**: Gradient backgrounds, smooth animations
- **Responsive Design**: Mobile-friendly interface
- **Dark Mode Support**: Professional color scheme
- **Loading States**: Visual feedback for operations
- **Error Handling**: User-friendly error messages
- **Alert System**: Success/Error/Warning notifications
- **Smooth Transitions**: CSS animations and transitions

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Frontend** | HTML + CSS + JavaScript |
| **Templating** | EJS |
| **PDF Generation** | PDFKit |
| **Excel Processing** | XLSX |
| **File Upload** | Multer |
| **Validation** | Express-validator |

## 📊 API Endpoints

### Payroll Records
- `GET /api/payroll` - Get all records
- `GET /api/payroll/:id` - Get specific record
- `POST /api/payroll` - Create new record
- `PUT /api/payroll/:id` - Update record
- `DELETE /api/payroll/:id` - Delete record
- `GET /api/payroll/filter` - Filter records

### File Operations
- `POST /api/upload/excel` - Upload and parse Excel
- `POST /api/payroll/generate-pdf` - Generate payroll PDF
- `POST /api/export/pdf` - Export all as PDF
- `POST /api/export/excel` - Export all as Excel

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Start MongoDB service or check MONGODB_URI in .env

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Change PORT in .env or kill process using the port

### Excel Upload Not Working
- Ensure file is .xlsx or .xls format
- Check file size (max 10MB)
- Verify Excel columns match required format

### PDF Not Generating
- Check if /public/uploads directory exists
- Verify write permissions for the directory
- Check Node.js console for detailed error

## 📝 Database Schema

```javascript
{
  clientName: String (required),
  guardName: String (required),
  totalHours: Number (min: 0),
  payRate: Number (min: 0),
  chargeRate: Number (min: 0),
  pay1: Number (min: 0),
  pay2: Number (min: 0),
  pay3: Number (min: 0),
  accountNo: String (required),
  sortCode: String (required),
  accountHolderName: String (required),
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Production Considerations

1. **Environment Variables**: Update .env for production
2. **MongoDB**: Use MongoDB Atlas for cloud hosting
3. **Security**: Add authentication/authorization
4. **HTTPS**: Deploy with SSL certificates
5. **Rate Limiting**: Implement API rate limiting
6. **Input Sanitization**: Additional XSS protection
7. **CORS**: Configure CORS for security
8. **File Storage**: Consider cloud storage (AWS S3, Azure Blob)
9. **Backup**: Regular database backups
10. **Logging**: Implement comprehensive logging

## 📧 Support & Contributing

For issues or suggestions, please refer to the code comments and documentation within each file.

## 📄 License

ISC

---

**Happy Payroll Management! 🎉**

For more information, check the inline comments in `app.js` and other source files.
