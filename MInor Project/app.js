/* CareFinder - HMS discovery frontend (no build tools) */

const els = {
  btnMyLocation: document.getElementById("btnMyLocation"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnSearchLocation: document.getElementById("btnSearchLocation"),
  btnRecenter: document.getElementById("btnRecenter"),
  locationInput: document.getElementById("locationInput"),
  suggestions: document.getElementById("suggestions"),
  radius: document.getElementById("radius"),
  minBeds: document.getElementById("minBeds"),
  sortBy: document.getElementById("sortBy"),
  coordPill: document.getElementById("coordPill"),
  coordHint: document.getElementById("coordHint"),
  statusBadge: document.getElementById("statusBadge"),
  resultsMeta: document.getElementById("resultsMeta"),
  cards: document.getElementById("cards"),
  emptyState: document.getElementById("emptyState"),
  hospitalSearch: document.getElementById("hospitalSearch"),
  resultsSkeleton: document.getElementById("resultsSkeleton")
};

const state = {
  center: null, // { lat, lon, label }
  hospitals: [], // raw hospitals fetched
  filtered: [],
  loading: false,
  lastFetchAt: 0
};

const INDIA_BBOX = {
  // Rough bounding box for India (minLon, minLat, maxLon, maxLat)
  // Includes mainland + Andaman & Nicobar + Lakshadweep (approx).
  minLon: 68.0,
  minLat: 6.0,
  maxLon: 97.6,
  maxLat: 37.2
};

// Optional backend configuration for real HMS bed availability.
// Set BACKEND.enabled = true and point endpoint to your API.
const BACKEND = {
  enabled: true,
  endpoint: "http://localhost:4000/api/bed-availability"
};

// Static bed categories (demo)
const BED_CATEGORIES = [
  { code: "general", label: "General Ward", basePrice: 800, description: "Shared ward beds with basic monitoring." },
  { code: "semi_private", label: "Semi‑Private", basePrice: 1500, description: "2–3 sharing room with added privacy." },
  { code: "private", label: "Private Room", basePrice: 2500, description: "Single room with attached washroom." },
  { code: "icu", label: "ICU", basePrice: 4500, description: "Intensive care with 24x7 monitoring." },
  { code: "nicu", label: "NICU/Paediatric ICU", basePrice: 5000, description: "Critical care for newborns and children." },
  { code: "daycare", label: "Daycare/Observation", basePrice: 1200, description: "Short-stay beds for procedures & observation." }
];

// ---------- Utilities ----------

function setStatus(text, kind = "neutral") {
  const base = "rounded-full px-3 py-1 text-xs font-medium";
  const map = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-calm-100 text-calm-900",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-rose-100 text-rose-900",
    busy: "bg-slate-900 text-white"
  };
  els.statusBadge.className = `${base} ${map[kind] ?? map.neutral}`;
  els.statusBadge.textContent = text;
}

function setButtonsEnabled(enabled) {
  els.btnRefresh.disabled = !enabled;
  els.btnRecenter.disabled = !enabled;
}

function setResultsLoading(isLoading) {
  if (els.resultsSkeleton) {
    els.resultsSkeleton.classList.toggle("hidden", !isLoading);
  }
  if (els.cards) {
    els.cards.classList.toggle("opacity-40", isLoading);
  }
  if (els.hospitalSearch) {
    els.hospitalSearch.disabled = isLoading;
  }
  [els.radius, els.minBeds, els.sortBy].forEach((el) => {
    if (el) el.disabled = isLoading;
  });
}

function fmtCoord({ lat, lon }) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function isWithinIndiaBBox({ lat, lon }) {
  return (
    lon >= INDIA_BBOX.minLon &&
    lon <= INDIA_BBOX.maxLon &&
    lat >= INDIA_BBOX.minLat &&
    lat <= INDIA_BBOX.maxLat
  );
}

