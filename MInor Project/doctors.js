const API = "http://localhost:4000/api";

async function fetchDoctors(specialty) {
  const url = specialty
    ? `${API}/doctors?specialty=${encodeURIComponent(specialty)}`
    : `${API}/doctors`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch doctors");
  return res.json();
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderDoctors(data) {
  const grid = document.getElementById("doctorsGrid");
  if (!grid) return;
  const doctors = data.doctors || [];
  grid.innerHTML = doctors
    .map(
      (d) => `
    <article class="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <img src="${escapeHtml(d.img)}" alt="${escapeHtml(d.name)}" class="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" />
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-slate-900">${escapeHtml(d.name)}</h3>
        <p class="text-xs text-slate-600">${escapeHtml(d.specialty)}</p>
        <p class="mt-1 text-[11px] text-slate-500">${d.experience} years exp • ${d.gender}</p>
        <p class="mt-1 text-xs font-medium text-calm-700">₹${d.fee} consultation</p>
        <a href="./book-appointment.html?type=doctor&doctorId=${encodeURIComponent(d.id)}&doctorName=${encodeURIComponent(d.name)}&fee=${d.fee}" class="mt-2 inline-block rounded-lg bg-calm-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-calm-700">Book appointment</a>
      </div>
    </article>
  `
    )
    .join("");
}

async function load() {
  const filter = document.getElementById("filterSpecialty");
  const specialty = filter ? filter.value : "";
  try {
    const data = await fetchDoctors(specialty || undefined);
    renderDoctors(data);
  } catch (e) {
    console.error(e);
    const grid = document.getElementById("doctorsGrid");
    if (grid) grid.innerHTML = '<p class="col-span-full text-sm text-slate-500">Could not load doctors. Ensure backend is running.</p>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  const filter = document.getElementById("filterSpecialty");
  if (filter) filter.addEventListener("change", load);
});
