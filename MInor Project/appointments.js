const API = "http://localhost:4000/api";

function getPatient() {
  try {
    const p = localStorage.getItem("carefinder_patient");
    return p ? JSON.parse(p) : null;
  } catch {
    return null;
  }
}

function cardHtml(a, isUpcoming) {
  const typeLabel = a.type === "doctor" ? "Doctor" : "Test";
  const detail = a.type === "doctor" ? (a.doctorName || "—") : (a.testName || "—");
  return `
    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex justify-between gap-2">
        <div>
          <span class="rounded-full ${isUpcoming ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"} px-2 py-0.5 text-xs font-medium">${a.id}</span>
          <p class="mt-2 font-semibold text-slate-900">${a.hospitalName || "Hospital"}</p>
          <p class="text-xs text-slate-600">${typeLabel}: ${detail}</p>
          <p class="mt-1 text-xs text-slate-500">${a.appointmentDate} at ${a.appointmentTime} • ₹${a.fee || 0}</p>
        </div>
      </div>
    </article>
  `;
}

async function load() {
  const patient = getPatient();
  const loginPrompt = document.getElementById("loginPrompt");
  const content = document.getElementById("appointmentsContent");
  if (!patient) {
    loginPrompt.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  loginPrompt.classList.add("hidden");
  content.classList.remove("hidden");
  try {
    const res = await fetch(`${API}/appointments/patient/${patient.id}`);
    const data = await res.json();
    const upcoming = data.upcoming || [];
    const previous = data.previous || [];
    document.getElementById("upcomingList").innerHTML = upcoming.map((a) => cardHtml(a, true)).join("");
    document.getElementById("previousList").innerHTML = previous.map((a) => cardHtml(a, false)).join("");
    document.getElementById("noUpcoming").classList.toggle("hidden", upcoming.length > 0);
    document.getElementById("noPrevious").classList.toggle("hidden", previous.length > 0);
  } catch (e) {
    document.getElementById("upcomingList").innerHTML = '<p class="text-sm text-slate-500">Could not load. Ensure backend is running.</p>';
  }
}

document.addEventListener("DOMContentLoaded", load);