function mulberry32(seed) {
  // deterministic-ish PRNG (for stable demo bed counts per hospital id)
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function demoBedAvailability(osmId) {
  // Replace this function with real bed availability from your HMS backend.
  const numeric = Number(String(osmId || "").replace(/[^\d]/g, "")) || 123456;
  const rand = mulberry32(numeric);
  const capacity = Math.max(10, Math.floor(rand() * 220) + 20); // 20..240
  const available = Math.max(0, Math.min(capacity, Math.floor(rand() * (capacity * 0.45))));
  const icu = Math.max(0, Math.min(25, Math.floor(rand() * 18)));
  const emergency = rand() > 0.2;
  return { capacity, available, icu, emergency };
}

function badgeForBeds(available) {
  if (available <= 0) return { text: "No beds", cls: "bg-rose-100 text-rose-900" };
  if (available <= 4) return { text: "Limited", cls: "bg-amber-100 text-amber-900" };
  return { text: "Available", cls: "bg-calm-100 text-calm-900" };
}

// Generate OSM tile URL for map-based thumbnail (zoom 16, single tile, performance-optimized)
function getMapThumbnailUrl(lat, lon) {
  const z = 16;
  const n = Math.pow(2, z);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function buildBedCategoriesForHospital(h, beds) {
  const seed = Number(String(h.id || "").replace(/[^\d]/g, "")) || 98765;
  const rand = mulberry32(seed);
  const totalCapacity = Math.max(beds.capacity || 0, 20);
  const caps = [];
  let remaining = totalCapacity;
  BED_CATEGORIES.forEach((cat, idx) => {
    if (idx === BED_CATEGORIES.length - 1) {
      caps.push(remaining);
    } else {
      const share = 0.1 + rand() * 0.25; // between 10% and 35%
      const cap = Math.max(0, Math.floor(totalCapacity * share));
      caps.push(cap);
      remaining -= cap;
    }
  });

  return BED_CATEGORIES.map((cat, idx) => {
    const cap = Math.max(0, caps[idx]);
    const availFraction = 0.1 + rand() * 0.5; // 10%–60% of that category
    const available = Math.min(cap, Math.floor(cap * availFraction));
    const surgeFactor = 0.9 + rand() * 0.8; // 0.9–1.7
    const price = Math.round(cat.basePrice * surgeFactor);
    return {
      code: cat.code,
      label: cat.label,
      description: cat.description,
      capacity: cap,
      available,
      price
    };
  });
}

async function loadBedAvailabilityForHospitals(hospitals) {
  // If backend integration is disabled, use demo availability.
  if (!BACKEND.enabled) {
    return hospitals.map((h) => {
      const beds = demoBedAvailability(h.id);
      const bedCategories = buildBedCategoriesForHospital(h, beds);
      return { ...h, beds, bedCategories };
    });
  }

  try {
    const payload = {
      hospitals: hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon
      }))
    };

    const res = await fetch(BACKEND.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Backend bed API error: ${res.status}`);
    }

    const body = await res.json();
    const mapObj = body.bedsById || body.beds || {};

    const fromArray = Array.isArray(mapObj)
      ? (id) => mapObj.find((x) => x.id === id) || null
      : null;

    return hospitals.map((h) => {
      const info = fromArray ? fromArray(h.id) : mapObj[h.id];
      if (info && typeof info.available === "number" && typeof info.capacity === "number") {
        const beds = {
          capacity: info.capacity,
          available: info.available,
          icu: typeof info.icu === "number" ? info.icu : 0,
          emergency: Boolean(info.emergency)
        };
        return {
          ...h,
          beds,
          bedCategories: buildBedCategoriesForHospital(h, beds)
        };
      }
      // Fallback per-hospital if backend doesn't know this ID.
      const beds = demoBedAvailability(h.id);
      return {
        ...h,
        beds,
        bedCategories: buildBedCategoriesForHospital(h, beds)
      };
    });
  } catch (e) {
    console.error(e);
    // Fallback to demo for all hospitals on any backend error.
    return hospitals.map((h) => {
      const beds = demoBedAvailability(h.id);
      const bedCategories = buildBedCategoriesForHospital(h, beds);
      return { ...h, beds, bedCategories };
    });
  }
}

// ---------- Map ----------

let map = null;
let centerMarker = null;
let markersLayer = null;

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([20.5937, 78.9629], 5); // India-ish default
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function setCenterOnMap(center) {
  const ll = [center.lat, center.lon];
  if (!centerMarker) {
    centerMarker = L.marker(ll, { title: "Search center" }).addTo(map);
  } else {
    centerMarker.setLatLng(ll);
  }
  map.setView(ll, 14, { animate: true });
}

function renderMarkers(hospitals) {
  markersLayer.clearLayers();
  for (const h of hospitals) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lon)) continue;
    const b = badgeForBeds(h.beds.available);
    const popup = `
      <div style="min-width:220px">
        <div style="font-weight:700; margin-bottom:4px">${escapeHtml(h.name)}</div>
        <div style="font-size:12px; color:#334155">Distance: ${h.distanceKm.toFixed(2)} km</div>
        <div style="font-size:12px; color:#334155">Beds: <b>${h.beds.available}</b> / ${h.beds.capacity}</div>
        <div style="margin-top:6px; font-size:12px; color:#0f172a">
          <span style="display:inline-block; padding:2px 8px; border-radius:999px; background:#f1f5f9">${escapeHtml(
            b.text
          )}</span>
        </div>
      </div>
    `;
    L.circleMarker([h.lat, h.lon], {
      radius: 7,
      color: "#247b83",
      weight: 2,
      fillColor: "#4db8c0",
      fillOpacity: 0.5
    })
      .addTo(markersLayer)
      .bindPopup(popup);
  }
}

// ---------- Data fetching ----------

async function fetchNearbyHospitals({ lat, lon, radiusMeters }) {
  // Overpass query: nodes/ways/relations with amenity=hospital within radius
  // Docs: https://overpass-api.de/
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
    );
    out center tags;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: query }).toString()
  });
  if (!res.ok) {
    throw new Error(`Overpass error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const elements = Array.isArray(json.elements) ? json.elements : [];

  const hospitals = elements
    .map((el) => {
      const name = el.tags?.name || "Unnamed hospital";
      const isNode = el.type === "node";
      const hLat = isNode ? el.lat : el.center?.lat;
      const hLon = isNode ? el.lon : el.center?.lon;
      const id = `${el.type}/${el.id}`;

      const addrParts = [
        el.tags?.["addr:housenumber"],
        el.tags?.["addr:street"],
        el.tags?.["addr:suburb"],
        el.tags?.["addr:city"],
        el.tags?.["addr:state"],
        el.tags?.["addr:postcode"]
      ].filter(Boolean);

      const phone = el.tags?.phone || el.tags?.["contact:phone"] || null;
      const website = el.tags?.website || el.tags?.["contact:website"] || null;

      if (!Number.isFinite(hLat) || !Number.isFinite(hLon)) return null;
      return {
        id,
        osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        name,
        lat: hLat,
        lon: hLon,
        address: addrParts.join(", "),
        phone,
        website
      };
    })
    .filter(Boolean);

  // de-dup by name + approx coordinate
  const seen = new Set();
  const deduped = [];
  for (const h of hospitals) {
    const k = `${h.name.toLowerCase()}|${h.lat.toFixed(5)}|${h.lon.toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(h);
  }
  return deduped;
}

async function geocodeNominatim(q) {
  // Minimal Nominatim search for user location selection.
  // Usage policy: https://operations.osmfoundation.org/policies/nominatim/
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "in"); // India only
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", navigator.language || "en");

  const res = await fetch(url.toString(), {
    headers: {
      // Some environments require a UA; browsers set it automatically.
      "Accept": "application/json"
    }
  });
  if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json) ? json : [];
  // extra guard: keep only India results (sometimes mis-tagged)
  return items.filter((it) => (it.address?.country_code || "").toLowerCase() === "in");
}

async function reverseGeocodeNominatim({ lat, lon }) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", navigator.language || "en");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Reverse geocoding error: ${res.status}`);
  return await res.json();
}

// ---------- Rendering ----------

function renderCards(hospitals) {
  els.cards.innerHTML = "";
  els.emptyState.classList.toggle("hidden", hospitals.length !== 0);

  for (const h of hospitals) {
    const b = h.beds;
    const badge = badgeForBeds(b.available);
    const emergencyChip = b.emergency
      ? `<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">Emergency</span>`
      : `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">No ER info</span>`;
    const icuChip = `<span class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-900">ICU: ${b.icu}</span>`;

    const addr = h.address ? escapeHtml(h.address) : "Address not available";
    const phone = h.phone ? escapeHtml(h.phone) : null;
    const website = h.website ? escapeHtml(h.website) : null;

    const thumbnailUrl = getMapThumbnailUrl(h.lat, h.lon);

    const card = document.createElement("article");
    card.className =
      "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-soft";
    card.innerHTML = `
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex gap-4 min-w-0 flex-1">
          <div class="shrink-0">
            <img
              src="${escapeHtml(thumbnailUrl)}"
              alt="Map location of ${escapeHtml(h.name)}"
              loading="lazy"
              decoding="async"
              class="h-20 w-28 rounded-xl object-cover ring-1 ring-slate-100 sm:h-24 sm:w-32"
              width="128"
              height="96"
            />
          </div>
          <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="truncate text-base font-semibold text-slate-900">${escapeHtml(h.name)}</h3>
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}">${escapeHtml(badge.text)}</span>
          </div>
          <div class="mt-1 text-sm text-slate-600">
            <span class="font-medium text-slate-800">${h.distanceKm.toFixed(2)} km</span> away
          </div>
          <div class="mt-2 text-sm text-slate-700">${addr}</div>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          ${emergencyChip}
          ${icuChip}
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-calm-50 p-3">
          <div class="text-xs font-medium text-slate-600">Available beds</div>
          <div class="mt-1 text-xl font-semibold text-calm-900">${b.available}</div>
        </div>
        <div class="rounded-xl bg-slate-50 p-3">
          <div class="text-xs font-medium text-slate-600">Capacity (demo)</div>
          <div class="mt-1 text-xl font-semibold text-slate-900">${b.capacity}</div>
        </div>
        <div class="rounded-xl bg-slate-50 p-3">
          <div class="text-xs font-medium text-slate-600">Coordinates</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${h.lat.toFixed(5)}, ${h.lon.toFixed(
      5
    )}</div>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3 text-sm">
          ${
            phone
              ? `<a class="text-slate-700 underline decoration-slate-200 underline-offset-4 hover:decoration-slate-400" href="tel:${phone}">Call: ${phone}</a>`
              : `<span class="text-slate-400">No phone listed</span>`
          }
          ${
            website
              ? `<a class="text-slate-700 underline decoration-slate-200 underline-offset-4 hover:decoration-slate-400" href="${website}" target="_blank" rel="noreferrer">Website</a>`
              : `<span class="text-slate-400">No website listed</span>`
          }
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btnFocus inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            data-focus="${escapeHtml(h.id)}"
          >
            Focus on map
          </button>
          <a
            class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            href="${escapeHtml(h.osmUrl)}"
            target="_blank"
            rel="noreferrer"
          >
            Open in OSM
          </a>
        </div>
      </div>
      <div class="mt-3">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-calm-100 bg-calm-50 px-3 py-2 text-xs font-semibold text-calm-900 shadow-sm transition hover:bg-calm-100 focus:outline-none focus:ring-2 focus:ring-calm-100"
          data-hospital-detail="${escapeHtml(h.id)}"
        >
          View hospital details
        </button>
      </div>
    `;
    els.cards.appendChild(card);
  }

  // bind focus handlers after render
  document.querySelectorAll("[data-focus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-focus");
      const h = state.filtered.find((x) => x.id === id);
      if (!h) return;
      map.setView([h.lat, h.lon], 16, { animate: true });
    });
  });
  // bind detail page navigation
  document.querySelectorAll("[data-hospital-detail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hospital-detail");
      const h = state.filtered.find((x) => x.id === id);
      if (!h) return;
      try {
        localStorage.setItem("carefinder_selected_hospital", JSON.stringify(h));
      } catch (e) {
        console.error("Failed to persist selected hospital", e);
      }
      window.location.href = `hospital.html?id=${encodeURIComponent(id)}`;
    });
  });
}

