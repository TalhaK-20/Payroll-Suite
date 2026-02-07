// Form Handler JavaScript - Enhanced Payroll System
// Handles dynamic bank account management, share code visibility, and payment calculations

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Close the add/edit form modal
 */
function closeFormModal() {
  const modal = document.getElementById('formModal');
  if (modal) {
    modal.classList.remove('active');
    // Reset form
    document.getElementById('payrollForm').reset();
    // Clear bank accounts container
    document.getElementById('bankAccountsContainer').innerHTML = '';
    // Add default empty bank account
    setTimeout(() => addBankAccount(), 100);
  }
}

/**
 * Toggle share code fields visibility based on British Passport checkbox
 */
function toggleShareCodeFields() {
  const britishPassport = document.getElementById('britishPassport').checked;
  const shareCodeContainer = document.getElementById('shareCodeContainer');
  const shareCodeInput = document.getElementById('shareCode');
  const shareCodeExpiryInput = document.getElementById('shareCodeExpiryDate');
  
  if (britishPassport) {
    // Hide share code fields
    shareCodeContainer.style.display = 'none';
    shareCodeInput.removeAttribute('required');
    shareCodeExpiryInput.removeAttribute('required');
    // Clear values
    shareCodeInput.value = '';
    shareCodeExpiryInput.value = '';
  } else {
    // Show share code fields
    shareCodeContainer.style.display = 'block';
    shareCodeInput.setAttribute('required', 'required');
    shareCodeExpiryInput.setAttribute('required', 'required');
  }
}

/**
 * Calculate total pay based on hours, minutes, and pay rate
 */
function calculateTotalPay() {
  const totalHours = parseFloat(document.getElementById('totalHours').value) || 0;
  const totalMinutes = parseFloat(document.getElementById('totalMinutes').value) || 0;
  const payRate = parseFloat(document.getElementById('payRate').value) || 0;
  
  // Calculate hours in decimal format (e.g., 40.5 hours)
  const totalHoursDecimal = totalHours + (totalMinutes / 60);
  const totalPay = totalHoursDecimal * payRate;
  
  // Display calculated total
  const totalPayDisplay = document.getElementById('totalPayDisplay');
  if (totalPayDisplay) {
    totalPayDisplay.textContent = '£' + totalPay.toFixed(2);
  }
}

// ============================================================================
// BANK ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Add a new bank account field group
 */
