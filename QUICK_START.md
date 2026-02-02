# 🚀 Quick Start Guide - Payroll Management System

## Step 1: Install Dependencies

Open PowerShell in the Payroll App folder and run:

```powershell
npm install
```

This will install all required packages:
- express (web framework)
- mongoose (MongoDB)
- ejs (templating)
- multer (file uploads)
- xlsx (Excel)
- pdfkit (PDF generation)
- express-validator (validation)

**⏱️ This may take 2-3 minutes**

## Step 2: Setup MongoDB

### Option A: Local MongoDB
1. Install MongoDB Community Edition from: https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. Keep `.env` with: `MONGODB_URI=mongodb://localhost:27017/payroll_system`

### Option B: MongoDB Atlas (Cloud)
1. Create free account at: https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/payroll_system`
4. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/payroll_system?retryWrites=true&w=majority
   ```

## Step 3: Start the Application

In PowerShell, run:

```powershell
npm start
```

You should see:
```
╔════════════════════════════════════════════╗
║   PAYROLL MANAGEMENT SYSTEM STARTED        ║
╠════════════════════════════════════════════╣
║   Server is running on: http://localhost:5000
║   Database: mongodb://localhost:27017/payroll_system
║   Environment: development
╚════════════════════════════════════════════╝
```

## Step 4: Access the Application

Open your browser and go to: **http://localhost:5000**

You should see the Payroll Dashboard.

## 📊 Test the System

### Test 1: Add a Payroll Record
1. Click "Add Record" button
2. Fill in the form:
   - Client Name: ABC Security
   - Guard Name: John Smith
   - Total Hours: 40
   - Pay Rate: 12.50
   - Charge Rate: 18.75
   - Pay 1: 500
   - Pay 2: 550
   - Pay 3: 600
   - Account No: 12345678
   - Sort Code: 20-20-20
   - Account Holder: John Smith
3. Click "Save Record"

### Test 2: View Records
- Records should appear in the table below

### Test 3: Edit a Record
- Click the pencil (✏️) button
- Modify values
- Click "Save Record"

### Test 4: Filter Records
- Enter "ABC" in Client Name filter
- Click "Apply Filters"
- Should show only ABC Security records

### Test 5: Export
- Click "Export to PDF" or "Export to Excel"
- Files will download automatically

### Test 6: Upload Excel
1. Go to "Upload Excel" page
2. Create Excel file with columns:
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
3. Drag & drop or click to upload
4. Click Payroll buttons to generate PDFs

## ⚙️ Configuration

Edit `.env` file to change:
- `PORT=5000` - Change server port
- `MONGODB_URI=...` - Change database connection
- `NODE_ENV=development` - Change to `production`

## 🔧 Development Mode (Auto-reload)

To automatically restart when you make changes:

```powershell
npm run dev
```

Requires `nodemon` (installed with `npm install`)

## 🛑 Stop the Server

Press `Ctrl + C` in the PowerShell window

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app.js` | All backend logic |
| `models/Payroll.js` | Database schema |
| `public/js/main.js` | Frontend interactions |
| `public/css/style.css` | Styling & animations |
| `views/index.ejs` | Dashboard page |
| `views/upload.ejs` | Upload page |
| `utils/pdfGenerator.js` | PDF creation |
| `utils/excelParser.js` | Excel handling |

## 🆘 Common Issues

### "Cannot find module"
```
npm install
```

### "MongoDB connection failed"
- Check if MongoDB is running
- Update MONGODB_URI in .env
- Verify credentials (if using Atlas)

### "Port 5000 already in use"
- Change PORT in .env
- Or kill the process using port 5000

### "File upload not working"
- Check public/uploads folder exists
- Verify file is .xlsx format
- Check file size < 10MB

## 📞 Need Help?

Check console for error messages:
- Browser Console: F12
- Terminal: See error messages in PowerShell

---

**That's it! Your Payroll System is ready to use! 🎉**

For detailed documentation, see README.md
