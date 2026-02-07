// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  loadPayrollData();
  initializeFilters();
});

// ==================== EVENT LISTENERS ====================

function initializeEventListeners() {
  // Form submission
  const form = document.getElementById('payrollForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Filter buttons
  const filterBtn = document.getElementById('applyFilters');
  if (filterBtn) {
    filterBtn.addEventListener('click', applyFilters);
  }

  const resetBtn = document.getElementById('resetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // Export buttons
  const exportPdfBtn = document.getElementById('exportPDF');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
  }

  const exportExcelBtn = document.getElementById('exportExcel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }

  // Upload zone
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Modal close
  document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.remove('active');
    });
  });

  // Close modal when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Alert close buttons
  document.querySelectorAll('.alert-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.alert').remove();
    });
  });
}

// ==================== PAYROLL TABLE MANAGEMENT ====================

async function loadPayrollData() {
  try {
    const response = await fetch('/api/payroll');
    const data = await response.json();

    if (data.success) {
      displayPayrollTable(data.data);
    } else {
      showAlert(data.message || 'Failed to load data', 'danger');
    }
  } catch (error) {
    console.error('Error loading payroll data:', error);
    showAlert('Error loading data', 'danger');
  }
}

function displayPayrollTable(payrollData) {
  const tableBody = document.getElementById('payrollTableBody');
  if (!tableBody) return;

  if (payrollData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="15" class="text-center empty-state">
          <h3>No payroll records found</h3>
          <p>Add a new record using the form above to get started.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = payrollData.map(item => {
    const totalHoursDecimal = (item.totalHours || 0) + ((item.totalMinutes || 0) / 60);
    const totalPay = totalHoursDecimal * (item.payRate || 0);
    const bankAccountCount = (item.bankAccounts && item.bankAccounts.length) ? item.bankAccounts.length : 0;
    
    return `
    <tr data-id="${item._id}">
      <td><strong>${item.guardName || '-'}</strong></td>
      <td>${item.nationality || '-'}</td>
      <td>${item.insuranceNumber || '-'}</td>
      <td>${item.visaStatus || '-'}</td>
      <td>${item.totalHours || 0}:${String(item.totalMinutes || 0).padStart(2, '0')}</td>
      <td>£${(item.payRate || 0).toFixed(2)}</td>
      <td><span class="badge">${bankAccountCount}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="exportPayrollPDF('${item._id}', '${item.guardName}')" title="Generate Enhanced PDF">
          📄 PDF
        </button>
      </td>
      <td>
        <div class="btn-group-vertical">
          <button class="btn btn-edit btn-xs" onclick="editPayroll('${item._id}')" title="Edit Record">
            ✏️ Edit
          </button>
          <button class="btn btn-danger btn-xs" onclick="deletePayroll('${item._id}')" title="Delete Record">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

// ==================== FORM HANDLING ====================

async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    clientName: formData.get('clientName'),
    guardName: formData.get('guardName'),
    totalHours: parseFloat(formData.get('totalHours')),
    payRate: parseFloat(formData.get('payRate')),
    chargeRate: parseFloat(formData.get('chargeRate')),
    pay1: parseFloat(formData.get('pay1')),
    pay2: parseFloat(formData.get('pay2')),
    pay3: parseFloat(formData.get('pay3')),
    accountNo: formData.get('accountNo'),
    sortCode: formData.get('sortCode'),
    accountHolderName: formData.get('accountHolderName')
  };

  const id = formData.get('id');
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/payroll/${id}` : '/api/payroll';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showAlert(result.message, 'success');
      document.getElementById('payrollForm').reset();
      loadPayrollData();
      const modal = document.getElementById('formModal');
      if (modal) modal.classList.remove('active');
    } else {
      showAlert(result.message || 'Error saving record', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error saving record', 'danger');
  }
}

function openAddForm() {
  document.getElementById('payrollForm').reset();
  document.getElementById('formModalTitle').textContent = 'Add New Payroll Record';
  document.getElementById('formModal').classList.add('active');
}

async function generatePayrollPDF(id, payNumber, guardName) {
  try {
    // First fetch the payroll data
    const fetchResponse = await fetch(`/api/payroll/${id}`);
    if (!fetchResponse.ok) {
      showAlert('Failed to fetch payroll data', 'danger');
      return;
    }
    
    const payrollResponse = await fetchResponse.json();
    const payrollData = payrollResponse.data;
    
    // Then generate the PDF with the full payroll data
    const response = await fetch(`/api/payroll/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payrollData, payNumber })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payroll_${payNumber}_${guardName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showAlert(`Payroll ${payNumber} PDF generated successfully!`, 'success');
    } else {
      const error = await response.json();
      showAlert(error.message || 'Failed to generate PDF', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error generating PDF', 'danger');
  }
}

async function generatePayrollCombined(id, guardName) {
  try {
    // Fetch the payroll data once
    const response = await fetch(`/api/payroll/${id}`);
    if (!response.ok) {
      showAlert('Failed to fetch payroll data', 'danger');
      return;
    }
    
    const payrollResponse = await response.json();
    const payrollData = payrollResponse.data;
    
    // Generate all three payrolls with the full payroll data
    for (let payNumber of [1, 2, 3]) {
      const pdfResponse = await fetch(`/api/payroll/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollData, payNumber })
      });
      
      if (pdfResponse.ok) {
        const blob = await pdfResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Payroll_${payNumber}_${guardName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    }
    showAlert(`All payroll PDFs generated successfully!`, 'success');
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error generating combined payrolls', 'danger');
  }
}

async function editPayroll(id) {
  try {
    const response = await fetch(`/api/payroll/${id}`);
    const data = await response.json();

    if (data.success) {
      const item = data.data;
      
      // Helper function to safely set element value
      const setElementValue = (elemId, value) => {
        const elem = document.getElementById(elemId);
        if (elem) {
          if (elem.type === 'checkbox') {
            elem.checked = value || false;
          } else {
            elem.value = value || '';
          }
        }
      };
      
      // Basic info
      setElementValue('id', item._id);
      setElementValue('clientName', item.clientName);
      setElementValue('guardName', item.guardName);
      setElementValue('siteName', item.siteName);
      
      // Visa information
      setElementValue('nationality', item.nationality);
      setElementValue('insuranceNumber', item.insuranceNumber);
      setElementValue('visaStatus', item.visaStatus);
      setElementValue('britishPassport', item.britishPassport);
      setElementValue('shareCode', item.shareCode);
      setElementValue('shareCodeExpiryDate', item.shareCodeExpiryDate);
      
      // Hours
      setElementValue('totalHours', item.totalHours || 0);
      setElementValue('totalMinutes', item.totalMinutes || 0);
      
      // Rates
      setElementValue('payRate', item.payRate || 0);
      setElementValue('chargeRate', item.chargeRate || 0);
      
      // Legacy fields
      setElementValue('pay1', item.pay1 || 0);
      setElementValue('pay2', item.pay2 || 0);
      setElementValue('pay3', item.pay3 || 0);
      setElementValue('accountNo', item.accountNo);
      setElementValue('sortCode', item.sortCode);
      setElementValue('accountHolderName', item.accountHolderName);
      
      // Bank accounts (clear and repopulate)
      const bankContainer = document.getElementById('bankAccountsContainer');
      if (bankContainer && item.bankAccounts && item.bankAccounts.length > 0) {
        bankContainer.innerHTML = '';
        item.bankAccounts.forEach((account, index) => {
          const accountCard = document.createElement('div');
          accountCard.className = 'bank-account-card';
          accountCard.innerHTML = `
            <div class="form-row">
              <input type="text" placeholder="Account Holder Name" value="${account.accountHolderName || ''}" class="account-holder-name-${index}">
              <input type="text" placeholder="Bank Name" value="${account.bankName || ''}" class="bank-name-${index}">
            </div>
            <div class="form-row">
              <input type="text" placeholder="Sort Code (XX-XX-XX)" value="${account.sortCode || ''}" class="sort-code-${index}">
              <input type="text" placeholder="Account Number" value="${account.accountNumber || ''}" class="account-number-${index}">
            </div>
            <div class="form-row">
              <label>
                <input type="checkbox" class="is-primary-${index}" ${account.isPrimary ? 'checked' : ''}>
                Is Primary Account
              </label>
              <label>
                <input type="checkbox" class="is-active-${index}" ${account.active ? 'checked' : ''}>
                Active
              </label>
              ${index > 0 ? `<button type="button" class="btn btn-sm btn-danger" onclick="removeBankAccount(${index})">Remove</button>` : ''}
            </div>
          `;
          bankContainer.appendChild(accountCard);
        });
      }

      // Open modal
      const titleElem = document.getElementById('formModalTitle');
      const modalElem = document.getElementById('formModal');
      if (titleElem) titleElem.textContent = 'Edit Payroll Record';
      if (modalElem) {
        modalElem.classList.add('active');
        // Scroll to top of modal
        setTimeout(() => {
          modalElem.scrollTop = 0;
        }, 100);
      }
      
      // Toggle share code fields if needed
      if (typeof toggleShareCodeFields === 'function') {
        toggleShareCodeFields();
      }
    } else {
      showAlert('Record not found', 'warning');
    }
  } catch (error) {
    console.error('Error loading record:', error);
    showAlert('Error loading record: ' + error.message, 'danger');
  }
}

async function exportPayrollPDF(id, guardName) {
  try {
    const response = await fetch(`/api/export/payroll-pdf/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      downloadFile(blob, `payroll_${guardName}_${new Date().getTime()}.pdf`);
      showAlert(`PDF exported for ${guardName}`, 'success');
    } else {
      showAlert('Error exporting PDF', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error exporting PDF', 'danger');
  }
}

async function deletePayroll(id) {
  if (!confirm('Are you sure you want to delete this record?')) return;

  try {
    const response = await fetch(`/api/payroll/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showAlert('Record deleted successfully', 'success');
      loadPayrollData();
    } else {
      showAlert(data.message || 'Error deleting record', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error deleting record', 'danger');
  }
}

// ==================== FILTERING ====================

function initializeFilters() {
  const filterInputs = document.querySelectorAll('.filter-input input, .filter-input select');
  filterInputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  });
}

async function applyFilters() {
  // New filters
  const guardName = document.getElementById('filterGuard')?.value || '';
  const insuranceNumber = document.getElementById('filterInsurance')?.value || '';
  const visaStatus = document.getElementById('filterVisa')?.value || '';
  const nationality = document.getElementById('filterNationality')?.value || '';
  
  // Legacy filter (still supported)
  const clientName = document.getElementById('filterClient')?.value || '';

  const params = new URLSearchParams();
  if (guardName) params.append('guardName', guardName);
  if (insuranceNumber) params.append('insuranceNumber', insuranceNumber);
  if (visaStatus) params.append('visaStatus', visaStatus);
  if (nationality) params.append('nationality', nationality);
  if (clientName) params.append('clientName', clientName);

  try {
    const response = await fetch(`/api/payroll/filter?${params}`);
    const data = await response.json();

    if (data.success) {
      displayPayrollTable(data.data);
      showAlert(`Found ${data.data.length} record(s)`, 'info');
    } else {
      showAlert('Error applying filters', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error applying filters', 'danger');
  }
}

function resetFilters() {
  // New filters
  document.getElementById('filterGuard').value = '';
  document.getElementById('filterInsurance').value = '';
  document.getElementById('filterVisa').value = '';
  document.getElementById('filterNationality').value = '';
  
  // Legacy filter
  if (document.getElementById('filterClient')) {
    document.getElementById('filterClient').value = '';
  }
  
  loadPayrollData();
  showAlert('Filters reset', 'info');
}

// ==================== EXPORT FUNCTIONALITY ====================

async function exportToPDF() {
  try {
    const response = await fetch('/api/export/enhanced-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      downloadFile(blob, `payroll_enhanced_${new Date().getTime()}.pdf`);
      showAlert('Enhanced PDF exported successfully', 'success');
    } else {
      showAlert('Error exporting PDF', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error exporting PDF', 'danger');
  }
}

async function exportToExcel() {
  try {
    const response = await fetch('/api/export/enhanced-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      downloadFile(blob, `payroll_enhanced_${new Date().getTime()}.xlsx`);
      showAlert('Enhanced Excel file (4 sheets) exported successfully', 'success');
    } else {
      showAlert('Error exporting Excel', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error exporting Excel', 'danger');
  }
}

function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ==================== EXCEL UPLOAD ====================

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  e.currentTarget.classList.add('active');
}

function unhighlight(e) {
  e.currentTarget.classList.remove('active');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFileSelect(e) {
  const files = e.target.files;
  handleFiles(files);
}

async function handleFiles(files) {
  const file = files[0];

  if (!file) return;

  if (!file.name.match(/\.(xlsx|xls)$/)) {
    showAlert('Please upload an Excel file (.xlsx or .xls)', 'danger');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload/excel', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      displayUploadedData(data.data);
      showAlert(`Successfully imported ${data.data.length} records`, 'success');
    } else {
      showAlert(data.message || 'Error processing file', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error uploading file', 'danger');
  }
}

function displayUploadedData(records) {
  const container = document.getElementById('uploadedDataContainer');
  if (!container) return;

  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Client Name</th>
          <th>Guard Name</th>
          <th>Total Hours</th>
          <th>Pay Rate</th>
          <th>Pay 1</th>
          <th>Pay 2</th>
          <th>Pay 3</th>
          <th>Account No</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((record, idx) => `
          <tr>
            <td>${record.clientName}</td>
            <td>${record.guardName}</td>
            <td>${record.totalHours}</td>
            <td>£${record.payRate.toFixed(2)}</td>
            <td>£${record.pay1.toFixed(2)}</td>
            <td>£${record.pay2.toFixed(2)}</td>
            <td>£${record.pay3.toFixed(2)}</td>
            <td>${record.accountNo}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-payroll btn-success" onclick="generatePayroll(${idx}, 1)">Payroll 01</button>
                <button class="btn btn-payroll btn-info" onclick="generatePayroll(${idx}, 2)">Payroll 02</button>
                <button class="btn btn-payroll btn-warning" onclick="generatePayroll(${idx}, 3)">Payroll 03</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;
  container.classList.remove('hidden');
}

// Store uploaded data in window scope
window.uploadedRecords = [];

async function generatePayroll(recordIndex, payNumber) {
  // This will be handled by the upload page with stored data
  showAlert(`Generating Payroll ${String(payNumber).padStart(2, '0')}...`, 'info');
}

// ==================== UTILITIES ====================

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;

  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type}`;
  alertElement.innerHTML = `
    <span>${message}</span>
    <button class="alert-close">×</button>
  `;

  alertContainer.appendChild(alertElement);

  alertElement.querySelector('.alert-close').addEventListener('click', () => {
    alertElement.remove();
  });

  setTimeout(() => {
    alertElement.remove();
  }, 5000);
}

// Format currency
function formatCurrency(value) {
  return `£${parseFloat(value).toFixed(2)}`;
}

// Format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB');
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