function addBankAccount() {
  const container = document.getElementById('bankAccountsContainer');
  const accountIndex = container.children.length;
  
  const bankAccountHTML = `
    <div class="bank-account-card" id="bankAccount-${accountIndex}" style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 15px; background: #f9f9f9;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h4 style="margin: 0;">Bank Account ${accountIndex + 1}</h4>
        ${accountIndex > 0 ? `
          <button type="button" class="btn btn-danger btn-sm" onclick="removeBankAccount(${accountIndex})">
            🗑️ Remove
          </button>
        ` : ''}
      </div>
      
      <div class="form-row-2col">
        <div class="form-group">
          <label>Account Holder Name <span class="required">*</span></label>
          <input type="text" 
            id="accountHolderName-${accountIndex}" 
            name="bankAccounts[${accountIndex}][accountHolderName]" 
            placeholder="e.g., John Smith" 
            required>
          <small class="field-hint">Name on bank account</small>
        </div>
        <div class="form-group">
          <label>Bank Name <span class="required">*</span></label>
          <input type="text" 
            id="bankName-${accountIndex}" 
            name="bankAccounts[${accountIndex}][bankName]" 
            placeholder="e.g., Barclays, HSBC, Lloyds" 
            required>
          <small class="field-hint">Bank name</small>
        </div>
      </div>
      
      <div class="form-row-2col">
        <div class="form-group">
          <label>Sort Code <span class="required">*</span></label>
          <input type="text" 
            id="sortCode-${accountIndex}" 
            name="bankAccounts[${accountIndex}][sortCode]" 
            placeholder="e.g., 20-00-00" 
            pattern="\d{2}-\d{2}-\d{2}"
            required>
          <small class="field-hint">Format: XX-XX-XX</small>
        </div>
        <div class="form-group">
          <label>Account Number <span class="required">*</span></label>
          <input type="text" 
            id="accountNumber-${accountIndex}" 
            name="bankAccounts[${accountIndex}][accountNumber]" 
            placeholder="e.g., 12345678" 
            pattern="\d{8}"
            maxlength="8"
            required>
          <small class="field-hint">8-digit account number</small>
        </div>
      </div>
      
      <div class="form-row-2col">
        <div class="form-group">
          <label>
            <input type="checkbox" 
              id="isPrimary-${accountIndex}" 
              name="bankAccounts[${accountIndex}][isPrimary]" 
              ${accountIndex === 0 ? 'checked' : ''}>
            Primary Account
          </label>
          <small class="field-hint">Mark as main payment account</small>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" 
              id="active-${accountIndex}" 
              name="bankAccounts[${accountIndex}][active]" 
              checked>
            Active
          </label>
          <small class="field-hint">Enable this account for payments</small>
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', bankAccountHTML);
}

/**
 * Remove a bank account field group
 */
function removeBankAccount(index) {
  const accountCard = document.getElementById(`bankAccount-${index}`);
  if (accountCard) {
    // Check if it's the only account
    const container = document.getElementById('bankAccountsContainer');
    if (container.children.length > 1) {
      accountCard.remove();
    } else {
      alert('At least one bank account is required!');
    }
  }
}

// ============================================================================
// FORM SUBMISSION & VALIDATION
// ============================================================================

/**
 * Initialize form when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('payrollForm');
  
  // Initialize with one empty bank account
  addBankAccount();
  
  // Form submission handler
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      savePayrollRecord();
    });
  }
  
  // Modal close button
  const closeBtn = document.querySelector('.modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeFormModal);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('formModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeFormModal();
      }
    });
  }
});

/**
 * Save payroll record to database
 */
async function savePayrollRecord() {
  try {
    const formData = new FormData(document.getElementById('payrollForm'));
    const recordId = document.getElementById('id').value;
    
    // Prepare data
    const data = {
      guardName: formData.get('guardName'),
      nationality: formData.get('nationality'),
      insuranceNumber: formData.get('insuranceNumber'),
      siteName: formData.get('siteName'),
      clientName: formData.get('clientName'),
      visaStatus: formData.get('visaStatus'),
      britishPassport: document.getElementById('britishPassport').checked,
      shareCode: document.getElementById('britishPassport').checked ? null : formData.get('shareCode'),
      shareCodeExpiryDate: document.getElementById('britishPassport').checked ? null : formData.get('shareCodeExpiryDate'),
      totalHours: parseFloat(formData.get('totalHours')) || 0,
      totalMinutes: parseInt(formData.get('totalMinutes')) || 0,
      chargeRate: parseFloat(formData.get('chargeRate')) || 0,
      payRate: parseFloat(formData.get('payRate')) || 0,
      // Legacy fields for backward compatibility
      pay1: parseFloat(formData.get('pay1')) || 0,
      pay2: parseFloat(formData.get('pay2')) || 0,
      pay3: parseFloat(formData.get('pay3')) || 0,
      bankAccounts: [],
      payments: []
    };
    
    // Collect bank account data
    const bankAccountsContainer = document.getElementById('bankAccountsContainer');
    const bankAccountCards = bankAccountsContainer.querySelectorAll('.bank-account-card');
    
    bankAccountCards.forEach((card, index) => {
      const account = {
        accountHolderName: card.querySelector(`#accountHolderName-${index}`).value,
        bankName: card.querySelector(`#bankName-${index}`).value,
        sortCode: card.querySelector(`#sortCode-${index}`).value,
        accountNumber: card.querySelector(`#accountNumber-${index}`).value,
        isPrimary: card.querySelector(`#isPrimary-${index}`).checked,
        active: card.querySelector(`#active-${index}`).checked
      };
      data.bankAccounts.push(account);
    });
    
    // Validate at least one bank account
    if (data.bankAccounts.length === 0) {
      alert('At least one bank account is required!');
      return;
    }
    
    // Make API request
    const method = recordId ? 'PUT' : 'POST';
    const url = recordId ? `/update-record/${recordId}` : '/add-record';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save record');
    }
    
    const result = await response.json();
    
    if (result.success) {
      showAlert('✅ Record saved successfully!', 'success');
      closeFormModal();
      // Reload table
      loadPayrollRecords();
    } else {
      showAlert('❌ ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error saving record:', error);
    showAlert('❌ Error: ' + error.message, 'error');
  }
}