function applyFiltersAndRender() {
  const minBeds = Number(els.minBeds.value || 0);
  const sortBy = els.sortBy.value;
  const q = (els.hospitalSearch.value || "").trim().toLowerCase();

  let items = state.hospitals.slice();

  if (q) items = items.filter((h) => h.name.toLowerCase().includes(q));
  items = items.filter((h) => h.beds.available >= minBeds);

  if (sortBy === "beds") {
    items.sort((a, b) => b.beds.available - a.beds.available || a.distanceKm - b.distanceKm);
  } else if (sortBy === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    items.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  state.filtered = items;
  renderCards(items);
  renderMarkers(items);

  if (!state.center) {
    els.resultsMeta.textContent = "No search yet.";
  } else {
    els.resultsMeta.textContent = `${items.length} shown • ${state.hospitals.length} found • radius ${(
      Number(els.radius.value) / 1000
    ).toFixed(0)} km`;
  }
}

// ---------- Location selection ----------

function setCenter(center) {
  state.center = center;
  els.coordPill.textContent = fmtCoord(center);
  els.coordHint.textContent = center.label ? center.label : "Selected location";
  setButtonsEnabled(true);
  setCenterOnMap(center);
}

async function useMyLocation() {
  setStatus("Requesting location…", "busy");
  els.btnMyLocation.disabled = true;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10_000
      });
    });

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const center = { lat, lon };

    // India-only enforcement (fast check first, then confirm with reverse geocode)
    if (!isWithinIndiaBBox(center)) {
      setStatus("Outside India (not supported)", "warn");
      els.coordHint.textContent = "This demo is tailored for India only. Search an Indian city/area.";
      return;
    }

    setStatus("Verifying India location…", "busy");
    const rev = await reverseGeocodeNominatim(center);
    const cc = (rev?.address?.country_code || "").toLowerCase();
    if (cc !== "in") {
      setStatus("Outside India (not supported)", "warn");
      els.coordHint.textContent = "This demo is tailored for India only. Search an Indian city/area.";
      return;
    }

    setCenter({ lat, lon, label: "Current location (India)" });
    await refreshHospitals();
    setStatus("Showing nearby hospitals", "good");
  } catch (e) {
    console.error(e);
    setStatus("Location permission denied", "warn");
    els.coordHint.textContent = "You can still search by typing an Indian city/area.";
  } finally {
    els.btnMyLocation.disabled = false;
  }
}

