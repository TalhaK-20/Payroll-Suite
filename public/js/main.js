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
  const cardGrid = document.getElementById('payrollCardGrid');
  
  if (!tableBody || !cardGrid) return;

  if (payrollData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center empty-state">
          <h3>No payroll records found</h3>
          <p>Add a new record using the form above to get started.</p>
        </td>
      </tr>
    `;
    cardGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <h3>No payroll records found</h3>
        <p>Add a new record using the form above to get started.</p>
      </div>
    `;
    return;
  }

  // Helper function to determine status
  const getStatusBadge = (totalHours, totalMinutes) => {
    const totalHoursDecimal = totalHours + (totalMinutes / 60);
    const isCompleted = totalHoursDecimal >= 8;
    const statusColor = isCompleted ? '#27ae60' : '#dc3545';
    const statusText = isCompleted ? 'Duty Completed ✓' : 'Incomplete ✗';
    const displayHours = totalHoursDecimal.toFixed(2);
    
    return {
      color: statusColor,
      text: statusText,
      completed: isCompleted,
      hours: displayHours
    };
  };

  // Render Table View
  tableBody.innerHTML = payrollData.map(item => {
    const totalHoursDecimal = (item.totalHours || 0) + ((item.totalMinutes || 0) / 60);
    const totalPay = totalHoursDecimal * (item.payRate || 0);
    const status = getStatusBadge(item.totalHours || 0, item.totalMinutes || 0);
    
    return `
    <tr data-id="${item._id}">
      <td><strong>${item.guardName || '-'}</strong></td>
      <td><strong>${item.clientName || '-'}</strong></td>
      <td>
        <span class="status-badge" style="background-color: ${status.color}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block;">
          ${status.text}
        </span>
        <div style="font-size: 12px; margin-top: 4px; color: #666;">${status.hours}h worked</div>
      </td>
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

  // Load today's daily hours and update table
  const today = new Date().toISOString().split('T')[0];
  payrollData.forEach(item => {
    fetch(`/api/daily-hours/${item._id}?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`)
      .then(res => res.json())
      .then(data => {
        const todayRecord = data.data ? data.data.find(record => record.dateString === today) : null;
        const row = tableBody.querySelector(`tr[data-id="${item._id}"]`);
        
        if (row && todayRecord) {
          const statusColor = todayRecord.dutyCompleted ? '#27ae60' : '#dc3545';
          const statusText = todayRecord.dutyCompleted ? 'DUTY COMPLETED ✓' : 'INCOMPLETE ✗';
          const statusHtml = `
            <span class="status-badge" style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block;">
              ${statusText}
            </span>
            <div style="font-size: 12px; margin-top: 4px; color: #666;">${todayRecord.hoursWorked}h ${todayRecord.minutesWorked}m (${todayRecord.signInTime} - ${todayRecord.signOffTime})</div>
          `;
          const statusCell = row.querySelector('td:nth-child(3)');
          if (statusCell) statusCell.innerHTML = statusHtml;
        }
      })
      .catch(err => console.error('Error loading today\'s hours:', err));
  });

  // Render Card View
  cardGrid.innerHTML = payrollData.map(item => {
    const status = getStatusBadge(item.totalHours || 0, item.totalMinutes || 0);
    const bankAccountCount = (item.bankAccounts && item.bankAccounts.length) ? item.bankAccounts.length : 0;
    
    return `
    <div class="payroll-card" data-id="${item._id}">
      <div class="card-header" style="background-color: ${status.color}; border-bottom: 4px solid ${status.color};">
        <div class="card-status-badge">${status.text}</div>
      </div>
      <div class="card-body">
        <div class="card-field">
          <label>Guard Name</label>
          <div class="card-value">${item.guardName || '-'}</div>
        </div>
        <div class="card-field">
          <label>Client Name</label>
          <div class="card-value">${item.clientName || '-'}</div>
        </div>
        <div class="card-divider"></div>
        <div class="card-field">
          <label>Hours Worked</label>
          <div class="card-value card-hours">${status.hours}h (${item.totalHours || 0}h ${item.totalMinutes || 0}m)</div>
        </div>
        <div class="card-field">
          <label>Pay Rate</label>
          <div class="card-value">£${(item.payRate || 0).toFixed(2)}/hr</div>
        </div>
        <div class="card-field">
          <label>Nationality</label>
          <div class="card-value">${item.nationality || '-'}</div>
        </div>
        <div class="card-field">
          <label>Insurance #</label>
          <div class="card-value">${item.insuranceNumber || '-'}</div>
        </div>
        <div class="card-field">
          <label>Visa Status</label>
          <div class="card-value">${item.visaStatus || '-'}</div>
        </div>
        <div class="card-field">
          <label>Bank Accounts</label>
          <div class="card-value"><span class="badge">${bankAccountCount}</span></div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-sm btn-primary" onclick="exportPayrollPDF('${item._id}', '${item.guardName}')" title="Generate Enhanced PDF">
          📄 PDF
        </button>
        <button class="btn btn-sm btn-edit" onclick="editPayroll('${item._id}')" title="Edit Record">
          ✏️ Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="deletePayroll('${item._id}')" title="Delete Record">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;
  }).join('');
  
  // Update card status for today
  payrollData.forEach(item => {
    fetch(`/api/daily-hours/${item._id}?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`)
      .then(res => res.json())
      .then(data => {
        const todayRecord = data.data ? data.data.find(record => record.dateString === today) : null;
        const card = cardGrid.querySelector(`div[data-id="${item._id}"]`);
        
        if (card && todayRecord) {
          const statusColor = todayRecord.dutyCompleted ? '#27ae60' : '#dc3545';
          const statusText = todayRecord.dutyCompleted ? 'DUTY COMPLETED ✓' : 'INCOMPLETE ✗';
          
          // Update card header color
          const cardHeader = card.querySelector('.card-header');
          cardHeader.style.backgroundColor = statusColor;
          cardHeader.style.borderBottomColor = statusColor;
          cardHeader.querySelector('.card-status-badge').textContent = statusText;
        }
      })
      .catch(err => console.error('Error loading today\'s hours:', err));
  });
}

