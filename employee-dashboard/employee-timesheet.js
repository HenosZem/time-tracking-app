import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/es6/luxon.min.js";

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function format(iso) {
  return iso
    ? DateTime.fromISO(iso, { zone: "utc" })
        .setZone("America/New_York")
        .toFormat("MMM dd, yyyy, h:mm:ss a")
    : "—";
}

async function loadTimesheet() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (authError || !userId) {
    alert("Please login first.");
    window.location.href = "/login.html";
    return;
  }

  const output = document.getElementById("timesheet-output");

  const { data, error } = await supabase
    .from("time_entries")
    .select("name, clock_in, clock_out, total_hours")
    .eq("user_id", userId)
    .order("clock_in", { ascending: false });

  if (error || !data) {
    output.innerHTML = "<p>Error loading timesheet.</p>";
    console.error("Fetch error:", error);
    return;
  }

  if (data.length === 0) {
    output.innerHTML = "<p>No time entries found.</p>";
    return;
  }

  let html = `
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <thead>
        <tr>
          <th>Name</th>
          <th>Clock In</th>
          <th>Clock Out</th>
          <th>Total Hours</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(entry => {
    html += `
      <tr>
        <td>${entry.name}</td>
        <td>${format(entry.clock_in)}</td>
        <td>${format(entry.clock_out)}</td>
        <td>${entry.total_hours ?? "—"}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  output.innerHTML = html;
}

loadTimesheet();
