console.log("✅ timeoff.js loaded and running");

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabaseClient.auth.getUser().then(({ data: { user } }) => {
  console.log("🔍 Current logged in user:", user);
});

document.getElementById('timeoff-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log("🚀 Form submit clicked");

  const startDate = new Date(document.getElementById('start-date').value);
  const endDate = new Date(document.getElementById('end-date').value);
  const reason = document.getElementById('reason').value;
  const messageEl = document.getElementById('message');

  if (endDate < startDate) {
    messageEl.innerText = 'End date must be after start date.';
    return;
  }

  if (startDate < new Date()) {
    messageEl.innerText = 'Start date must be in the future.';
    return;
  }

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (!user) {
    messageEl.innerText = 'You must be logged in.';
    console.log("🚫 Not logged in");
    return;
  }

  const { error } = await supabaseClient.from('time_off_requests').insert([{
    user_id: user.id,
    start_date: startDate.toISOString().slice(0,10),
    end_date: endDate.toISOString().slice(0,10),
    reason: reason,
    status: 'pending'
  }]);

  if (error) {
    messageEl.innerText = 'Error submitting request: ' + error.message;
    console.error("❌ Insert error:", error);
  } else {
    messageEl.innerText = 'Request submitted successfully!';
    console.log("✅ Request submitted");
    document.getElementById('timeoff-form').reset();
  }
});
