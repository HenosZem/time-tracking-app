import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase credentials
const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== SIGNUP ONLY ==========
const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      alert("Signup error: " + signupError.message);
    } else {
      alert("Signup successful! Please check your email to confirm your account before logging in.");
    }
  });
}


// ========== LOGIN with role redirect ==========
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
    if (loginError.message.toLowerCase().includes("email not confirmed")) {
      alert("Your email has not been confirmed yet. Please confirm it via the link in your email, then try again.");
    } else {
      alert("Login error: " + loginError.message);
    }
    return;
  }

    const userId = loginData.user.id;
    const emailFromUser = loginData.user.email;

    // Try to get profile
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    // If profile doesn't exist, create a minimal one
    if (profileError && profileError.code === "PGRST116") {
      const { error: insertError } = await supabase.from("profiles").insert([
        {
          user_id: userId,
          name: emailFromUser  // fallback until manager fills in real name
        }
      ]);

      if (insertError) {
        alert("Login succeeded but profile creation failed: " + insertError.message);
        return;
      }

      // Re-fetch profile
      const res = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

      profile = res.data;
    }

    if (!profile) {
      alert("Could not retrieve or create user profile.");
      return;
    }

    const role = profile.role;

    if (!role) {
      alert("Your role has not been assigned yet. Please wait for a manager.");
    } else if (role === "employee") {
      window.location.href = "employee-dashboard.html";
    } else if (role === "manager") {
      window.location.href = "manager-dashboard.html";
    } else {
      alert("Unknown role. Please contact support.");
    }
  });
}


// ========== TIME TRACKING ==========
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      displayMessage("Please login first.");
      return;
    }

    const { data: entry, error } = await supabase
      .from("time_entries")
      .select("id, clock_in")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .maybeSingle();

    if (error) {
      displayMessage("Error retrieving entry: " + error.message);
      return;
    }

    if (!entry) {
      displayMessage("No active clock-in found.");
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
      displayMessage(`Clock out successful. Total hours: ${totalHours.toFixed(2)}`);
    }
  });
}
