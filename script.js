const USE_SUPABASE = false;
const SUPABASE_URL = "#";
const SUPABASE_ANON_KEY = "#";
let supabase;

const mockUsers = {
  1: { name: "Alice", hourlyRate: 25 },
  2: { name: "Bob", hourlyRate: 20 },
};

const mockTimeEntries = [
  { userId: 1, date: "2025-07-01", hours: 8 },
  { userId: 1, date: "2025-07-05", hours: 7 },
  { userId: 1, date: "2025-07-17", hours: 6 },
  { userId: 2, date: "2025-07-02", hours: 5 },
  { userId: 2, date: "2025-07-12", hours: 8 },
  { userId: 2, date: "2025-07-20", hours: 7 },
];

const getPayPeriod = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const periodStart = day <= 15 ? 1 : 16;
  const periodEnd = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(periodStart).padStart(2, '0')} to ${year}-${String(month + 1).padStart(2, '0')}-${String(periodEnd).padStart(2, '0')}`;
};

async function loadPayrollData() {
  let users = mockUsers;
  let timeEntries = mockTimeEntries;

  if (USE_SUPABASE) {
    await importSupabaseClient();
    const { data: userData, error: userError } = await supabase.from('users').select();
    const { data: timeData, error: timeError } = await supabase.from('time_entries').select();

    if (userError || timeError) {
      console.error("Error loading data from Supabase:", userError || timeError);
      return;
    }

    users = {};
    userData.forEach(user => {
      users[user.id] = {
        name: user.name,
        hourlyRate: user.hourly_rate
      };
    });

    timeEntries = timeData;
  }

  renderPayroll(users, timeEntries);
}

function renderPayroll(users, timeEntries) {
  const groupedData = {};

  timeEntries.forEach(entry => {
    const user = users[entry.userId];
    const payPeriod = getPayPeriod(entry.date);
    const key = `${entry.userId}_${payPeriod}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        userId: entry.userId,
        name: user.name,
        rate: user.hourlyRate,
        payPeriod: payPeriod,
        totalHours: 0
      };
    }

    groupedData[key].totalHours += entry.hours;
  });

  const container = document.getElementById('summaryContainer');

  Object.values(groupedData).forEach(group => {
    const grossPay = group.totalHours * group.rate;

    const section = document.createElement('div');
    section.className = 'user-section';
    section.innerHTML = `
      <h3>${group.name} — ${group.payPeriod}</h3>
      <table>
        <tr><th>Total Hours</th><td>${group.totalHours}</td></tr>
        <tr><th>Hourly Rate</th><td>$${group.rate.toFixed(2)}</td></tr>
        <tr><th>Gross Pay</th><td>$${grossPay.toFixed(2)}</td></tr>
      </table>
    `;
    container.appendChild(section);
  });

  window.groupedData = groupedData; 
}

function exportCSV() {
  let csv = "Name,Pay Period,Total Hours,Hourly Rate,Gross Pay\n";
  Object.values(window.groupedData).forEach(group => {
    const grossPay = group.totalHours * group.rate;
    csv += `${group.name},${group.payPeriod},${group.totalHours},${group.rate},${grossPay.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payroll_summary.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function importSupabaseClient() {
  if (!window.supabase) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

loadPayrollData();
