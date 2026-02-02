let rosterState = {
  startDate: null,
  endDate: null,
  days: [],
  rows: [],
  guards: [],
  clients: []
};

let currentModalContext = null;
let rosterMode = 'day';
let currentEntryStatus = 'unconfirmed';
let currentRowEditId = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeRoster();
});

function initializeRoster() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => shiftWeek(-7));
  document.getElementById('nextWeekBtn').addEventListener('click', () => shiftWeek(7));
  document.getElementById('todayBtn').addEventListener('click', () => loadCurrentWeek());
  document.getElementById('dayModeBtn').addEventListener('click', () => setRosterMode('day'));
  document.getElementById('monthModeBtn').addEventListener('click', () => setRosterMode('monthly'));
  document.getElementById('reportBtn').addEventListener('click', openMonthlyReport);
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) addRowBtn.addEventListener('click', openRowModal);
  const monthPicker = document.getElementById('rosterMonthPicker');
  if (monthPicker) monthPicker.addEventListener('change', handleMonthChange);
  const rowModalClose = document.getElementById('closeRowModal');
  if (rowModalClose) rowModalClose.addEventListener('click', closeRowModal);
  const rowModalCancel = document.getElementById('cancelRowBtn');
  if (rowModalCancel) rowModalCancel.addEventListener('click', closeRowModal);
  const saveRowBtn = document.getElementById('saveRowBtn');
  if (saveRowBtn) saveRowBtn.addEventListener('click', saveRosterRow);
  document.getElementById('closeRosterModal').addEventListener('click', closeRosterModal);
  document.getElementById('cancelRosterBtn').addEventListener('click', closeRosterModal);
  document.getElementById('addAssocBtn').addEventListener('click', () => addAssociatedRow());
  document.getElementById('saveRosterBtn').addEventListener('click', saveRosterEntry);
  document.getElementById('deleteRosterBtn').addEventListener('click', deleteRosterEntry);
  document.getElementById('statusConfirmedBtn').addEventListener('click', () => setEntryStatus('confirmed'));
  document.getElementById('statusUnconfirmedBtn').addEventListener('click', () => setEntryStatus('unconfirmed'));
  document.getElementById('totalHoursInput').addEventListener('input', handleTotalHoursChange);
  document.getElementById('primaryHoursInput').addEventListener('input', handlePrimaryHoursChange);
  document.getElementById('monthlyTotalHoursInput').addEventListener('input', handleMonthlyTotalChange);
  document.getElementById('monthlyPrimaryHoursInput').addEventListener('input', handleMonthlyPrimaryChange);

  loadCurrentWeek();
}

function loadCurrentWeek() {
  if (rosterMode === 'monthly') {
    loadMonth(new Date());
    return;
  }
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  loadRoster(start, end);
}

function shiftWeek(days) {
  if (!rosterState.startDate) return;
  if (rosterMode === 'monthly') {
    const base = new Date(rosterState.startDate);
    const newMonth = base.getMonth() + (days > 0 ? 1 : -1);
    const newDate = new Date(base.getFullYear(), newMonth, 1);
    loadMonth(newDate);
    return;
  }
  const start = new Date(rosterState.startDate);
  start.setDate(start.getDate() + days);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  loadRoster(start, end);
}

function loadMonth(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  loadRoster(start, end);
}

function handleMonthChange(event) {
  const value = event.target.value;
  if (!value) return;
  const parts = value.split('-').map(Number);
  if (parts.length !== 2 || parts.some(n => Number.isNaN(n))) return;
  const [year, month] = parts;
  const date = new Date(year, month - 1, 1);
  loadMonth(date);
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRangeLabel(start, end) {
  const startLabel = start.toLocaleDateString('en-GB');
  const endLabel = end.toLocaleDateString('en-GB');
  return `Roster Period: ${startLabel} to ${endLabel}`;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric'
  });
}