// ==================== VIEW SWITCHING ====================

function switchView(viewType) {
  const tableView = document.getElementById('tableViewContainer');
  const cardView = document.getElementById('cardViewContainer');
  const calendarView = document.getElementById('calendarViewContainer');
  const tableBtn = document.getElementById('toggleTableView');
  const cardBtn = document.getElementById('toggleCardView');
  const calendarBtn = document.getElementById('toggleCalendarView');
  
  // Hide all views
  if (tableView) tableView.classList.remove('active');
  if (cardView) cardView.classList.remove('active');
  if (calendarView) calendarView.classList.remove('active');
  if (tableBtn) tableBtn.classList.remove('active');
  if (cardBtn) cardBtn.classList.remove('active');
  if (calendarBtn) calendarBtn.classList.remove('active');
  
  // Show selected view
  if (viewType === 'table') {
    if (tableView) tableView.classList.add('active');
    if (tableBtn) tableBtn.classList.add('active');
  } else if (viewType === 'card') {
    if (cardView) cardView.classList.add('active');
    if (cardBtn) cardBtn.classList.add('active');
  } else if (viewType === 'calendar') {
    if (calendarView) calendarView.classList.add('active');
    if (calendarBtn) calendarBtn.classList.add('active');
    loadGuardSelector();
  }
}

// ==================== CALENDAR FUNCTIONS ====================

let currentMonthOffset = 0;
let allPayrollData = [];

function loadGuardSelector() {
  fetch('/api/payroll')
    .then(res => res.json())
    .then(data => {
      allPayrollData = data.data || [];
      const selector = document.getElementById('guardSelector');
      selector.innerHTML = '<option value="">-- Select a Guard --</option>';
      allPayrollData.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        option.textContent = item.guardName;
        selector.appendChild(option);
      });
    });
}