function showSuggestions(items) {
  if (!items.length) {
    els.suggestions.classList.add("hidden");
    els.suggestions.innerHTML = "";
    return;
  }
  els.suggestions.innerHTML = items
    .map((it, idx) => {
      const label = it.display_name || "Suggestion";
      return `
        <button
          type="button"
          class="w-full px-4 py-3 text-left text-sm hover:bg-calm-50 focus:bg-calm-50 focus:outline-none"
          role="option"
          data-idx="${idx}"
        >
          <div class="font-medium text-slate-900">${escapeHtml(label)}</div>
          <div class="mt-0.5 text-xs text-slate-500">${escapeHtml(it.type || "")}</div>
        </button>
      `;
    })
    .join("");
  els.suggestions.classList.remove("hidden");

  els.suggestions.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const it = items[idx];
      els.suggestions.classList.add("hidden");
      els.locationInput.value = it.display_name || "";
      const lat = Number(it.lat);
      const lon = Number(it.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      setCenter({ lat, lon, label: it.display_name || "Selected location" });
      refreshHospitals().catch((e) => console.error(e));
    });
  });
}

const suggestLocations = debounce(async () => {
  const q = (els.locationInput.value || "").trim();
  if (q.length < 3) {
    showSuggestions([]);
    return;
  }
  try {
    const items = await geocodeNominatim(q);
    showSuggestions(items);
  } catch (e) {
    console.error(e);
    showSuggestions([]);
  }
}, 350);