function setRosterMode(mode) {
  rosterMode = mode === 'monthly' ? 'monthly' : 'day';
  document.getElementById('dayModeBtn').classList.toggle('active', rosterMode === 'day');
  document.getElementById('monthModeBtn').classList.toggle('active', rosterMode === 'monthly');
  updateModeControls();
  if (document.getElementById('rosterModal').classList.contains('active')) {
    applyModeFields();
  }
  if (rosterMode === 'monthly') {
    loadMonth(rosterState.startDate || new Date());
  } else {
    loadCurrentWeek();
  }
}

function openMonthlyReport() {
  if (!rosterState.startDate) return;
  const year = rosterState.startDate.getFullYear();
  const month = String(rosterState.startDate.getMonth() + 1).padStart(2, '0');
  window.location.href = `/reports?month=${year}-${month}`;
}

function updateModeControls() {
  const monthPicker = document.getElementById('rosterMonthPicker');
  const prevBtn = document.getElementById('prevWeekBtn');
  const nextBtn = document.getElementById('nextWeekBtn');
  const todayBtn = document.getElementById('todayBtn');

  if (monthPicker) {
    monthPicker.style.display = rosterMode === 'monthly' ? 'inline-flex' : 'none';
  }

  if (rosterMode === 'monthly') {
    if (prevBtn) prevBtn.textContent = '◀';
    if (nextBtn) nextBtn.textContent = '▶';
    if (todayBtn) todayBtn.textContent = 'This Month';
  } else {
    if (prevBtn) prevBtn.textContent = '◀';
    if (nextBtn) nextBtn.textContent = '▶';
    if (todayBtn) todayBtn.textContent = 'Today';
  }
}