function loadGuardCalendar() {
  const guardId = document.getElementById('guardSelector').value;
  if (!guardId) {
    document.getElementById('dailyHoursCalendar').innerHTML = '<p style="text-align: center; padding: 2rem;">Please select a guard</p>';
    return;
  }
  
  renderCalendar(guardId);
}

function renderCalendar(guardId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + currentMonthOffset;
  
  // Handle month overflow
  let displayYear = year;
  let displayMonth = month;
  if (displayMonth < 0) {
    displayYear--;
    displayMonth = 11;
  } else if (displayMonth > 11) {
    displayYear++;
    displayMonth = 0;
  }
  
  const monthName = new Date(displayYear, displayMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  document.getElementById('currentMonth').textContent = monthName;
  
  const firstDay = new Date(displayYear, displayMonth, 1);
  const lastDay = new Date(displayYear, displayMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Fetch daily hours for this month
  fetch(`/api/daily-hours/${guardId}?month=${displayMonth + 1}&year=${displayYear}`)
    .then(res => res.json())
    .then(data => {
      const dailyHoursMap = {};
      if (data.success && data.data) {
        data.data.forEach(record => {
          dailyHoursMap[record.dateString] = record;
        });
      }
      
      let html = '<div class="calendar-grid">';
      
      // Days of week header
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      daysOfWeek.forEach(day => {
        html += `<div class="calendar-header-day">${day}</div>`;
      });
      
      // Empty cells before first day
      for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-empty"></div>';
      }
      
      // Days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isPast = new Date(dateStr) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const isToday = dateStr === now.toISOString().split('T')[0];
        
        let cellClass = 'calendar-day';
        let content = `<div class="day-number">${day}</div>`;
        
        const dailyRecord = dailyHoursMap[dateStr];
        if (dailyRecord) {
          const statusColor = dailyRecord.dutyCompleted ? '#27ae60' : '#dc3545';
          content += `<div class="day-hours">
            <div class="hours-entry" style="background-color: ${statusColor};">
              ${dailyRecord.totalHoursDecimal.toFixed(1)}h
              <div class="hours-entry-time">${dailyRecord.signInTime} - ${dailyRecord.signOffTime}</div>
            </div>
          </div>`;
          cellClass += dailyRecord.dutyCompleted ? ' completed' : ' incomplete';
        } else {
          content += `<div class="day-hours"><div class="no-entry">No entry</div></div>`;
        }
        
        content += `<button class="btn btn-xs btn-primary" onclick="openDailyHoursModal('${guardId}', '${dateStr}')" style="width: 100%; margin-top: 4px;">+ Add</button>`;
        
        if (isToday) cellClass += ' today';
        if (isPast && !isToday) cellClass += ' past';
        
        html += `<div class="${cellClass}">${content}</div>`;
      }
      
      html += '</div>';
      document.getElementById('dailyHoursCalendar').innerHTML = html;
    })
    .catch(err => {
      console.error('Error loading daily hours:', err);
      document.getElementById('dailyHoursCalendar').innerHTML = '<p style="color: #dc3545;">Error loading calendar data</p>';
    });
}

function previousMonth() {
  currentMonthOffset--;
  const guardId = document.getElementById('guardSelector').value;
  if (guardId) renderCalendar(guardId);
}

function nextMonth() {
  currentMonthOffset++;
  const guardId = document.getElementById('guardSelector').value;
  if (guardId) renderCalendar(guardId);
}

function openDailyHoursModal(guardId, dateStr) {
  const guard = allPayrollData.find(g => g._id === guardId);
  if (!guard) return;
  
  document.getElementById('dailyGuardId').value = guardId;
  document.getElementById('dailyDate').value = dateStr;
  document.getElementById('dailyGuardName').value = guard.guardName;
  document.getElementById('dailyLogDate').value = dateStr;
  document.getElementById('signInTime').value = '';
  document.getElementById('signOffTime').value = '';
  document.getElementById('hoursWorked').value = '';
  document.getElementById('dutyCompleted').checked = false;
  
  document.getElementById('dailyHoursModal').classList.add('active');
}

