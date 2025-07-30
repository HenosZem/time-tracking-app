// Supabase initialization
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.showSection = function(section) {
  document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
  const el = document.getElementById(section);
  if (el) {
    el.classList.remove('hidden');
  }
};

// Clock In/Clock Out for Manager/Admin
async function clockIn() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    document.getElementById('clock-msg').innerText = "Could not get user information.";
    return;
  }
  const user_id = userData.user.id;
  const clock_in = new Date().toISOString();
  const { error } = await supabase.from('time_entries').insert([
    { user_id, clock_in }
  ]);
  document.getElementById('clock-msg').innerText = error ? 'Clock In failed: ' + error.message : 'Clocked In!';
}

async function clockOut() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    document.getElementById('clock-msg').innerText = "Could not get user information.";
    return;
  }
  const user_id = userData.user.id;
  const { data: entries, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user_id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1);

  if (fetchError || !entries.length) {
    document.getElementById('clock-msg').innerText = 'No open clock-in entry found.';
    return;
  }
  const entry_id = entries[0].id;
  const clock_out = new Date().toISOString();
  const { error } = await supabase.from('time_entries').update({ clock_out }).eq('id', entry_id);
  document.getElementById('clock-msg').innerText = error ? 'Clock Out failed: ' + error.message : 'Clocked Out!';
}
window.clockIn = clockIn;
window.clockOut = clockOut;

// Check if user is manager
supabase.auth.getUser().then(async ({ data: { user }, error }) => {
  if (error || !user) {
    window.location.href = '../login.html';
    return;
  }
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (profileError || !profile || profile.role !== 'manager') {
    window.location.href = '../login.html';
    return;
  }
});

