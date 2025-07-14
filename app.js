// Replace this with your actual keys
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Signup Logic
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      alert("Signup error: " + error.message);
    } else {
      alert("Signup successful! Please check your email.");
    }
  });
}

// Login Logic
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert("Login error: " + error.message);
    } else {
      alert("Login successful!");
      console.log(data);
    }
  });
}

// Time Tracking Logic
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

    const { data: entries, error } = await supabase
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

    if (!entries) {
      displayMessage("No active clock in found.");
      return;
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(entries.clock_in);
    const totalHours =
      (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        clock_out: clockOutTime.toISOString(),
        total_hours: totalHours,
      })
      .eq("id", entries.id);

    if (updateError) {
      displayMessage("Clock out failed: " + updateError.message);
    } else {
      displayMessage(
        `Clock out successful. Total hours: ${totalHours.toFixed(2)}`
      );
    }
  });
}
