import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadTimeOffStatus() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  const userId = user?.id;

  const output = document.getElementById("status-output");

  if (!userId || authError) {
    output.innerHTML = "<p>Please log in to view requests.</p>";
    console.error("Auth error:", authError);
    return;
  }

  console.log("Current user ID:", userId); // For debug

  const { data, error } = await supabase
    .from("time_off_requests")
    .select("start_date, end_date, reason, status")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });

  if (error || !data) {
    output.innerHTML = "<p>Error loading time-off requests.</p>";
    console.error("Query error:", error);
    return;
  }

  if (data.length === 0) {
    output.innerHTML = "<p>No time-off requests found.</p>";
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Reason</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(req => {
    html += `
      <tr>
        <td>${req.start_date}</td>
        <td>${req.end_date}</td>
        <td>${req.reason}</td>
        <td>${req.status}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  output.innerHTML = html;
}

// Attach refresh button
document.getElementById("refresh-btn").addEventListener("click", loadTimeOffStatus);

// Initial load
loadTimeOffStatus();
