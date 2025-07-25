import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://hbmuqmmodxcbzfaiajdu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXVxbW1vZHhjYnpmYWlhamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MTUsImV4cCI6MjA2Njk5MTcxNX0.U0H1bJpgst-z1ewOYwg6rGi6u653uXHbbyz-XGO5EvU"
);

const entryList = document.getElementById("time-entry-list");
const template = document.getElementById("entry-template");

async function loadEntries() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    entryList.innerHTML = "<p>You must be logged in.</p>";
    return;
  }

  const { data: entries, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("clock_in", { ascending: false });

  if (error) {
    entryList.innerHTML = `<p>Error loading entries: ${error.message}</p>`;
    return;
  }

  entryList.innerHTML = "";
  entries.forEach((entry) => renderEntry(entry));
}

function renderEntry(entry) {
  const node = template.content.cloneNode(true);
  const container = node.querySelector(".entry");
  container.dataset.entryId = entry.id;

  container.querySelector(".employee-name").textContent = entry.user_id;
  container.querySelector(".clock-in-display").textContent =
    entry.clock_in?.slice(0, 16).replace("T", " ") || "-";
  container.querySelector(".clock-out-display").textContent =
    entry.clock_out?.slice(0, 16).replace("T", " ") || "-";

  const editBtn = container.querySelector(".edit-btn");
  const saveBtn = container.querySelector(".save-btn");
  const cancelBtn = container.querySelector(".cancel-btn");
  const editForm = container.querySelector(".edit-form");
  const clockInInput = container.querySelector(".edit-clock-in");
  const clockOutInput = container.querySelector(".edit-clock-out");
  const message = container.querySelector(".edit-message");

  editBtn.addEventListener("click", () => {
    editForm.style.display = "block";
    clockInInput.value = entry.clock_in?.slice(0, 16) || "";
    clockOutInput.value = entry.clock_out?.slice(0, 16) || "";
  });

  cancelBtn.addEventListener("click", () => {
    editForm.style.display = "none";
    message.textContent = "";
  });

  saveBtn.addEventListener("click", async () => {
    const clockInLocal = clockInInput.value;
    const clockOutLocal = clockOutInput.value;

    // Append ":00Z" to treat as UTC correctly
    const clockIn = new Date(clockInLocal + ":00Z");
    const clockOut = new Date(clockOutLocal + ":00Z");

    if (isNaN(clockIn) || isNaN(clockOut)) {
      message.textContent = "Please enter valid date/time values.";
      return;
    }

    if (clockOut <= clockIn) {
      message.textContent = "Clock-out must be after clock-in.";
      return;
    }

    const totalHours = (clockOut - clockIn) / 1000 / 60 / 60;

    const { error } = await supabase
      .from("time_entries")
      .update({
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        total_hours: totalHours,
      })
      .eq("id", entry.id);

    if (error) {
      message.textContent = "Update failed: " + error.message;
    } else {
      message.textContent = "Update successful!";
      loadEntries(); // reload list
    }
  });

  entryList.appendChild(container);
}

loadEntries();