async function loadRoster(start, end) {
  const startStr = toDateString(start);
  const endStr = toDateString(end);

  try {
    const response = await fetch(`/api/roster?start=${startStr}&end=${endStr}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to load roster');
    }

    rosterState.startDate = new Date(start);
    rosterState.endDate = new Date(end);
    rosterState.days = buildDaysArray(start, end);
    rosterState.rows = result.data.rows || [];
    rosterState.guards = result.data.guards || [];
    rosterState.clients = result.data.clients || [];

    document.getElementById('rosterRangeLabel').textContent = formatRangeLabel(start, end);
    const monthPicker = document.getElementById('rosterMonthPicker');
    if (monthPicker) {
      const monthValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      monthPicker.value = monthValue;
    }

    if (rosterMode === 'monthly') {
      const monthlyTotal = rosterState.rows.reduce((sum, row) => sum + (row.totalHoursTarget || 0), 0);
      document.getElementById('totalHoursValue').textContent = monthlyTotal.toFixed(2);
      document.getElementById('confirmedCount').textContent = 'Confirmed Shifts: 0';
      document.getElementById('unconfirmedCount').textContent = 'Unconfirmed Shifts: 0';
      document.getElementById('unassignedCount').textContent = 'Unassigned Shifts: 0';
    } else {
      document.getElementById('totalHoursValue').textContent = (result.data.totalHours || 0).toFixed(2);
      document.getElementById('confirmedCount').textContent = `Confirmed Shifts: ${result.data.confirmedShifts || 0}`;
      document.getElementById('unconfirmedCount').textContent = `Unconfirmed Shifts: ${result.data.unconfirmedShifts || 0}`;
      document.getElementById('unassignedCount').textContent = `Unassigned Shifts: ${result.data.unassignedShifts || 0}`;
    }

    renderRosterTable();
  } catch (error) {
    console.error('Error loading roster:', error);
    const tbody = document.getElementById('rosterBody');
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:20px; color:#dc2626;">Error loading roster</td></tr>`;
  }
}

function buildDaysArray(start, end) {
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function renderRosterTable() {
  renderRosterHeader();
  renderRosterBody();
}

function renderRosterHeader() {
  const headRow = document.getElementById('rosterHeadRow');
  headRow.innerHTML = `
    <th>Client</th>
    <th>SID</th>
    <th>Site Name</th>
    <th>Guard</th>
  `;

  if (rosterMode === 'monthly') {
    const th = document.createElement('th');
    const label = rosterState.startDate ? formatMonthLabel(rosterState.startDate) : 'Month';
    th.textContent = label;
    headRow.appendChild(th);
    return;
  }

  rosterState.days.forEach(dayStr => {
    const [year, month, day] = dayStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const th = document.createElement('th');
    th.textContent = formatDayLabel(date);
    headRow.appendChild(th);
  });
}

function renderRosterBody() {
  const tbody = document.getElementById('rosterBody');

  if (rosterState.rows.length === 0) {
    const colSpan = rosterMode === 'monthly' ? 5 : 4 + rosterState.days.length;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" style="text-align:center; padding:20px;">
          No roster rows found.
          <button type="button" class="shift-action" id="emptyAddRowBtn" style="margin-left:10px;">Add Row</button>
        </td>
      </tr>
    `;
    const emptyBtn = document.getElementById('emptyAddRowBtn');
    if (emptyBtn) emptyBtn.addEventListener('click', openRowModal);
    return;
  }

  tbody.innerHTML = '';

  rosterState.rows.forEach(row => {
    const tr = document.createElement('tr');

    const clientCell = document.createElement('td');
    if (row.clientId) {
      clientCell.innerHTML = `<a class="roster-link" href="/clients?editId=${row.clientId}">${row.clientName || '-'}</a>`;
    } else {
      clientCell.textContent = row.clientName || '-';
    }
    tr.appendChild(clientCell);

    const sidCell = document.createElement('td');
    sidCell.textContent = row.sid || '-';
    tr.appendChild(sidCell);

    const siteCell = document.createElement('td');
    siteCell.textContent = row.siteName || '-';
    tr.appendChild(siteCell);

    const guardCell = document.createElement('td');
    if (row.guardId) {
      guardCell.innerHTML = `<a class="roster-link" href="/guards?editId=${row.guardId}">${row.guardName || '-'}</a>`;
    } else {
      guardCell.textContent = row.guardName || '-';
    }
    tr.appendChild(guardCell);

    if (rosterMode === 'monthly') {
      const cell = document.createElement('td');
      const cellContent = document.createElement('div');
      cellContent.className = 'roster-cell';
      cellContent.dataset.rowId = row.rowId;

      const totalTarget = row.totalHoursTarget || 0;
      const primaryTarget = row.primaryTargetHours || 0;

      if (totalTarget <= 0) {
        const empty = document.createElement('div');
        empty.className = 'shift-empty';
        empty.textContent = 'Add Monthly';
        cellContent.appendChild(empty);
      } else {
        const primaryBox = document.createElement('div');
        primaryBox.className = 'shift-box primary';
        primaryBox.innerHTML = `
          <div>${row.guardName || 'Primary Guard'}</div>
          <div class="shift-hours">${primaryTarget.toFixed(2)}h</div>
        `;
        cellContent.appendChild(primaryBox);

        (row.monthlyAssociatedTargets || []).forEach(assoc => {
          const assocBox = document.createElement('div');
          assocBox.className = 'shift-box associated';
          assocBox.innerHTML = `
            <div>${assoc.guardName || 'Associated Guard'}</div>
            <div class="shift-hours">${(assoc.hours || 0).toFixed(2)}h</div>
          `;
          cellContent.appendChild(assocBox);
        });
      }

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'shift-action';
      actionBtn.textContent = totalTarget > 0 ? 'Edit' : 'Add';
      actionBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRosterModal(row, rosterState.days[0] || toDateString(rosterState.startDate || new Date()));
      });
      cellContent.appendChild(actionBtn);

      cell.appendChild(cellContent);
      cellContent.addEventListener('click', (event) => {
        event.preventDefault();
        openRosterModal(row, rosterState.days[0] || toDateString(rosterState.startDate || new Date()));
      });

      tr.appendChild(cell);
      tbody.appendChild(tr);
      return;
    }

    let cumulativePrimary = row.primaryHoursBeforeRange || 0;

    rosterState.days.forEach(dayStr => {
      const cell = document.createElement('td');
      cell.className = 'roster-day-cell';

      const entry = row.rosterByDate?.[dayStr];
      const primaryHours = entry?.primary?.hours || 0;
      cumulativePrimary += primaryHours;

      const cellContent = document.createElement('div');
      cellContent.className = 'roster-cell';
      cellContent.dataset.rowId = row.rowId;
      cellContent.dataset.date = dayStr;

      if (!entry || (entry.totalHours || 0) === 0) {
        const empty = document.createElement('div');
        empty.className = 'shift-empty';
        empty.textContent = '+ Add';
        cellContent.appendChild(empty);
      } else {
        const primaryBox = document.createElement('div');
        primaryBox.className = 'shift-box primary';
        if (row.primaryTargetHours > 0 && cumulativePrimary >= row.primaryTargetHours) {
          primaryBox.classList.add('complete');
        }
        primaryBox.innerHTML = `
          <div>${row.guardName || entry.primary?.guardName || 'Primary Guard'}</div>
          <div class="shift-hours">${primaryHours.toFixed(2)}h</div>
        `;
        cellContent.appendChild(primaryBox);

        (entry.associated || []).forEach(assoc => {
          const assocBox = document.createElement('div');
          assocBox.className = 'shift-box associated';
          assocBox.innerHTML = `
            <div>${assoc.guardName || 'Associated Guard'}</div>
            <div class="shift-hours">${(assoc.hours || 0).toFixed(2)}h</div>
          `;
          cellContent.appendChild(assocBox);
        });
      }

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'shift-action';
      actionBtn.textContent = entry ? 'Edit' : 'Add';
      actionBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRosterModal(row, dayStr);
      });
      cellContent.appendChild(actionBtn);

      cell.appendChild(cellContent);
      cellContent.addEventListener('click', (event) => {
        event.preventDefault();
        openRosterModal(row, dayStr);
      });

      tr.appendChild(cell);
    });

    tbody.appendChild(tr);
  });
}

function openRosterModal(row, dateStr) {
  const entry = row.rosterByDate?.[dateStr] || null;

  currentModalContext = { row, dateStr };
  currentEntryStatus = entry?.status || 'unconfirmed';

  document.getElementById('rosterModalTitle').textContent = rosterMode === 'monthly'
    ? 'Monthly Allocation'
    : 'Assign Hours';
  document.getElementById('rosterDate').value = dateStr;
  document.getElementById('rosterModalMeta').value = `${row.clientName || '-'}  -  ${row.siteName || '-'}  -  ${row.guardName || '-'}`;

  setEntryStatus(currentEntryStatus);

  const remaining = calculateRemainingPrimary(row, dateStr);
  document.getElementById('primaryRemainingInput').value =
    Number.isFinite(remaining) ? `${remaining.toFixed(2)}h` : 'N/A';

  const totalHours = entry?.totalHours || 0;
  document.getElementById('totalHoursInput').value = totalHours > 0 ? totalHours.toFixed(2) : '';
  document.getElementById('primaryHoursInput').value = (entry?.primary?.hours || 0).toFixed(2);

  const monthLabel = rosterState.startDate
    ? rosterState.startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';
  document.getElementById('rosterMonthLabel').value = monthLabel;
  const monthlyPrimary = row.primaryTargetHours || 0;
  const monthlyTotal = row.totalHoursTarget || 0;
  document.getElementById('monthlyPrimaryHoursInput').value = monthlyPrimary > 0 ? monthlyPrimary.toFixed(2) : '';
  document.getElementById('monthlyTotalHoursInput').value = monthlyTotal > 0 ? monthlyTotal.toFixed(2) : '';
  const monthlyRemaining = row.primaryTargetHours > 0
    ? Math.max((row.primaryTargetHours || 0) - (row.primaryHoursMonth || 0), 0)
    : null;
  document.getElementById('monthlyRemainingInput').value =
    monthlyRemaining === null ? 'N/A' : `${monthlyRemaining.toFixed(2)}h`;

  document.getElementById('rosterNotes').value = entry?.notes || '';

  const assocList = document.getElementById('assocList');
  assocList.innerHTML = '';

  if (rosterMode === 'day') {
    const assocItems = entry?.associated || [];
    if (assocItems.length > 0) {
      assocItems.forEach(item => addAssociatedRow(item.guardId, item.hours));
    } else if (row.associatedGuardId) {
      addAssociatedRow(row.associatedGuardId, 0);
    }
  } else {
    const monthlyAssoc = row.monthlyAssociatedTargets || [];
    if (monthlyAssoc.length > 0) {
      monthlyAssoc.forEach(item => addAssociatedRow(item.guardId, item.hours));
    } else if (row.associatedGuardId) {
      addAssociatedRow(row.associatedGuardId, 0);
    }
  }

  document.getElementById('deleteRosterBtn').style.display = entry ? 'inline-flex' : 'none';
  applyModeFields();

  document.getElementById('rosterModal').classList.add('active');
}

function calculateRemainingPrimary(row, dateStr) {
  let assigned = row.primaryHoursBeforeRange || 0;
  const dayIndex = rosterState.days.indexOf(dateStr);
  for (let i = 0; i < dayIndex; i++) {
    const entry = row.rosterByDate?.[rosterState.days[i]];
    assigned += entry?.primary?.hours || 0;
  }
  const target = row.primaryTargetHours || 0;
  if (target <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const remaining = Math.max(target - assigned, 0);
  return remaining;
}

function addAssociatedRow(defaultGuardId = null, defaultHours = 0) {
  const assocList = document.getElementById('assocList');
  const row = document.createElement('div');
  row.className = 'assoc-row';

  const guardSelect = document.createElement('select');
  if (rosterState.guards.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No guards available';
    guardSelect.appendChild(option);
  } else {
    rosterState.guards.forEach(guard => {
      const option = document.createElement('option');
      option.value = guard._id;
      option.textContent = guard.guardName;
      if (defaultGuardId && guard._id === defaultGuardId) {
        option.selected = true;
      }
      guardSelect.appendChild(option);
    });
  }

  const hoursInput = document.createElement('input');
  hoursInput.type = 'number';
  hoursInput.min = '0';
  hoursInput.step = '0.5';
  hoursInput.value = defaultHours > 0 ? defaultHours.toFixed(2) : '';
  hoursInput.addEventListener('input', updateTotalFromAssociated);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'assoc-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => row.remove());

  row.appendChild(guardSelect);
  row.appendChild(hoursInput);
  row.appendChild(removeBtn);
  assocList.appendChild(row);
}

function handleTotalHoursChange() {
  if (rosterMode !== 'day') return;
  if (!currentModalContext) return;
  const totalHours = parseFloat(document.getElementById('totalHoursInput').value) || 0;
  const remaining = calculateRemainingPrimary(currentModalContext.row, currentModalContext.dateStr);
  const primaryHours = Math.min(totalHours, remaining);
  const remainder = Math.max(totalHours - primaryHours, 0);

  document.getElementById('primaryHoursInput').value = primaryHours.toFixed(2);

  const assocList = document.getElementById('assocList');
  const rows = Array.from(assocList.querySelectorAll('.assoc-row'));

  if (remainder > 0) {
    if (rows.length === 0) {
      addAssociatedRow(currentModalContext.row.associatedGuardId, remainder);
    } else {
      const firstHours = rows[0].querySelector('input');
      firstHours.value = remainder.toFixed(2);
    }

    rows.slice(1).forEach(r => {
      const input = r.querySelector('input');
      input.value = '';
    });
  } else {
    rows.forEach(r => {
      const input = r.querySelector('input');
      input.value = input.value ? input.value : '';
    });
  }
}

function handlePrimaryHoursChange() {
  if (rosterMode !== 'day') return;
  if (!currentModalContext) return;
  const primaryHours = parseFloat(document.getElementById('primaryHoursInput').value) || 0;
  const remaining = calculateRemainingPrimary(currentModalContext.row, currentModalContext.dateStr);
  const clamped = Math.min(primaryHours, remaining);
  if (clamped !== primaryHours) {
    document.getElementById('primaryHoursInput').value = clamped.toFixed(2);
  }
  updateTotalFromAssociated();
}

function updateTotalFromAssociated() {
  if (rosterMode === 'monthly') {
    const primary = parseFloat(document.getElementById('monthlyPrimaryHoursInput').value) || 0;
    const assocList = document.getElementById('assocList');
    const rows = Array.from(assocList.querySelectorAll('.assoc-row'));
    const assocTotal = rows.reduce((sum, row) => {
      const val = parseFloat(row.querySelector('input').value) || 0;
      return sum + val;
    }, 0);
    const total = primary + assocTotal;
    document.getElementById('monthlyTotalHoursInput').value = total > 0 ? total.toFixed(2) : '';
    return;
  }

  const primaryHours = parseFloat(document.getElementById('primaryHoursInput').value) || 0;
  const assocList = document.getElementById('assocList');
  const rows = Array.from(assocList.querySelectorAll('.assoc-row'));
  const assocTotal = rows.reduce((sum, row) => {
    const val = parseFloat(row.querySelector('input').value) || 0;
    return sum + val;
  }, 0);

  const totalHours = primaryHours + assocTotal;
  document.getElementById('totalHoursInput').value = totalHours > 0 ? totalHours.toFixed(2) : '';
}

function handleMonthlyTotalChange() {
  if (rosterMode !== 'monthly') return;
  const total = parseFloat(document.getElementById('monthlyTotalHoursInput').value) || 0;
  const primary = parseFloat(document.getElementById('monthlyPrimaryHoursInput').value) || 0;
  const assocTotal = Math.max(total - primary, 0);

  const assocList = document.getElementById('assocList');
  const rows = Array.from(assocList.querySelectorAll('.assoc-row'));
  if (rows.length === 0 && assocTotal > 0) {
    addAssociatedRow(currentModalContext?.row?.associatedGuardId, assocTotal);
  } else if (rows.length > 0) {
    rows[0].querySelector('input').value = assocTotal > 0 ? assocTotal.toFixed(2) : '';
    rows.slice(1).forEach(r => {
      r.querySelector('input').value = '';
    });
  }
}

function handleMonthlyPrimaryChange() {
  if (rosterMode !== 'monthly') return;
  const primary = parseFloat(document.getElementById('monthlyPrimaryHoursInput').value) || 0;
  const assocList = document.getElementById('assocList');
  const rows = Array.from(assocList.querySelectorAll('.assoc-row'));
  const assocTotal = rows.reduce((sum, row) => {
    const val = parseFloat(row.querySelector('input').value) || 0;
    return sum + val;
  }, 0);
  const total = primary + assocTotal;
  document.getElementById('monthlyTotalHoursInput').value = total > 0 ? total.toFixed(2) : '';
}

async function saveRosterEntry() {
  if (!currentModalContext) return;

  const rowId = currentModalContext.row.rowId;
  const notes = document.getElementById('rosterNotes').value || '';

  const assocList = document.getElementById('assocList');
  const assocRows = Array.from(assocList.querySelectorAll('.assoc-row'));
  const associated = assocRows.map(row => ({
    guardId: row.querySelector('select').value,
    guardName: row.querySelector('select').selectedOptions[0]?.textContent || '',
    hours: parseFloat(row.querySelector('input').value) || 0
  })).filter(item => item.hours > 0);

  try {
    if (rosterMode === 'monthly') {
      const year = rosterState.startDate.getFullYear();
      const month = rosterState.startDate.getMonth() + 1;
      const primaryHours = parseFloat(document.getElementById('monthlyPrimaryHoursInput').value) || 0;

      const response = await fetch('/api/roster/monthly-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId,
          year,
          month,
          primaryHours,
          associated,
          notes
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to save monthly target');
      }
    } else {
      const date = document.getElementById('rosterDate').value;
      const primaryHours = parseFloat(document.getElementById('primaryHoursInput').value) || 0;

      const response = await fetch('/api/roster/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId,
          date,
          primaryHours,
          associated,
          notes,
          status: currentEntryStatus
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to save roster entry');
      }
    }

    closeRosterModal();
    loadRoster(rosterState.startDate, rosterState.endDate);
  } catch (error) {
    console.error('Error saving roster entry:', error);
    alert('Error saving roster entry');
  }
}

function closeRosterModal() {
  document.getElementById('rosterModal').classList.remove('active');
  currentModalContext = null;
}

function setEntryStatus(status) {
  currentEntryStatus = status === 'confirmed' ? 'confirmed' : 'unconfirmed';
  document.getElementById('statusConfirmedBtn').classList.toggle('active', currentEntryStatus === 'confirmed');
  document.getElementById('statusUnconfirmedBtn').classList.toggle('active', currentEntryStatus === 'unconfirmed');
}

function applyModeFields() {
  const dayFields = document.querySelectorAll('.day-fields');
  const monthFields = document.querySelectorAll('.monthly-fields');
  dayFields.forEach(el => el.style.display = rosterMode === 'day' ? '' : 'none');
  monthFields.forEach(el => el.style.display = rosterMode === 'monthly' ? '' : 'none');
  document.getElementById('statusToggle').style.display = rosterMode === 'day' ? 'flex' : 'none';
  if (rosterMode === 'monthly') {
    document.getElementById('deleteRosterBtn').style.display = 'none';
  }
}

async function deleteRosterEntry() {
  if (!currentModalContext) return;
  if (!confirm('Delete this roster entry?')) return;

  try {
    const response = await fetch('/api/roster/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: currentModalContext.row.rowId,
        date: currentModalContext.dateStr
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to delete roster entry');
    }

    closeRosterModal();
    loadRoster(rosterState.startDate, rosterState.endDate);
  } catch (error) {
    console.error('Error deleting roster entry:', error);
    alert('Error deleting roster entry');
  }
}

function openRowModal() {
  currentRowEditId = null;
  const rowModal = document.getElementById('rowModal');
  if (!rowModal) return;

  document.getElementById('rowModalTitle').textContent = 'Add Roster Row';
  document.getElementById('rowSiteInput').value = '';
  populateRowSelects();

  rowModal.classList.add('active');
}

function closeRowModal() {
  const rowModal = document.getElementById('rowModal');
  if (rowModal) rowModal.classList.remove('active');
  currentRowEditId = null;
}

function populateRowSelects() {
  const clientSelect = document.getElementById('rowClientSelect');
  const guardSelect = document.getElementById('rowGuardSelect');

  if (clientSelect) {
    clientSelect.innerHTML = '<option value="">Select Client</option>' +
      rosterState.clients.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  }

  if (guardSelect) {
    guardSelect.innerHTML = '<option value="">Select Guard</option>' +
      rosterState.guards.map(g => `<option value="${g._id}">${g.guardName}</option>`).join('');
  }
}

async function saveRosterRow() {
  const clientId = document.getElementById('rowClientSelect')?.value || '';
  const guardId = document.getElementById('rowGuardSelect')?.value || '';
  const siteName = document.getElementById('rowSiteInput')?.value || '';

  if (!clientId || !guardId) {
    alert('Please select both client and guard');
    return;
  }

  try {
    const response = await fetch('/api/roster/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        guardId,
        siteName
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to create row');
    }

    closeRowModal();
    loadRoster(rosterState.startDate || new Date(), rosterState.endDate || new Date());
  } catch (error) {
    console.error('Error creating roster row:', error);
    alert('Error creating roster row');
  }
}