function closeDailyHoursModal() {
  document.getElementById('dailyHoursModal').classList.remove('active');
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'signInTime' || e.target.id === 'signOffTime') {
    const signIn = document.getElementById('signInTime').value;
    const signOff = document.getElementById('signOffTime').value;
    
    if (signIn && signOff) {
      const [inHour, inMin] = signIn.split(':').map(Number);
      const [outHour, outMin] = signOff.split(':').map(Number);
      
      let inMinutes = inHour * 60 + inMin;
      let outMinutes = outHour * 60 + outMin;
      
      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60; // Handle overnight shifts
      }
      
      const totalMinutes = outMinutes - inMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      document.getElementById('hoursWorked').value = `${hours}h ${minutes}m`;
      document.getElementById('dutyCompleted').checked = hours >= 8;
    }
  }
});

function saveDailyHours() {
  const guardId = document.getElementById('dailyGuardId').value;
  const dateStr = document.getElementById('dailyDate').value;
  const signInTime = document.getElementById('signInTime').value;
  const signOffTime = document.getElementById('signOffTime').value;
  const dutyCompleted = document.getElementById('dutyCompleted').checked;
  
  if (!signInTime || !signOffTime) {
    alert('Please enter both sign-in and sign-off times');
    return;
  }
  
  // Save to backend
  fetch('/api/daily-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payrollId: guardId,
      date: dateStr,
      signInTime: signInTime,
      signOffTime: signOffTime,
      dutyCompleted: dutyCompleted
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showAlert('Daily hours saved successfully', 'success');
      closeDailyHoursModal();
      loadGuardCalendar();
    } else {
      showAlert('Error saving daily hours: ' + data.message, 'danger');
    }
  })
  .catch(err => {
    console.error('Error:', err);
    showAlert('Error saving daily hours', 'danger');
  });
}

// ==================== FORM HANDLING ====================

