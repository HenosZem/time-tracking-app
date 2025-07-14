//MOCK DATA
const entries = [
  { id: '1', date: '2024-01-15', clockIn: '09:00', clockOut: '17:30', breakMinutes: 60, totalHours: 7.5, employee: 'John', status: 'completed' },
  { id: '2', date: '2024-01-14', clockIn: '08:45', clockOut: '17:15', breakMinutes: 45, totalHours: 7.75, employee: 'John', status: 'completed' },
  { id: '3', date: '2024-01-13', clockIn: '09:15', clockOut: '17:45', breakMinutes: 60, totalHours: 7.5, employee: 'John', status: 'late' },
  { id: '4', date: '2024-01-12', clockIn: '08:30', clockOut: '16:30', breakMinutes: 30, totalHours: 7.5, employee: 'John', status: 'completed' },
  { id: '5', date: '2024-01-11', clockIn: '09:00', clockOut: '18:00', breakMinutes: 60, totalHours: 8, employee: 'John', status: 'completed' },
  { id: '6', date: '2024-01-10', clockIn: '08:45', clockOut: '17:30', breakMinutes: 45, totalHours: 7.75, employee: 'John', status: 'completed' },
];

//Utils
const getToday = () => new Date().toISOString().split('T')[0];

function filterEntries(period, from, to) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return entries.filter(entry => {
    const entryDate = new Date(entry.date);
    if (period === 'custom' && from && to) {
      return entryDate >= new Date(from) && entryDate <= new Date(to);
    }
    switch (period) {
      case 'today':
        return entryDate.toDateString() === today.toDateString();
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return entryDate >= weekStart;
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(today.getDate() - 30);
        return entryDate >= monthStart;
      default:
        return true;
    }
  });
}

function updateDashboard() {
  const period = document.getElementById('period-select').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  const filtered = filterEntries(period, from, to);

  //Stats
  const totalHours = filtered.reduce((sum, e) => sum + e.totalHours, 0);
  const totalDays = filtered.length;
  const avgHours = totalDays ? (totalHours / totalDays).toFixed(1) : 0;
  const completed = filtered.filter(e => e.status === 'completed').length;

  //Summary cards
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

  //Time log interface
  const logBody = document.getElementById('logs-body');
  logBody.innerHTML = '';
  filtered.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span>${entry.date}</span>
      <span>${entry.clockIn}</span>
      <span>${entry.clockOut}</span>
      <span>${entry.breakMinutes}m</span>
      <span>${entry.totalHours}h</span>
      <span><span class="badge ${entry.status}">${entry.status}</span></span>
    `;
    logBody.appendChild(row);
  });

  document.getElementById('logs-subtitle').textContent = `Detailed breakdown of your work hours for ${period}`;
  document.getElementById('entry-count').textContent = `${filtered.length} entries`;
}

//Export logic
document.getElementById('export-btn').addEventListener('click', () => {
  const period = document.getElementById('period-select').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  const filtered = filterEntries(period, from, to);

  const rows = [
    ['Date', 'Clock In', 'Clock Out', 'Break (min)', 'Total Hours', 'Status'],
    ...filtered.map(e => [e.date, e.clockIn, e.clockOut, e.breakMinutes, e.totalHours, e.status])
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `time-logs-${period}-${getToday()}.csv`;
  a.click();
});

document.getElementById('period-select').addEventListener('change', (e) => {
  const show = e.target.value === 'custom';
  document.getElementById('date-from').style.display = show ? 'inline-block' : 'none';
  document.getElementById('date-to').style.display = show ? 'inline-block' : 'none';
  updateDashboard();
});
document.getElementById('date-from').addEventListener('change', updateDashboard);
document.getElementById('date-to').addEventListener('change', updateDashboard);

updateDashboard();