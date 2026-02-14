// Hospital detail page logic

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSelectedHospital() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  try {
    const raw = localStorage.getItem("carefinder_selected_hospital");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (id && parsed && parsed.id && parsed.id !== id) return parsed; // fallback
    return parsed;
  } catch {
    return null;
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function initMapForHospital(h) {
  if (!window.L || !h || !Number.isFinite(h.lat) || !Number.isFinite(h.lon)) return;
  const map = L.map("hospitalMap", { zoomControl: true }).setView([h.lat, h.lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  L.marker([h.lat, h.lon], { title: h.name || "Hospital" }).addTo(map);
}

function buildBedTable(h) {
  const wrap = document.getElementById("bedTableWrapper");
  if (!wrap) return;
  const cats = Array.isArray(h.bedCategories) ? h.bedCategories : [];
  if (!cats.length) {
    wrap.innerHTML =
      '<p class="text-[11px] text-slate-600">Detailed bed categories are not available for this hospital in the demo.</p>';
    return;
  }

  const rows = cats
    .map((cat) => {
      const price = Number(cat.price || 0);
      const priceText =
        price && price.toLocaleString ? price.toLocaleString("en-IN") : String(price || "—");
      return `
        <tr class="border-b border-slate-100 last:border-0">
          <td class="px-2 py-2 align-top">
            <div class="text-xs font-medium text-slate-900">${escapeHtml(cat.label)}</div>
            <div class="mt-0.5 text-[10px] text-slate-500">${escapeHtml(cat.description || "")}</div>
          </td>
          <td class="px-2 py-2 align-top text-xs">${cat.available ?? 0}</td>
          <td class="px-2 py-2 align-top text-xs">${cat.capacity ?? 0}</td>
          <td class="px-2 py-2 align-top text-xs">₹${priceText} / night</td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="px-2 py-1 text-left font-medium">Category</th>
            <th class="px-2 py-1 text-left font-medium">Available</th>
            <th class="px-2 py-1 text-left font-medium">Total</th>
            <th class="px-2 py-1 text-left font-medium">Indicative price</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p class="mt-2 text-[10px] text-slate-500">
        Pricing is indicative for demo purposes. Actual tariffs depend on your hospital&apos;s billing policy and may vary by ward.
      </p>
    </div>
  `;
}

function buildFacilities(h) {
  const el = document.getElementById("hospitalFacilities");
  if (!el) return;
  const items = [];
  items.push({
    label: "Emergency & triage",
    text: "24x7 emergency department with triage, resuscitation, and trauma bays (demo)."
  });
  items.push({
    label: "Critical care",
    text: "ICU / HDU / NICU capacity derived from bed categories for this hospital."
  });
  items.push({
    label: "Diagnostics",
    text: "Radiology, pathology, and imaging facilities are assumed for teaching hospitals; configure per site."
  });
  items.push({
    label: "Ward services",
    text: "General ward, semi‑private and private rooms for short and long‑stay admissions."
  });

  el.innerHTML = items
    .map(
      (it) => `
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="flex items-center gap-2 text-[11px] font-semibold text-slate-900">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>${escapeHtml(it.label)}</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-600">${escapeHtml(it.text)}</p>
      </div>
    `
    )
    .join("");
}

// Medical tests and facilities with pricing (demo - varies by hospital id)
const MEDICAL_TESTS = [
  { name: "Complete Blood Count (CBC)", price: 350, img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=400&q=80" },
  { name: "Lipid Profile", price: 550, img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=400&q=80" },
  { name: "Thyroid Function Test (T3, T4, TSH)", price: 650, img: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=400&q=80" },
  { name: "Blood Sugar (Fasting & PP)", price: 200, img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=400&q=80" },
  { name: "X-Ray (Chest)", price: 450, img: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80" },
  { name: "Ultrasound (Abdomen)", price: 900, img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=400&q=80" },
  { name: "ECG", price: 350, img: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=400&q=80" },
  { name: "MRI (single region)", price: 4500, img: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80" },
  { name: "CT Scan (single region)", price: 2800, img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=400&q=80" },
  { name: "Liver Function Test", price: 500, img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=400&q=80" },
  { name: "Kidney Function Test", price: 480, img: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=400&q=80" },
  { name: "ECG Stress Test", price: 1200, img: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80" }
];

const MEDICAL_FACILITIES = [
  { name: "24x7 Emergency", price: null, img: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=400&q=80" },
  { name: "Intensive Care Unit (ICU)", price: null, img: "https://images.unsplash.com/photo-1584466977773-e625c37cdd50?auto=format&fit=crop&w=400&q=80" },
  { name: "Radiology & Imaging", price: null, img: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80" },
  { name: "Pathology Lab", price: null, img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=400&q=80" },
  { name: "Operation Theatre", price: null, img: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=400&q=80" },
  { name: "Pharmacy", price: null, img: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=400&q=80" }
];

function mulberry32(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMedicalTestsAndFacilities(h) {
  const wrap = document.getElementById("medicalTestsWrapper");
  if (!wrap) return;

  const numeric = Number(String(h.id || "").replace(/[^\d]/g, "")) || 123456;
  const rand = mulberry32(numeric);

  const numTests = 4 + Math.floor(rand() * 5);
  const selectedTests = [];
  const used = new Set();
  while (selectedTests.length < Math.min(numTests, MEDICAL_TESTS.length)) {
    const idx = Math.floor(rand() * MEDICAL_TESTS.length);
    if (!used.has(idx)) {
      used.add(idx);
      const t = MEDICAL_TESTS[idx];
      const surge = 0.85 + rand() * 0.3;
      selectedTests.push({ ...t, price: Math.round(t.price * surge) });
    }
  }

  const numFacilities = 3 + Math.floor(rand() * 3);
  const selectedFacilities = [];
  const usedF = new Set();
  while (selectedFacilities.length < Math.min(numFacilities, MEDICAL_FACILITIES.length)) {
    const idx = Math.floor(rand() * MEDICAL_FACILITIES.length);
    if (!usedF.has(idx)) {
      usedF.add(idx);
      selectedFacilities.push(MEDICAL_FACILITIES[idx]);
    }
  }

  const testCards = selectedTests
    .map(
      (t) => `
    <div class="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div class="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
        <img src="${escapeHtml(t.img)}" alt="" class="h-full w-full object-cover" loading="lazy" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-900">${escapeHtml(t.name)}</p>
        <p class="mt-0.5 text-[11px] font-medium text-calm-700">₹${t.price.toLocaleString("en-IN")}</p>
        <button type="button" class="mt-2 rounded-lg bg-calm-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-calm-700" data-book-test="${escapeHtml(t.name)}" data-book-test-fee="${t.price}">Book test</button>
      </div>
    </div>
  `
    )
    .join("");

  const facilityCards = selectedFacilities
    .map(
      (f) => `
    <div class="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div class="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
        <img src="${escapeHtml(f.img)}" alt="" class="h-full w-full object-cover" loading="lazy" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-900">${escapeHtml(f.name)}</p>
        <p class="mt-0.5 text-[11px] text-slate-600">Available at this hospital</p>
      </div>
    </div>
  `
    )
    .join("");

  wrap.innerHTML = `
    <div class="sm:col-span-2">
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Diagnostic tests (indicative pricing)</p>
      <div class="grid gap-2 sm:grid-cols-2" id="medicalTestsGrid">${testCards}</div>
    </div>
    <div class="sm:col-span-2">
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Medical facilities</p>
      <div class="grid gap-2 sm:grid-cols-2">${facilityCards}</div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("yearSpanHospital");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();

  const h = getSelectedHospital();
  currentHospital = h;
  if (!h) {
    setText("hospitalName", "Hospital not found");
    setText(
      "hospitalTagline",
      "We could not find a cached hospital profile. Please return to the hospital finder and open details again."
    );
    return;
  }

  setText("hospitalName", h.name || "Unnamed hospital");
  setText(
    "hospitalTagline",
    "This profile aggregates demo information. Replace it with your hospital&apos;s verified content in production."
  );

  const meta = document.getElementById("hospitalMeta");
  if (meta) {
    const rating = h.rating ?? 0;
    const reviewCount = h.reviewCount ?? 0;
    meta.innerHTML = `
      <span class="inline-flex items-center gap-1 rounded-full bg-calm-50 px-2.5 py-1 font-medium text-calm-800">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        Demo capacity view
      </span>
      <span class="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
        Beds: ${h.beds?.available ?? 0} / ${h.beds?.capacity ?? 0}
      </span>
      ${rating ? `<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">★ ${rating.toFixed(1)} (${reviewCount} reviews)</span>` : ""}
    `;
  }

  setText("hospitalAddress", h.address || "Address not available");
  const phoneEl = document.getElementById("hospitalPhone");
  if (phoneEl) {
    if (h.phone) {
      phoneEl.innerHTML = `<a href="tel:${escapeHtml(h.phone)}" class="text-calm-700 underline decoration-calm-200 underline-offset-4 hover:decoration-calm-400">${escapeHtml(
        h.phone
      )}</a>`;
    } else {
      phoneEl.textContent = "Not available";
    }
  }

  const webEl = document.getElementById("hospitalWebsite");
  if (webEl) {
    if (h.website) {
      webEl.innerHTML = `<a href="${escapeHtml(
        h.website
      )}" target="_blank" rel="noreferrer" class="text-calm-700 underline decoration-calm-200 underline-offset-4 hover:decoration-calm-400">${escapeHtml(
        h.website
      )}</a>`;
    } else {
      webEl.textContent = "Not available";
    }
  }

  setText(
    "hospitalCoords",
    Number.isFinite(h.lat) && Number.isFinite(h.lon)
      ? `${h.lat.toFixed(5)}, ${h.lon.toFixed(5)}`
      : "—"
  );

  const osmEl = document.getElementById("hospitalOsm");
  if (osmEl) {
    if (h.osmUrl) {
      osmEl.innerHTML = `<a href="${escapeHtml(
        h.osmUrl
      )}" target="_blank" rel="noreferrer" class="text-calm-700 underline decoration-calm-200 underline-offset-4 hover:decoration-calm-400">View on OpenStreetMap</a>`;
    } else {
      osmEl.textContent = "Not available";
    }
  }

  // Live OSM map images for hospital location (India) - from OpenStreetMap tiles
  function getOsmTileUrl(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  const photoMain = document.getElementById("photoMain");
  const photoSecondary = document.getElementById("photoSecondary");
  const photoTertiary = document.getElementById("photoTertiary");
  if (Number.isFinite(h.lat) && Number.isFinite(h.lon)) {
    if (photoMain) {
      photoMain.style.backgroundImage = `url('${getOsmTileUrl(h.lat, h.lon, 16)}')`;
      photoMain.title = "Live map view of hospital location (OpenStreetMap)";
    }
    if (photoSecondary) {
      photoSecondary.style.backgroundImage = `url('${getOsmTileUrl(h.lat, h.lon + 0.001, 16)}')`;
    }
    if (photoTertiary) {
      photoTertiary.style.backgroundImage = `url('${getOsmTileUrl(h.lat + 0.001, h.lon, 16)}')`;
    }
  } else {
    const fallbackUrls = [
      "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/7659572/pexels-photo-7659572.jpeg?auto=compress&cs=tinysrgb&w=1200"
    ];
    if (photoMain) photoMain.style.backgroundImage = `url('${fallbackUrls[0]}')`;
    if (photoSecondary) photoSecondary.style.backgroundImage = `url('${fallbackUrls[1]}')`;
    if (photoTertiary) photoTertiary.style.backgroundImage = `url('${fallbackUrls[0]}')`;
  }

  buildFacilities(h);
  buildBedTable(h);
  buildMedicalTestsAndFacilities(h);
  buildDoctorsSection(h);
  initMapForHospital(h);

  document.getElementById("medicalTestsWrapper")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-test]");
    if (btn) {
      openBookModal("test", {
        testName: btn.getAttribute("data-book-test"),
        fee: parseInt(btn.getAttribute("data-book-test-fee") || "0", 10)
      });
    }
  });

  document.getElementById("bookModalClose")?.addEventListener("click", closeBookModal);
  document.getElementById("bookModal")?.addEventListener("click", (e) => {
    if (e.target.id === "bookModal") closeBookModal();
  });
  document.getElementById("bookModalForm")?.addEventListener("submit", submitBookModal);
});

const TIME_SLOTS = (() => {
  const s = [];
  for (let h = 9; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 19 && m > 0) break;
      s.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return s;
})();

let currentHospital = null;
let bookModalState = { type: null, doctorId: null, doctorName: null, testName: null, fee: 0 };

function openBookModal(type, opts) {
  const modal = document.getElementById("bookModal");
  const sub = document.getElementById("bookModalSub");
  const feeEl = document.getElementById("bookModalFee");
  const timeSel = document.getElementById("bookModalTime");
  const dateInp = document.getElementById("bookModalDate");
  const msgEl = document.getElementById("bookModalMsg");
  if (!modal || !currentHospital) return;
  bookModalState = { type, ...opts };
  if (sub) sub.textContent = type === "doctor" ? `${opts.doctorName} • ${currentHospital.name}` : `${opts.testName} • ${currentHospital.name}`;
  if (feeEl) feeEl.textContent = `₹${opts.fee || 0}`;
  if (timeSel) {
    timeSel.innerHTML = TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join("");
  }
  const minDate = new Date().toISOString().slice(0, 10);
  if (dateInp) dateInp.min = minDate;
  if (msgEl) msgEl.textContent = "";
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeBookModal() {
  const modal = document.getElementById("bookModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

async function submitBookModal(e) {
  e.preventDefault();
  const patient = (() => {
    try {
      const p = localStorage.getItem("carefinder_patient");
      return p ? JSON.parse(p) : null;
    } catch { return null; }
  })();
  if (!patient) {
    const msg = document.getElementById("bookModalMsg");
    if (msg) { msg.textContent = "Please log in as a patient first."; msg.className = "text-xs text-rose-600"; }
    setTimeout(() => { window.location.href = "./patient.html?redirect=hospital"; }, 1500);
    return;
  }
  const date = document.getElementById("bookModalDate")?.value;
  const time = document.getElementById("bookModalTime")?.value;
  if (!date || !time) return;
  const btn = document.getElementById("bookModalSubmit");
  if (btn) btn.disabled = true;
  const msgEl = document.getElementById("bookModalMsg");
  try {
    const body = {
      patientId: patient.id,
      type: bookModalState.type,
      doctorId: bookModalState.type === "doctor" ? bookModalState.doctorId : null,
      testName: bookModalState.type === "test" ? bookModalState.testName : null,
      hospitalName: currentHospital.name,
      appointmentDate: date,
      appointmentTime: time,
      fee: bookModalState.fee
    };
    const res = await fetch("http://localhost:4000/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Booking failed");
    const apt = { ...data.appointment, bookedAt: new Date().toISOString() };
    sessionStorage.setItem("carefinder_last_booking", JSON.stringify(apt));
    window.location.href = "./booking-confirmation.html";
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message || "Booking failed"; msgEl.className = "text-xs text-rose-600"; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function buildDoctorsSection(h) {
  const wrap = document.getElementById("doctorsWrapper");
  if (!wrap) return;
  try {
    const res = await fetch("http://localhost:4000/api/doctors");
    const data = await res.json();
    const doctors = data.doctors || [];
    const list = doctors.slice(0, 12);
    wrap.innerHTML = list.length
      ? list
          .map(
            (d) => `
          <div class="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <img src="${escapeHtml(d.img)}" alt="" class="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-slate-900">${escapeHtml(d.name)}</p>
              <p class="text-[11px] text-slate-600">${escapeHtml(d.specialty)} • ${d.experience} yrs</p>
              <p class="text-[11px] font-medium text-calm-700">₹${d.fee}</p>
              <button type="button" class="mt-2 rounded-lg bg-calm-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-calm-700" data-book-doctor-id="${escapeHtml(d.id)}" data-book-doctor-name="${escapeHtml(d.name)}" data-book-doctor-fee="${d.fee}">Book appointment</button>
            </div>
          </div>
        `
          )
          .join("")
      : '<p class="col-span-full text-[11px] text-slate-500">Doctor list not available.</p>';
    wrap.querySelectorAll("[data-book-doctor-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openBookModal("doctor", {
          doctorId: btn.getAttribute("data-book-doctor-id"),
          doctorName: btn.getAttribute("data-book-doctor-name"),
          fee: parseInt(btn.getAttribute("data-book-doctor-fee") || "0", 10)
        });
      });
    });
  } catch (e) {
    wrap.innerHTML = '<p class="col-span-full text-[11px] text-slate-500">Doctor list not available.</p>';
  }
}