async function searchLocation() {
  const q = (els.locationInput.value || "").trim();
  if (!q) return;
  setStatus("Searching location…", "busy");
  try {
    const items = await geocodeNominatim(q);
    if (!items.length) {
      setStatus("No matches in India", "warn");
      return;
    }
    const it = items[0];
    const lat = Number(it.lat);
    const lon = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setStatus("Invalid location result", "bad");
      return;
    }
    if (!isWithinIndiaBBox({ lat, lon })) {
      setStatus("Outside India (not supported)", "warn");
      return;
    }
    setCenter({ lat, lon, label: it.display_name || q });
    await refreshHospitals();
    setStatus("Showing nearby hospitals", "good");
  } catch (e) {
    console.error(e);
    setStatus("Location search failed", "bad");
  }
}

// ---------- Main refresh ----------

async function refreshHospitals() {
  if (!state.center) return;

  // simple client-side rate limiting to reduce Overpass load
  const now = Date.now();
  if (now - state.lastFetchAt < 800) return;
  state.lastFetchAt = now;

  setStatus("Loading hospitals…", "busy");
  state.loading = true;
  els.btnRefresh.disabled = true;
  setResultsLoading(true);

  try {
    const radiusMeters = Number(els.radius.value);
    const raw = await fetchNearbyHospitals({
      lat: state.center.lat,
      lon: state.center.lon,
      radiusMeters
    });

    let hospitals = raw.map((h) => ({
      ...h,
      distanceKm: haversineKm(state.center, h)
    }));

    hospitals.sort((a, b) => a.distanceKm - b.distanceKm);
    hospitals = await loadBedAvailabilityForHospitals(hospitals);

    state.hospitals = hospitals;
    applyFiltersAndRender();
    setStatus("Updated", "good");
  } catch (e) {
    console.error(e);
    setStatus("Could not load hospitals", "bad");
    state.hospitals = [];
    applyFiltersAndRender();
  } finally {
    state.loading = false;
    els.btnRefresh.disabled = false;
    setResultsLoading(false);
  }
}