/**
 * Open edit form with existing record data
 */
async function editRecord(recordId) {
  try {
    // Fetch record data
    const response = await fetch(`/get-record/${recordId}`);
    if (!response.ok) throw new Error('Failed to fetch record');
    
    const data = await response.json();
    const record = data.data;
    
    // Populate form fields
    document.getElementById('id').value = record._id || '';
    document.getElementById('guardName').value = record.guardName || '';
    document.getElementById('nationality').value = record.nationality || '';
    document.getElementById('insuranceNumber').value = record.insuranceNumber || '';
    document.getElementById('siteName').value = record.siteName || '';
    document.getElementById('clientName').value = record.clientName || '';
    document.getElementById('visaStatus').value = record.visaStatus || '';
    document.getElementById('britishPassport').checked = record.britishPassport || false;
    document.getElementById('shareCode').value = record.shareCode || '';
    document.getElementById('shareCodeExpiryDate').value = record.shareCodeExpiryDate ? record.shareCodeExpiryDate.split('T')[0] : '';
    document.getElementById('totalHours').value = record.totalHours || 0;
    document.getElementById('totalMinutes').value = record.totalMinutes || 0;
    document.getElementById('chargeRate').value = record.chargeRate || 0;
    document.getElementById('payRate').value = record.payRate || 0;
    document.getElementById('pay1').value = record.pay1 || 0;
    document.getElementById('pay2').value = record.pay2 || 0;
    document.getElementById('pay3').value = record.pay3 || 0;
    
    // Clear and populate bank accounts
    const container = document.getElementById('bankAccountsContainer');
    container.innerHTML = '';
    
    if (record.bankAccounts && record.bankAccounts.length > 0) {
      record.bankAccounts.forEach((account, index) => {
        addBankAccount();
        document.getElementById(`accountHolderName-${index}`).value = account.accountHolderName || '';
        document.getElementById(`bankName-${index}`).value = account.bankName || '';
        document.getElementById(`sortCode-${index}`).value = account.sortCode || '';
        document.getElementById(`accountNumber-${index}`).value = account.accountNumber || '';
        document.getElementById(`isPrimary-${index}`).checked = account.isPrimary || false;
        document.getElementById(`active-${index}`).checked = account.active !== false;
      });
    } else {
      addBankAccount();
    }
    
    // Update modal title and show
    document.getElementById('formModalTitle').textContent = 'Edit Payroll Record';
    document.getElementById('formModal').classList.add('active');
    
    // Toggle share code fields
    toggleShareCodeFields();
    calculateTotalPay();
  } catch (error) {
    console.error('Error loading record:', error);
    showAlert('❌ Error: ' + error.message, 'error');
  }
}

/**
 * Open add new record form
 */
function openAddForm() {
  document.getElementById('id').value = '';
  document.getElementById('formModalTitle').textContent = 'Add New Payroll Record';
  
  // Clear form
  document.getElementById('payrollForm').reset();
  
  // Clear bank accounts and add one empty
  const container = document.getElementById('bankAccountsContainer');
  container.innerHTML = '';
  setTimeout(() => addBankAccount(), 100);
  
  // Show modal
  document.getElementById('formModal').classList.add('active');
  
  // Reset visa/share code fields
  toggleShareCodeFields();
}

// ============================================================================
// DISPLAY UTILITIES
// ============================================================================

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.cssText = `
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 5px;
    animation: slideIn 0.3s ease;
  `;
  
  const bgColor = type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1';
  const textColor = type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460';
  const borderColor = type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb';
  
  alertDiv.style.backgroundColor = bgColor;
  alertDiv.style.color = textColor;
  alertDiv.style.border = `1px solid ${borderColor}`;
  
  alertContainer.appendChild(alertDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    alertDiv.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => alertDiv.remove(), 300);
  }, 5000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
