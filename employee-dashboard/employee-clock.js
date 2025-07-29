import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/es6/luxon.min.js";

const SUPABASE_URL = "https://hbmuqmmodxcbzfaiajdu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatTime = (iso) =>
  DateTime.fromISO(iso, { zone: "utc" })
    .setZone("America/New_York")
    .toFormat("MMM dd, yyyy, h:mm:ss a");

async function init() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  const userId = user?.id;

  if (!userId || authError) {
    alert("Please login first.");
    window.location.href = "/login.html";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("name, hourly_rate, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || profileError) {
    alert("Error loading profile");
    console.error("Profile error:", profileError);
    return;
  }

  const { name: fullName, hourly_rate, email } = profile;

  const clockInBtn = document.createElement("button");
  clockInBtn.textContent = "Clock In";
  clockInBtn.onclick = async () => {
    const { data: existing, error: checkError } = await supabase
      .from("time_entries")
      .select("clock_in")
      .eq("user_id", userId)
      .is("clock_out", null);

    if (checkError) {
      console.error("Clock-in check error:", checkError);
      alert("Failed to check clock-in status.");
      return;
    }

    if (existing.length > 0) {
      alert("Already clocked in.");
      return;
    }

    const now = DateTime.utc().toISO();

    const { error: insertError } = await supabase.from("time_entries").insert({
      user_id: userId,
      name: fullName,
      clock_in: now
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      alert("Failed to clock in.");
      return;
    }

    alert(`Clocked in as ${fullName} at: ${formatTime(now)}`);
  };
  document.body.appendChild(clockInBtn);

  const clockOutBtn = document.createElement("button");
  clockOutBtn.textContent = "Clock Out";
  clockOutBtn.onclick = async () => {
    const { data: entry, error: fetchError } = await supabase
      .from("time_entries")
      .select("clock_in")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !entry) {
      console.error("Fetch error:", fetchError);
      alert("No open clock-in found.");
      return;
    }

    const clockInTime = DateTime.fromISO(entry.clock_in, { zone: "utc" });
    const clockOutTime = DateTime.utc();
    const totalHours = clockOutTime.diff(clockInTime, "hours").hours;

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        clock_out: clockOutTime.toISO(),
        total_hours: totalHours.toFixed(2),
        edited_by: userId
      })
      .eq("user_id", userId)
      .eq("clock_in", entry.clock_in);

    if (updateError) {
      console.error("Update error:", updateError);
      alert("Failed to clock out.");
      return;
    }

    // Update payroll_reports
    const { data: report, error: fetchReportError } = await supabase
      .from("payroll_reports")
      .select("total_hours")
      .eq("user_id", userId)
      .maybeSingle();

    const grossPay = totalHours * hourly_rate;

    if (fetchReportError) {
      console.error("Payroll fetch error:", fetchReportError);
    } else if (report) {
      // Update existing record
      const newTotal = Number(report.total_hours || 0) + totalHours;

      await supabase
        .from("payroll_reports")
        .update({
          total_hours: newTotal,
          gross_pay: newTotal * hourly_rate,
          email: email,
          generated_at: new Date().toISOString()
        })
        .eq("user_id", userId);
    } else {
      // Insert new record
      await supabase.from("payroll_reports").insert({
        user_id: userId,
        email: email,
        total_hours: totalHours,
        gross_pay: grossPay,
        generated_at: new Date().toISOString()
      });
    }

    alert(
      `Clocked out.\nName: ${fullName}\nClock In: ${formatTime(
        entry.clock_in
      )}\nClock Out: ${formatTime(
        clockOutTime.toISO()
      )}\nTotal hours: ${totalHours.toFixed(2)}`
    );
  };
  document.body.appendChild(clockOutBtn);
}

init();