// Timesheet Overview with enhanced filtering
async function loadTimesheets() {
  try {
    // Show loading state
    document.getElementById('timesheet-table').innerHTML = '<p>Loading timesheets...</p>';
    
    // Get filter values
    const filterName = document.getElementById('filter-name').value.trim();
    const dateRange = document.getElementById('date-range').value;
    
    let startDate, endDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Set date range based on selection
    switch(dateRange) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'pay-period':
        // Get current pay period (Thursday to Thursday)
        startDate = new Date(today);
        while (startDate.getDay() !== 4) { // 4 = Thursday
          startDate.setDate(startDate.getDate() - 1);
        }
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'custom':
        const customStart = document.getElementById('start-date').value;
        const customEnd = document.getElementById('end-date').value;
        if (!customStart || !customEnd) {
          throw new Error('Please select both start and end dates');
        }
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
        break;
    }
    
    // First get all relevant profiles if name filter is applied
    let profileIds = [];
    if (filterName) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('name', `%${filterName}%`);
      
      if (profileError) throw profileError;
      profileIds = profiles.map(p => p.user_id);
    }
    
    // Build the time entries query
    let query = supabase
      .from('time_entries')
      .select(`
        id,
        user_id,
        clock_in,
        clock_out,
        total_hours,
        name
      `)
      .gte('clock_in', startDate.toISOString())
      .lte('clock_in', endDate.toISOString());
    
    // Apply name filter if provided
    if (filterName && profileIds.length > 0) {
      query = query.in('user_id', profileIds);
    } else if (filterName) {
      // If name filter was provided but no profiles matched
      document.getElementById('timesheet-table').innerHTML = '<p>No employees found matching that name</p>';
      return;
    }
    
    // Execute query
    const { data: entries, error } = await query;
    
    if (error) throw error;
    
    // Get all employee names in one query
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name');
    
    if (profilesError) throw profilesError;
    
    // Create a mapping of user_id to name
    const idToName = {};
    profiles.forEach(p => idToName[p.user_id] = p.name);
    
    // Build the table
    let html = `
      <div class="timesheet-summary">
        Showing ${entries.length} entries from 
        ${luxon.DateTime.fromJSDate(startDate).toFormat('MMM dd, yyyy')} to 
        ${luxon.DateTime.fromJSDate(endDate).toFormat('MMM dd, yyyy')}
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Total Hours</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    if (entries.length === 0) {
      html += '<tr><td colspan="5" style="text-align: center;">No entries found</td></tr>';
    } else {
      entries.forEach(entry => {
        const clockIn = entry.clock_in ? 
          luxon.DateTime.fromISO(entry.clock_in).setZone('America/New_York').toFormat('h:mm a') : '-';
        const clockOut = entry.clock_out ? 
          luxon.DateTime.fromISO(entry.clock_out).setZone('America/New_York').toFormat('h:mm a') : '-';
        const date = entry.clock_in ? 
          luxon.DateTime.fromISO(entry.clock_in).setZone('America/New_York').toFormat('MMM dd, yyyy') : '-';
        const totalHours = entry.total_hours ? 
          parseFloat(entry.total_hours).toFixed(2) : '-';
        
        // Use name from time_entries if available, otherwise from profiles
        const employeeName = entry.name || idToName[entry.user_id] || 'Unknown';
        
        html += `
          <tr>
            <td>${employeeName}</td>
            <td>${clockIn}</td>
            <td>${clockOut}</td>
            <td>${totalHours}</td>
            <td>${date}</td>
          </tr>
        `;
      });
    }
    
    html += '</tbody></table>';
    document.getElementById('timesheet-table').innerHTML = html;
    
  } catch (error) {
    console.error('Error loading timesheets:', error);
    document.getElementById('timesheet-table').innerHTML = `
      <div class="error-message">
        Error: ${error.message}
        <button onclick="loadTimesheets()">Retry</button>
      </div>
    `;
  }
}

// Update date filters when range selection changes
window.updateDateFilters = function() {
  const range = document.getElementById('date-range').value;
  const customGroup = document.getElementById('custom-range-group');
  
  if (range === 'custom') {
    customGroup.style.display = 'flex';
  } else {
    customGroup.style.display = 'none';
    loadTimesheets(); // Auto-refresh when changing to predefined ranges
  }
};

// Initialize date pickers with current pay period
function initDatePickers() {
  const today = new Date();
  let startDate = new Date(today);
  
  // Find most recent Thursday
  while (startDate.getDay() !== 4) { // 4 = Thursday
    startDate.setDate(startDate.getDate() - 1);
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  document.getElementById('start-date').valueAsDate = startDate;
  document.getElementById('end-date').valueAsDate = endDate;
}

// Add this to your initialization section
initDatePickers();

// Payroll Summary Functions
async function initPayrollSection() {
  // Load employees
  const { data: employees, error } = await supabase
    .from('profiles')
    .select('user_id, name, hourly_rate')
    .eq('role', 'employee')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error loading employees:', error);
    return;
  }
  
  const employeeSelect = document.getElementById('payroll-employee');
  employeeSelect.innerHTML = employees.map(e => 
    `<option value="${e.user_id}">${e.name} ($${e.hourly_rate}/hr)</option>`
  ).join('');
  
  // Set up event listeners
  document.getElementById('pay-period').addEventListener('change', function() {
    const customGroup = document.getElementById('custom-period-group');
    customGroup.style.display = this.value === 'custom' ? 'flex' : 'none';
  });
  
  document.getElementById('generate-payroll').addEventListener('click', generatePayrollReport);
  document.getElementById('export-payroll').addEventListener('click', exportPayrollToCSV);
  
  // Set default custom dates to current pay period
  const { startDate, endDate } = getCurrentPayPeriod();
  document.getElementById('custom-start').valueAsDate = startDate;
  document.getElementById('custom-end').valueAsDate = endDate;
}

function getCurrentPayPeriod() {
  const today = new Date();
  let startDate = new Date(today);
  
  // Find most recent Thursday (pay period starts Thursday)
  while (startDate.getDay() !== 4) {
    startDate.setDate(startDate.getDate() - 1);
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // Pay period ends next Wednesday
  
  return { startDate, endDate };
}

async function generatePayrollReport() {
  try {
    const employeeId = document.getElementById('payroll-employee').value;
    const periodType = document.getElementById('pay-period').value;
    
    if (!employeeId) {
      throw new Error('Please select an employee');
    }
    
    let startDate, endDate;
    
    switch(periodType) {
      case 'current':
        ({ startDate, endDate } = getCurrentPayPeriod());
        break;
      case 'previous':
        ({ startDate, endDate } = getCurrentPayPeriod());
        startDate.setDate(startDate.getDate() - 7);
        endDate.setDate(endDate.getDate() - 7);
        break;
      case 'custom':
        startDate = new Date(document.getElementById('custom-start').value);
        endDate = new Date(document.getElementById('custom-end').value);
        
        if (!startDate || !endDate) {
          throw new Error('Please select both start and end dates');
        }
        
        if (startDate > endDate) {
          throw new Error('End date must be after start date');
        }
        
        // Include full end date
        endDate.setHours(23, 59, 59, 999);
        break;
    }
    
    // Get employee details
    const { data: employee, error: empError } = await supabase
      .from('profiles')
      .select('name, hourly_rate')
      .eq('user_id', employeeId)
      .single();
    
    if (empError || !employee) {
      throw new Error('Error loading employee details');
    }
    
    // Get time entries for the period
    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', employeeId)
      .gte('clock_in', startDate.toISOString())
      .lte('clock_in', endDate.toISOString())
      .order('clock_in', { ascending: true });
    
    if (entriesError) {
      throw entriesError;
    }
    
    // Calculate totals
    let totalHours = 0;
    const shifts = [];
    
    entries.forEach(entry => {
      if (entry.clock_in && entry.clock_out) {
        const clockIn = new Date(entry.clock_in);
        const clockOut = new Date(entry.clock_out);
        const hours = (clockOut - clockIn) / (1000 * 60 * 60); // Convert ms to hours
        totalHours += hours;
        
        shifts.push({
          date: luxon.DateTime.fromJSDate(clockIn).toFormat('MMM dd, yyyy'),
          clockIn: luxon.DateTime.fromJSDate(clockIn).toFormat('h:mm a'),
          clockOut: luxon.DateTime.fromJSDate(clockOut).toFormat('h:mm a'),
          hours: hours.toFixed(2)
        });
      }
    });
    
    const grossPay = totalHours * employee.hourly_rate;
    
    // Build the report HTML
    let html = `
      <div class="report-header">
        <h3>Payroll Report for ${employee.name}</h3>
        <p>Period: ${luxon.DateTime.fromJSDate(startDate).toFormat('MMM dd, yyyy')} to 
           ${luxon.DateTime.fromJSDate(endDate).toFormat('MMM dd, yyyy')}</p>
      </div>
      
      <table class="payroll-summary-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Hourly Rate</th>
            <th>Total Hours</th>
            <th>Gross Pay</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${employee.name}</td>
            <td>$${employee.hourly_rate.toFixed(2)}</td>
            <td>${totalHours.toFixed(2)}</td>
            <td>$${grossPay.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <h4>Shift Details</h4>
      <table class="shift-details-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    shifts.forEach(shift => {
      html += `
        <tr>
          <td>${shift.date}</td>
          <td>${shift.clockIn}</td>
          <td>${shift.clockOut}</td>
          <td>${shift.hours}</td>
        </tr>
      `;
    });
    
    // Add total row
    html += `
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td>${totalHours.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    `;
    
    document.getElementById('payroll-report').innerHTML = html;
    document.getElementById('export-payroll').disabled = false;
    
    // Store data for export
    currentPayrollReport = {
      employee,
      period: { startDate, endDate },
      totalHours,
      grossPay,
      shifts
    };
    
  } catch (error) {
    console.error('Error generating payroll report:', error);
    document.getElementById('payroll-report').innerHTML = `
      <div class="error-message">
        Error: ${error.message}
      </div>
    `;
    document.getElementById('export-payroll').disabled = true;
  }
}

