import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/es6/luxon.min.js";

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatTime(iso) {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone("America/New_York")
    .toFormat("MMM dd, yyyy, h:mm:ss a");
}

async function loadEarnings() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (authError || !userId) {
    alert("Please login first.");
    window.location.href = "/login.html";
    return;
  }

  const { data, error } = await supabase
    .from("payroll_reports")
    .select("total_hours, gross_pay, generated_at")
    .eq("user_id", userId);

  const output = document.getElementById("earnings-output");

  if (error) {
    output.innerHTML = "<p>Error loading earnings.</p>";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    output.innerHTML = "<p>No earnings available yet.</p>";
    return;
  }

  let html = "<ul>";
  data.forEach(row => {
    html += `<li>Last Updated: ${formatTime(row.generated_at)} — Total Hours: ${row.total_hours} — Gross Pay: $${row.gross_pay}</li>`;
  });
  html += "</ul>";

  output.innerHTML = html;
}

loadEarnings();