// ---------- Wire up ----------

function wireEvents() {
  els.btnMyLocation.addEventListener("click", () => useMyLocation());
  els.btnRefresh.addEventListener("click", () => refreshHospitals());
  els.btnSearchLocation.addEventListener("click", () => searchLocation());
  els.btnRecenter.addEventListener("click", () => {
    if (!state.center) return;
    setCenterOnMap(state.center);
  });

  els.locationInput.addEventListener("input", suggestLocations);
  els.locationInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.suggestions.classList.add("hidden");
      searchLocation().catch((err) => console.error(err));
    }
    if (e.key === "Escape") {
      els.suggestions.classList.add("hidden");
    }
  });

  document.addEventListener("click", (e) => {
    // close suggestions when clicking outside
    if (!els.suggestions.contains(e.target) && e.target !== els.locationInput) {
      els.suggestions.classList.add("hidden");
    }
  });

  [els.radius, els.minBeds, els.sortBy].forEach((el) => el.addEventListener("change", () => refreshHospitals()));
  els.hospitalSearch.addEventListener(
    "input",
    debounce(() => {
      applyFiltersAndRender();
    }, 150)
  );
}

function boot() {
  initMap();
  wireEvents();
  setStatus("Ready", "neutral");
  setButtonsEnabled(false);
  setResultsLoading(false);

  // Default gentle hint for users:
  els.coordHint.textContent = "Use your location or search a location to begin.";
}

boot();

