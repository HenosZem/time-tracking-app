// Supabase initialization
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.showSection = function(section) {
  document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(section).classList.remove('hidden');
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

// Employee Management - allow pay rate adjustment
async function loadEmployees() {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'employee');
  if (error) return document.getElementById('employee-table').innerText = 'Error loading employees';
  let html = `<table><tr><th>Name</th><th>Email</th><th>Hourly Rate</th><th>Action</th></tr>`;
  data.forEach(emp => {
    html += `<tr>
      <td>${emp.full_name}</td>
      <td>${emp.email || '-'}</td>
      <td><input type='number' id='rate-${emp.user_id}' value='${emp.hourly_rate || 0}' style='width:70px;' /></td>
      <td><button onclick="editEmployee('${emp.user_id}','${emp.full_name}','${emp.email || ''}',document.getElementById('rate-${emp.user_id}').value)">Edit</button></td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('employee-table').innerHTML = html;
}
window.editEmployee = function(id, name, email, hourly_rate) {
  document.getElementById('emp-id').value = id;
  document.getElementById('emp-name').value = name;
  document.getElementById('emp-email').value = email;
  document.getElementById('emp-hourly-rate').value = hourly_rate;
};
document.getElementById('update-employee-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('emp-id').value;
  const name = document.getElementById('emp-name').value;
  const email = document.getElementById('emp-email').value;
  const hourly_rate = document.getElementById('emp-hourly-rate').value;
  const { error } = await supabase.from('profiles').update({ full_name: name, email, hourly_rate }).eq('user_id', id);
  if (error) alert('Update failed: ' + error.message);
  else { alert('Employee updated'); loadEmployees(); }
});

// Timesheet Overview with filter
async function loadTimesheets() {
  let filterName = document.getElementById('filter-name')?.value || '';
  let filterDate = document.getElementById('filter-date')?.value || '';
  let query = supabase.from('time_entries').select('*');
  if (filterName) {
    let { data: profiles } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${filterName}%`);
    let ids = profiles ? profiles.map(p => p.id) : [];
    query = query.in('user_id', ids);
  }
  if (filterDate) {
    query = query.gte('clock_in', filterDate + 'T00:00:00').lte('clock_in', filterDate + 'T23:59:59');
  }
  const { data: entries, error: entriesError } = await query;
  if (entriesError) return document.getElementById('timesheet-table').innerText = 'Error loading timesheets';
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name');
  if (profilesError) return document.getElementById('timesheet-table').innerText = 'Error loading profiles';
  const idToName = {};
  profiles.forEach(p => idToName[p.id] = p.full_name);
  let html = `<input id='filter-name' placeholder='Filter by name' style='margin-bottom:5px;' oninput='loadTimesheets()' /> <input id='filter-date' type='date' style='margin-bottom:5px;' onchange='loadTimesheets()' />`;
  html += `<table><tr><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Total Hours</th></tr>`;
  entries.forEach(entry => {
    let total_hours = entry.clock_in && entry.clock_out ? ((new Date(entry.clock_out) - new Date(entry.clock_in))/3600000).toFixed(2) : '-';
    html += `<tr>
      <td>${idToName[entry.user_id] || entry.user_id}</td>
      <td>${entry.clock_in ? entry.clock_in.replace('T',' ').slice(0,16) : '-'}</td>
      <td>${entry.clock_out ? entry.clock_out.replace('T',' ').slice(0,16) : '-'}</td>
      <td>${total_hours}</td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('timesheet-table').innerHTML = html;
}

// Payroll Summary
async function loadPayroll() {
  const { data: reports, error: reportsError } = await supabase.from('payroll_reports').select('*');
  if (reportsError) return document.getElementById('payroll-table').innerText = 'Error loading payroll';
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, name');
  if (profilesError) return document.getElementById('payroll-table').innerText = 'Error loading profiles';
  const idToName = {};
  profiles.forEach(p => idToName[p.id] = p.name);
  let html = `<table><tr><th>Employee</th><th>Pay Period</th><th>Total Hours</th><th>Gross Pay</th></tr>`;
  reports.forEach(row => {
    html += `<tr>
      <td>${idToName[row.user_id] || row.user_id}</td>
      <td>${row.pay_period_id}</td>
      <td>${row.total_hours}</td>
      <td>$${row.gross_pay}</td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('payroll-table').innerHTML = html;
}

// Payroll Calculation Controls
async function loadPayrollCalcSelectors() {
  // Employees
  const { data: employees, error: empError } = await supabase.from('profiles').select('id, name').eq('role', 'employee');
  const empSel = document.getElementById('payroll-employee-select');
  empSel.innerHTML = empError ? `<option>Error</option>` :
    employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

  // Pay Periods
  const { data: periods, error: perError } = await supabase.from('pay_periods').select('id, start_date, end_date').order('start_date', { ascending: false });
  const perSel = document.getElementById('payroll-period-select');
  perSel.innerHTML = perError ? `<option>Error</option>` :
    periods.map(p => `<option value="${p.id}">${p.start_date} to ${p.end_date}</option>`).join('');
}

async function calculatePayrollForEmployeePeriod(empId, periodId) {
  // Get pay period
  const { data: period, error: periodError } = await supabase.from('pay_periods').select('start_date, end_date').eq('id', periodId).single();
  if (periodError || !period) {
    document.getElementById('payroll-calc-result').innerText = "Error getting pay period.";
    return;
  }
  // Get employee
  const { data: emp, error: empError } = await supabase.from('profiles').select('id, name, hourly_rate').eq('id', empId).single();
  if (empError || !emp) {
    document.getElementById('payroll-calc-result').innerText = "Error getting employee.";
    return;
  }
  // Get time entries for employee in period
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('clock_in, clock_out')
    .eq('user_id', empId)
    .gte('clock_in', period.start_date)
    .lte('clock_out', period.end_date);

  if (entriesError) {
    document.getElementById('payroll-calc-result').innerText = "Error loading entries.";
    return;
  }
  // Calculate total hours
  let totalHours = 0;
  entries.forEach(entry => {
    if (entry.clock_in && entry.clock_out) {
      const inTime = new Date(entry.clock_in);
      const outTime = new Date(entry.clock_out);
      const hours = (outTime - inTime) / (1000 * 60 * 60);
      totalHours += hours;
    }
  });
  totalHours = totalHours.toFixed(2);
  const grossPay = (totalHours * parseFloat(emp.hourly_rate)).toFixed(2);

  document.getElementById('payroll-calc-result').innerHTML = `
    <strong>${emp.name}</strong><br>
    Pay Period: ${period.start_date} to ${period.end_date}<br>
    Total Hours: ${totalHours}<br>
    Hourly Rate: $${emp.hourly_rate}<br>
    <strong>Gross Pay: $${grossPay}</strong>
  `;
}

document.getElementById('payroll-calc-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const empId = document.getElementById('payroll-employee-select').value;
  const periodId = document.getElementById('payroll-period-select').value;
  calculatePayrollForEmployeePeriod(empId, periodId);
});

// Edit Entries
async function loadEditEntries() {
  const { data: entries, error: entriesError } = await supabase.from('time_entries').select('*');
  if (entriesError) return document.getElementById('edit-table').innerText = 'Error loading entries';
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, name');
  if (profilesError) return document.getElementById('edit-table').innerText = 'Error loading profiles';
  const idToName = {};
  profiles.forEach(p => idToName[p.id] = p.name);
  let html = `<table><tr><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Edit</th></tr>`;
  entries.forEach(entry => {
    html += `<tr>
      <td>${idToName[entry.user_id] || entry.user_id}</td>
      <td><input type="datetime-local" value="${entry.clock_in ? entry.clock_in.replace('Z','').slice(0,16) : ''}" id="in-${entry.id}" /></td>
      <td><input type="datetime-local" value="${entry.clock_out ? entry.clock_out.replace('Z','').slice(0,16) : ''}" id="out-${entry.id}" /></td>
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
  const { data: requests, error: requestsError } = await supabase.from('time_off_requests').select('*');
  if (requestsError) return document.getElementById('timeoff-table').innerText = 'Error loading requests';
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, name');
  if (profilesError) return document.getElementById('timeoff-table').innerText = 'Error loading profiles';
  const idToName = {};
  profiles.forEach(p => idToName[p.id] = p.name);
  let html = `<table><tr><th>Employee</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr>`;
  requests.forEach(req => {
    html += `<tr>
      <td>${idToName[req.user_id] || req.user_id}</td>
      <td>${req.start_date}</td>
      <td>${req.end_date}</td>
      <td>${req.reason}</td>
      <td id="status-${req.id}">${req.status}</td>
      <td>
        ${req.status === 'pending' ? `
          <button onclick="approveRequest('${req.id}')">Approve</button>
          <button onclick="rejectRequest('${req.id}')">Reject</button>
        ` : ''}
      </td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('timeoff-table').innerHTML = html;
}
window.approveRequest = async function(id) {
  const reviewed_at = new Date().toISOString();
  const { error } = await supabase.from('time_off_requests').update({ status: 'approved', reviewed_at }).eq('id', id);
  if (error) alert('Approval failed: ' + error.message);
  else { alert('Request approved'); loadTimeOffRequests(); }
};
window.rejectRequest = async function(id) {
  const reviewed_at = new Date().toISOString();
  const { error } = await supabase.from('time_off_requests').update({ status: 'rejected', reviewed_at }).eq('id', id);
  if (error) alert('Rejection failed: ' + error.message);
  else { alert('Request rejected'); loadTimeOffRequests(); }
};

// Load initial section and set tab listeners
showSection('employee-management');
loadEmployees();
document.querySelector('a[onclick*="employee-management"]').addEventListener('click', loadEmployees);
document.querySelector('a[onclick*="timesheet-overview"]').addEventListener('click', loadTimesheets);
document.querySelector('a[onclick*="payroll-summary"]').addEventListener('click', function() {
  loadPayroll();
  loadPayrollCalcSelectors();
  document.getElementById('payroll-calc-result').innerHTML = "";
});
document.querySelector('a[onclick*="edit-entries"]').addEventListener('click', loadEditEntries);
document.querySelector('a[onclick*="timeoff-approval"]').addEventListener('click', loadTimeOffRequests); 