function exportPayrollToCSV() {
  if (!currentPayrollReport) return;
  
  const { employee, period, totalHours, grossPay, shifts } = currentPayrollReport;
  
  // Create CSV content
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Add header
  csvContent += `Payroll Report for ${employee.name}\n`;
  csvContent += `Period: ${luxon.DateTime.fromJSDate(period.startDate).toFormat('MMM dd, yyyy')} to ${luxon.DateTime.fromJSDate(period.endDate).toFormat('MMM dd, yyyy')}\n\n`;
  
  // Add summary
  csvContent += "Summary\n";
  csvContent += `Employee,${employee.name}\n`;
  csvContent += `Hourly Rate,$${employee.hourly_rate.toFixed(2)}\n`;
  csvContent += `Total Hours,${totalHours.toFixed(2)}\n`;
  csvContent += `Gross Pay,$${grossPay.toFixed(2)}\n\n`;
  
  // Add shift details header
  csvContent += "Shift Details\n";
  csvContent += "Date,Clock In,Clock Out,Hours\n";
  
  // Add shift data
  shifts.forEach(shift => {
    csvContent += `${shift.date},${shift.clockIn},${shift.clockOut},${shift.hours}\n`;
  });
  
  // Add total
  csvContent += `Total,,,${totalHours.toFixed(2)}\n`;
  
  // Create download link
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `payroll_${employee.name.replace(/\s+/g, '_')}_${luxon.DateTime.fromJSDate(period.startDate).toFormat('yyyy-MM-dd')}_to_${luxon.DateTime.fromJSDate(period.endDate).toFormat('yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize when page loads
let currentPayrollReport = null;
initPayrollSection();

// Update tab listener
document.querySelector('a[onclick*="payroll-summary"]').addEventListener('click', initPayrollSection);

// Edit Entries
async function loadEditEntries() {
  const { data: entries, error: entriesError } = await supabase.from('time_entries').select('*');
  if (entriesError) return document.getElementById('edit-table').innerText = 'Error loading entries';
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('user_id, name');
  if (profilesError) return document.getElementById('edit-table').innerText = 'Error loading profiles';
  const idToName = {};
  profiles.forEach(p => idToName[p.user_id] = p.name);
  let html = `<table><tr><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Edit</th></tr>`;
  entries.forEach(entry => {
    let clockInLocal = entry.clock_in ? luxon.DateTime.fromISO(entry.clock_in, { zone: 'utc' }).setZone('America/New_York').toFormat("yyyy-MM-dd'T'HH:mm") : '';
    let clockOutLocal = entry.clock_out ? luxon.DateTime.fromISO(entry.clock_out, { zone: 'utc' }).setZone('America/New_York').toFormat("yyyy-MM-dd'T'HH:mm") : '';
    html += `<tr>
      <td>${idToName[entry.user_id] || entry.user_id}</td>
      <td><input type="datetime-local" value="${clockInLocal}" id="in-${entry.id}" /></td>
      <td><input type="datetime-local" value="${clockOutLocal}" id="out-${entry.id}" /></td>
      <td><button onclick="updateEntry('${entry.id}')">Save</button></td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('edit-table').innerHTML = html;
}
window.updateEntry = async function(id) {
  const clock_in = document.getElementById('in-' + id).value;
  const clock_out = document.getElementById('out-' + id).value;
  const edited_by = null; // Optionally set to manager id, if available
  const { error } = await supabase.from('time_entries').update({ clock_in, clock_out, edited_by }).eq('id', id);
  if (error) alert('Update failed: ' + error.message);
  else { alert('Entry updated'); loadEditEntries(); }
};

