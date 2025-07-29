import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

console.log("✅ timeoff.js loaded");

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById("timeoff-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const startInput = document.getElementById("start-date").value;
  const endInput = document.getElementById("end-date").value;
  const reason = document.getElementById("reason").value;
  const messageEl = document.getElementById("message");

  if (!startInput || !endInput) {
    messageEl.innerText = "Please select both start and end dates.";
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(startInput);
  const endDate = new Date(endInput);

  if (startDate < today || endDate < today) {
    messageEl.innerText = "Both dates must be in the future.";
    return;
  }

  if (endDate < startDate) {
    messageEl.innerText = "End date must be after start date.";
    return;
  }

  const { data: userData, error: authError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user || authError) {
    messageEl.innerText = "You must be logged in.";
    console.error("Auth error:", authError);
    return;
  }

  const { error: insertError } = await supabase
    .from("time_off_requests")
    .insert([
      {
        user_id: user.id,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        reason,
        status: "pending",
      },
    ]);

  if (insertError) {
    messageEl.innerText = "Error: " + insertError.message;
    console.error("Insert error:", insertError);
  } else {
    messageEl.innerText = "✅ Request submitted successfully!";
    document.getElementById("timeoff-form").reset();
  }
});
