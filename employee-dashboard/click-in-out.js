import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

console.log("clock-in-out.js loaded"); 

// Supabase credentials
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM references
const clockInBtn = document.getElementById("clock-in-btn");
const clockOutBtn = document.getElementById("clock-out-btn");
const messageBox = document.getElementById("message");

function displayMessage(msg) {
  if (messageBox) {
    messageBox.textContent = msg;
  } else {
    alert(msg);
  }
}

if (clockInBtn) {
  clockInBtn.addEventListener("click", async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      displayMessage("Please login first.");
      return;
    }

    const { data: existing, error } = await supabase
      .from("time_entries")
      .select("id")
      .eq("user_id", user.id)
      .is("clock_out", null);

    if (error) {
      displayMessage("Error checking entries: " + error.message);
      return;
    }

    if (existing.length > 0) {
      displayMessage("You are already clocked in.");
      return;
    }

    const { error: insertError } = await supabase.from("time_entries").insert({
      user_id: user.id,
      clock_in: new Date().toISOString(),
    });

    if (insertError) {
      displayMessage("Clock in failed: " + insertError.message);
    } else {
      displayMessage("Clock in successful.");
    }
  });
}

if (clockOutBtn) {
  clockOutBtn.addEventListener("click", async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      displayMessage("Please login first.");
      return;
    }

    const { data: entry, error } = await supabase
      .from("time_entries")
      .select("id, clock_in")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .limit(1)
      .maybeSingle();

    if (error) {
      displayMessage("Error retrieving entry: " + error.message);
      return;
    }

    if (!entry) {
      displayMessage("No active clock in found.");
      return;
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(entry.clock_in);
    const totalHours = (clockOutTime - clockInTime) / (1000 * 60 * 60);

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        clock_out: clockOutTime.toISOString(),
        total_hours: totalHours,
      })
      .eq("id", entry.id);

    if (updateError) {
      displayMessage("Clock out failed: " + updateError.message);
    } else {
      displayMessage(
        `Clocked in: ${clockInTime.toLocaleString()} \nClocked out: ${clockOutTime.toLocaleString()} \nTotal hours: ${totalHours.toFixed(2)}`
      );
    }
  });
}
