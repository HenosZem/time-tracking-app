// Supabase client setup
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utils
const getToday = () => new Date().toISOString().split("T")[0];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split("T")[0];
}

// Fetch and filter entries from Supabase
async function fetchEntries(period, from, to) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase.from("time_entries").select("*").eq("user_id", user.id);
  const today = new Date();

  if (period === 'custom' && from && to) {
    query = query.gte("clock_in", from).lte("clock_in", to);
  } else if (period === 'today') {
    const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    query = query.gte("clock_in", start).lte("clock_in", end);
  } else if (period === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    query = query.gte("clock_in", weekAgo.toISOString());
  } else if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    query = query.gte("clock_in", monthAgo.toISOString());
  }

  const { data, error } = await query.order("clock_in", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// Dashboard update
async function updateDashboard() {
  const period = document.getElementById('period-select').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  const entries = await fetchEntries(period, from, to);
  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
  const totalDays = entries.length;
  const avgHours = totalDays ? (totalHours / totalDays).toFixed(1) : 0;
  const completed = entries.filter(e => e.clock_out).length;

  // Summary cards
  const container = document.getElementById('summary-cards');
  container.innerHTML = '';
  const cards = [
    { title: 'Total Hours', value: totalHours.toFixed(1), subtitle: `${totalDays} days` },
    { title: 'Average Hours', value: avgHours, subtitle: 'Per day' },
    { title: 'Days Worked', value: totalDays, subtitle: `${completed} completed` },
    { title: 'Attendance', value: `${Math.round((completed / Math.max(1, totalDays)) * 100)}%`, subtitle: `${completed}/${totalDays}` },
  ];
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `<h3>${c.title}</h3><div class="value">${c.value}</div><p>${c.subtitle}</p>`;
    container.appendChild(card);
  });

  // Time log interface
  const logBody = document.getElementById('logs-body');
  logBody.innerHTML = '';
  entries.forEach(entry => {
    const date = formatDate(entry.clock_in);
    const clockIn = entry.clock_in ? formatTime(entry.clock_in) : '';
    const clockOut = entry.clock_out ? formatTime(entry.clock_out) : '';
    const breakMin = entry.break_minutes || 0;
    const hours = entry.total_hours?.toFixed(2) || '';
    const status = entry.clock_out ? 'completed' : 'pending';

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span>${date}</span>
      <span>${clockIn}</span>
      <span>${clockOut}</span>
      <span>${breakMin}m</span>
      <span>${hours}h</span>
      <span><span class="badge ${status}">${status}</span></span>
    `;
    logBody.appendChild(row);
  });

  document.getElementById('logs-subtitle').textContent = `Detailed breakdown of your work hours for ${period}`;
  document.getElementById('entry-count').textContent = `${entries.length} entries`;
}

// Export to CSV
function exportCSV() {
  const period = document.getElementById('period-select').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  fetchEntries(period, from, to).then(entries => {
    const rows = [
      ['Date', 'Clock In', 'Clock Out', 'Break (min)', 'Total Hours', 'Status'],
      ...entries.map(e => [
        formatDate(e.clock_in),
        formatTime(e.clock_in),
        formatTime(e.clock_out),
        e.break_minutes || 0,
        e.total_hours || 0,
        e.clock_out ? 'completed' : 'pending'
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `time-logs-${period}-${getToday()}.csv`;
    a.click();
  });
}

// Event Listeners
document.getElementById('export-btn').addEventListener('click', exportCSV);
document.getElementById('period-select').addEventListener('change', (e) => {
  const show = e.target.value === 'custom';
  document.getElementById('date-from').style.display = show ? 'inline-block' : 'none';
  document.getElementById('date-to').style.display = show ? 'inline-block' : 'none';
  updateDashboard();
});
document.getElementById('date-from').addEventListener('change', updateDashboard);
document.getElementById('date-to').addEventListener('change', updateDashboard);

updateDashboard();