// Time-Off Approval
async function loadTimeOffRequests() {
  try {
    document.getElementById('timeoff-status').innerText = 'Loading requests...';
    document.getElementById('timeoff-table').innerHTML = '';
    
    // Get current manager user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    
    // Get all time-off requests
    const { data: requests, error: requestsError } = await supabase
      .from('time_off_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (requestsError) throw requestsError;
    
    // Get all employee profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name');
    
    if (profilesError) throw profilesError;
    
    const idToName = {};
    profiles.forEach(p => idToName[p.user_id] = p.name);
    
    if (requests.length === 0) {
      document.getElementById('timeoff-table').innerHTML = '<p>No time-off requests found</p>';
      document.getElementById('timeoff-status').innerText = '';
      return;
    }
    
    let html = `
      <table class="timeoff-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Store requests with their unique identifiers
    const requestsWithIdentifiers = requests.map((req, index) => {
      // Create a unique composite key for requests without ID
      const identifier = req.id || `${req.user_id}-${req.start_date}-${req.end_date}-${index}`;
      return { ...req, identifier };
    });
    
    requestsWithIdentifiers.forEach(req => {
      const statusCell = req.status === 'pending' 
        ? `<span style="color: orange; font-weight: bold;">Pending</span>`
        : req.status === 'approved'
        ? `<span style="color: green; font-weight: bold;">Approved</span>`
        : `<span style="color: red; font-weight: bold;">Rejected</span>`;
      
      html += `
        <tr data-request-identifier="${req.identifier}">
          <td>${idToName[req.user_id] || req.user_id}</td>
          <td>${req.start_date}</td>
          <td>${req.end_date}</td>
          <td>${req.reason || '-'}</td>
          <td class="status-cell">${statusCell}</td>
          <td class="action-cell">
            ${req.status === 'pending' ? `
              <button class="approve-btn" data-action="approve">Approve</button>
              <button class="reject-btn" data-action="reject">Reject</button>
            ` : 'No actions available'}
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    document.getElementById('timeoff-table').innerHTML = html;
    document.getElementById('timeoff-status').innerText = `Loaded ${requests.length} requests`;
    
    // Add event listeners to all buttons
    document.querySelectorAll('.approve-btn, .reject-btn').forEach(button => {
      button.addEventListener('click', async function() {
        const row = this.closest('tr');
        const requestIdentifier = row.dataset.requestIdentifier;
        const action = this.dataset.action;
        
        try {
          // Find the original request data
          const originalRequest = requestsWithIdentifiers.find(
            req => req.identifier === requestIdentifier
          );
          
          if (!originalRequest) throw new Error('Could not find request data');
          
          // For requests with null ID, we need to delete and recreate
          if (!originalRequest.id) {
            // First delete the null ID record
            const { error: deleteError } = await supabase
              .from('time_off_requests')
              .delete()
              .match({
                user_id: originalRequest.user_id,
                start_date: originalRequest.start_date,
                end_date: originalRequest.end_date,
                status: 'pending'
              });
            
            if (deleteError) throw deleteError;
            
            // Then create a new record with the updated status
            const { data: newRequest, error: createError } = await supabase
              .from('time_off_requests')
              .insert([{
                user_id: originalRequest.user_id,
                start_date: originalRequest.start_date,
                end_date: originalRequest.end_date,
                reason: originalRequest.reason,
                status: action === 'approve' ? 'approved' : 'rejected',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
              }])
              .select()
              .single();
            
            if (createError) throw createError;
          } else {
            // For requests with proper IDs, just update
            const { error: updateError } = await supabase
              .from('time_off_requests')
              .update({ 
                status: action === 'approve' ? 'approved' : 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id
              })
              .eq('id', originalRequest.id);
            
            if (updateError) throw updateError;
          }
          
          // Update UI
          const statusCell = row.querySelector('.status-cell');
          if (statusCell) {
            statusCell.innerHTML = action === 'approve' 
              ? '<span style="color: green; font-weight: bold;">Approved</span>'
              : '<span style="color: red; font-weight: bold;">Rejected</span>';
          }
          
          // Remove action buttons
          const actionCell = row.querySelector('.action-cell');
          if (actionCell) {
            actionCell.innerHTML = 'No actions available';
          }
          
          document.getElementById('timeoff-status').innerText = 
            `Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`;
          
          // Reload requests to get fresh data
          loadTimeOffRequests();
          
        } catch (error) {
          console.error(`${action} failed:`, error);
          document.getElementById('timeoff-status').innerText = 
            `${action === 'approve' ? 'Approval' : 'Rejection'} failed: ${error.message}`;
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading time-off requests:', error);
    document.getElementById('timeoff-status').innerText = `Error: ${error.message}`;
    document.getElementById('timeoff-table').innerHTML = `
      <div class="error-message">
        Failed to load requests. <button onclick="loadTimeOffRequests()">Try again</button>
      </div>
    `;
  }
}

// Employee Management Functions
async function loadEmployees() {
  try {
    // Show loading state
    document.getElementById('employee-table').innerHTML = '<p>Loading employees...</p>';
    
    // Get all employees
    const { data: employees, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, hourly_rate, role')
      .order('name', { ascending: true });

    if (error) throw error;

    // Filter to only show employees (not managers)
    const filteredEmployees = employees.filter(emp => emp.role === 'employee');

    // Build the table
    let html = `
      <table class="employee-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Hourly Rate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (filteredEmployees.length === 0) {
      html += '<tr><td colspan="4" style="text-align: center;">No employees found</td></tr>';
    } else {
      filteredEmployees.forEach(emp => {
        html += `
          <tr id="emp-row-${emp.user_id}">
            <td>
              <input type="text" id="name-${emp.user_id}" 
                     value="${emp.name || ''}" 
                     placeholder="No name">
            </td>
            <td>
              <input type="email" id="email-${emp.user_id}" 
                     value="${emp.email || ''}" 
                     placeholder="No email">
            </td>
            <td>
              <input type="number" id="rate-${emp.user_id}" 
                     value="${emp.hourly_rate || 0}" 
                     step="0.01" min="0">
            </td>
            <td>
              <button onclick="updateEmployee('${emp.user_id}')" 
                      class="save-btn">Save</button>
            </td>
          </tr>
        `;
      });
    }

    html += '</tbody></table>';
    document.getElementById('employee-table').innerHTML = html;

  } catch (error) {
    console.error('Error loading employees:', error);
    document.getElementById('employee-table').innerHTML = `
      <div class="error-message">
        Error loading employees: ${error.message}
        <button onclick="loadEmployees()">Retry</button>
      </div>
    `;
  }
}

// Update employee from table row
window.updateEmployee = async function(userId) {
  try {
    const name = document.getElementById(`name-${userId}`).value;
    const email = document.getElementById(`email-${userId}`).value;
    const hourlyRate = parseFloat(document.getElementById(`rate-${userId}`).value);

    if (isNaN(hourlyRate)) {
      throw new Error('Please enter a valid hourly rate');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        name: name,
        email: email, 
        hourly_rate: hourlyRate 
      })
      .eq('user_id', userId);

    if (error) throw error;

    // Visual feedback
    const row = document.getElementById(`emp-row-${userId}`);
    if (row) {
      row.style.backgroundColor = '#e6ffe6';
      setTimeout(() => row.style.backgroundColor = '', 2000);
    }
    alert('Employee updated successfully!');

  } catch (error) {
    console.error('Update error:', error);
    alert(`Update failed: ${error.message}`);
  }
};

// Initialize on page load
showSection('employee-management');
loadEmployees();

// Set up tab listener
document.querySelector('a[onclick*="employee-management"]').addEventListener('click', loadEmployees);

// Initialize on page load
showSection('employee-management');
loadEmployees();

// Load initial section and set tab listeners
showSection('employee-management');
loadEmployees();
document.querySelector('a[onclick*="employee-management"]').addEventListener('click', loadEmployees);
document.querySelector('a[onclick*="timesheet-overview"]').addEventListener('click', function() {
  loadTimesheets();
  initDatePickers(); // Ensure date pickers are initialized
});
document.querySelector('a[onclick*="payroll-summary"]').addEventListener('click', function() {
  loadPayroll();
  loadPayrollCalcSelectors();
  document.getElementById('payroll-calc-result').innerHTML = "";
});
document.querySelector('a[onclick*="edit-entries"]').addEventListener('click', loadEditEntries);
document.querySelector('a[onclick*="timeoff-approval"]').addEventListener('click', loadTimeOffRequests); 