async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  
  // Get raw values
  const totalHours = parseFloat(formData.get('totalHours') || 0);
  const associatedGuardHours = parseFloat(formData.get('associatedGuardHours') || 0);
  const primaryGuardHours = Math.max(0, totalHours - associatedGuardHours);

  const data = {
    clientId: formData.get('clientId') || null,
    clientName: formData.get('clientName'),
    guardName: formData.get('guardName'),
    guardId: formData.get('guardId') || null,
    nationality: formData.get('nationality'),
    siteName: formData.get('siteName') || '',
    insuranceNumber: formData.get('insuranceNumber') || '',
    visaStatus: formData.get('visaStatus') || '',
    britishPassport: formData.get('britishPassport') === 'on',
    shareCode: formData.get('shareCode') || null,
    shareCodeExpiryDate: formData.get('shareCodeExpiryDate') || null,
    totalHours: totalHours,
    totalMinutes: parseInt(formData.get('totalMinutes') || 0),
    payRate: parseFloat(formData.get('payRate') || 0),
    chargeRate: parseFloat(formData.get('chargeRate') || 0),
    pay1: parseFloat(formData.get('pay1') || 0),
    pay2: parseFloat(formData.get('pay2') || 0),
    pay3: parseFloat(formData.get('pay3') || 0),
    accountNo: formData.get('accountNo') || '',
    sortCode: formData.get('sortCode') || '',
    accountHolderName: formData.get('accountHolderName') || '',
    bankAccountId: formData.get('bankAccountId') || null,
    
    // Proper nesting for hoursDistribution
    hoursDistribution: {
      primaryGuardHours: primaryGuardHours,
      associatedGuardHours: associatedGuardHours,
      associatedGuardId: formData.get('associatedGuardId') || null,
      associatedGuardName: formData.get('associatedGuardName') || ''
    },
    
    // Status field
    status: formData.get('status') || 'pending',
    
    // Legacy fields for backward compatibility
    associatedGuardPayRate: parseFloat(formData.get('associatedGuardPayRate') || 0),
    associatedGuardPay: parseFloat(formData.get('associatedGuardPay') || 0)
  };

  const id = formData.get('id');
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/payroll/${id}` : '/api/payroll';

  console.log('Form Submit Data:', data);

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
      document.getElementById('formModalTitle').textContent = 'Add New Payroll Record';
      loadPayrollData();
      if (typeof loadPayrollRecords === 'function') loadPayrollRecords();
      if (typeof loadMetrics === 'function') loadMetrics();
      const modal = document.getElementById('formModal');
      if (modal) modal.classList.remove('active');
    } else {
      showAlert(result.message || 'Error saving record', 'danger');
      console.error('Form submission error:', result);
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error saving record: ' + error.message, 'danger');
  }
}

function openAddForm() {
  document.getElementById('payrollForm').reset();
  document.getElementById('formModalTitle').textContent = 'Add New Payroll Record';
  document.getElementById('formModal').classList.add('active');
  
  // Load guards, bank accounts, and clients dropdowns when opening form
  loadClientsForForm();
  loadGuardsForForm();
  loadBankAccountsForForm();
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
    
    console.log('Payroll Data for PDF:', payrollData);
    
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
// ==================== DROPDOWN LOADING FUNCTIONS ====================

async function loadGuardsForForm() {
  try {
    const response = await fetch('/api/guards');
    const result = await response.json();

    if (result.success) {
      const dropdown = document.getElementById('guardId');
      if (dropdown) {
        dropdown.innerHTML = '<option value="">Select Guard</option>' +
          result.data.map(guard => `
            <option value="${guard._id}" data-guard-name="${guard.guardName}" data-nationality="${guard.nationality}">${guard.guardName}</option>
          `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading guards:', error);
  }
}

async function loadBankAccountsForForm() {
  try {
    const response = await fetch('/api/bank-accounts');
    const result = await response.json();

    if (result.success) {
      const dropdown = document.getElementById('bankAccountId');
      if (dropdown) {
        dropdown.innerHTML = '<option value="">Select Bank Account</option>' +
          result.data.map(account => `
            <option value="${account._id}" data-account-number="${account.accountNumber}" data-sort-code="${account.sortCode}" data-holder="${account.accountHolderName}">
              ${account.accountHolderName} - ${account.bankName}
            </option>
          `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading bank accounts:', error);
  }
}

async function loadClientsForForm() {
  try {
    const response = await fetch('/api/clients');
    const result = await response.json();

    if (result.success) {
      const dropdown = document.getElementById('clientId');
      if (dropdown) {
        dropdown.innerHTML = '<option value="">Select Client</option>' +
          result.data.map(client => `
            <option value="${client._id}" data-client-name="${client.name}">${client.name}</option>
          `).join('');
      }
    }
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

function updateGuardDetailsForm() {
  const guardId = document.getElementById('guardId').value;
  const selected = document.querySelector(`#guardId option[value="${guardId}"]`);
  if (selected) {
    document.getElementById('guardName').value = selected.dataset.guardName;
  } else {
    document.getElementById('guardName').value = '';
  }
}

function updateBankAccountFieldsForm() {
  const bankId = document.getElementById('bankAccountId').value;
  const selected = document.querySelector(`#bankAccountId option[value="${bankId}"]`);
  if (selected) {
    document.getElementById('accountNo').value = selected.dataset.accountNumber;
    document.getElementById('sortCode').value = selected.dataset.sortCode;
    document.getElementById('accountHolderName').value = selected.dataset.holder;
  } else {
    document.getElementById('accountNo').value = '';
    document.getElementById('sortCode').value = '';
    document.getElementById('accountHolderName').value = '';
  }
}