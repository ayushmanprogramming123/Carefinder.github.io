const API_BASE = "http://localhost:4000/api";

const els = {
  requestForm: document.getElementById("requestForm"),
  pickupSummary: document.getElementById("pickupSummary"),
  btnPickupCurrent: document.getElementById("btnPickupCurrent"),
  requestMessage: document.getElementById("requestMessage"),
  btnRequest: document.getElementById("btnRequest"),
  trackStatus: document.getElementById("trackStatus"),
  metaAssignment: document.getElementById("metaAssignment"),
  metaEta: document.getElementById("metaEta"),
  metaPosition: document.getElementById("metaPosition"),
  metaDriver: document.getElementById("metaDriver"),
  metaSpeed: document.getElementById("metaSpeed"),
  dropHospitalName: document.getElementById("dropHospitalName"),
  confirmModal: document.getElementById("confirmModal"),
  confirmBody: document.getElementById("confirmBody"),
  btnConfirmClose: document.getElementById("btnConfirmClose"),
  btnConfirmOk: document.getElementById("btnConfirmOk"),
  nearestHospitalsStatus: document.getElementById("nearestHospitalsStatus"),
  nearestHospitalsList: document.getElementById("nearestHospitalsList"),
  nearestHospitalsBox: document.getElementById("nearestHospitalsBox"),
  ambulanceToast: document.getElementById("ambulanceToast"),
  ambulanceToastTitle: document.getElementById("ambulanceToastTitle"),
  ambulanceToastSub: document.getElementById("ambulanceToastSub"),
  ambulanceToastIcon: document.getElementById("ambulanceToastIcon")
};

let map = null;
let patientMarker = null;
let ambulanceMarker = null;
let dropMarker = null;
let routeLine = null;
let trackTimer = null;
let currentTripId = null;
const state = {
  pickupLocation: null, // { lat, lon }
  dropLocation: null // reserved if you later wire map selection for drop
};

// ---------- Nearest hospitals (live via Overpass) ----------

async function fetchNearbyHospitalsAroundPickup({ lat, lon, radiusMeters }) {
  const query = `
    [out:json][timeout:20];
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
    throw new Error(`Overpass error: ${res.status}`);
  }
  const json = await res.json();
  const elements = Array.isArray(json.elements) ? json.elements : [];

  const hospitals = elements
    .map((el) => {
      const name = el.tags?.name || "Unnamed hospital";
      const isNode = el.type === "node";
      const hLat = isNode ? el.lat : el.center?.lat;
      const hLon = isNode ? el.lon : el.center?.lon;
      if (!Number.isFinite(hLat) || !Number.isFinite(hLon)) return null;
      const distKm = haversineKm({ lat, lon }, { lat: hLat, lon: hLon });
      return {
        id: `${el.type}/${el.id}`,
        name,
        lat: hLat,
        lon: hLon,
        distanceKm: distKm
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return hospitals.slice(0, 5);
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

async function loadNearestHospitalsForPickup() {
  if (!state.pickupLocation || !els.nearestHospitalsStatus || !els.nearestHospitalsList) return;
  const { lat, lon } = state.pickupLocation;

  if (els.nearestHospitalsBox) els.nearestHospitalsBox.classList.remove("hidden");
  els.nearestHospitalsStatus.textContent = "Fetching nearby hospitals…";
  els.nearestHospitalsList.innerHTML = "";

  try {
    const hospitals = await fetchNearbyHospitalsAroundPickup({ lat, lon, radiusMeters: 6000 });
    if (!hospitals.length) {
      els.nearestHospitalsStatus.textContent =
        "No hospitals found within ~6 km of this pickup point.";
      if (els.nearestHospitalsBox) els.nearestHospitalsBox.classList.add("hidden");
      return;
    }
    els.nearestHospitalsStatus.textContent =
      "Tap a hospital below to fill it as the dropping hospital.";
    els.nearestHospitalsList.innerHTML = hospitals
      .map(
        (h) => `<li>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-rose-50"
            data-nearest-hospital="${h.name.replace(/"/g, "&quot;")}"
          >
            <span class="text-left">
              <span class="block text-[13px] font-semibold text-slate-900">${h.name}</span>
              <span class="block text-[11px] text-slate-500">${h.distanceKm.toFixed(2)} km away</span>
            </span>
          </button>
        </li>`
      )
      .join("");

    els.nearestHospitalsList.querySelectorAll("[data-nearest-hospital]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-nearest-hospital");
        if (els.dropHospitalName && name) {
          els.dropHospitalName.value = name;
        }
      });
    });
  } catch (e) {
    console.error(e);
    els.nearestHospitalsStatus.textContent =
      "Could not load nearby hospitals right now. Please try again in a moment.";
  }
}

function setRequestMessage(msg, kind = "info") {
  const base = "mt-1 text-xs";
  const map = {
    info: "text-slate-500",
    success: "text-emerald-600",
    error: "text-rose-600",
    warn: "text-amber-600"
  };
  els.requestMessage.className = `${base} ${map[kind] || map.info}`;
  els.requestMessage.textContent = msg || "";
}

function setTrackStatus(msg, kind = "info") {
  const base = "text-xs";
  const map = {
    info: "text-slate-500",
    success: "text-emerald-600",
    error: "text-rose-600",
    warn: "text-amber-600"
  };
  els.trackStatus.className = `${base} ${map[kind] || map.info}`;
  els.trackStatus.textContent = msg || "";
}

let toastTimeout = null;

function showAmbulanceToast(title, sub, kind = "dispatching") {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (!els.ambulanceToast || !els.ambulanceToastTitle || !els.ambulanceToastSub || !els.ambulanceToastIcon) return;
  els.ambulanceToastTitle.textContent = title;
  els.ambulanceToastSub.textContent = sub || "";
  els.ambulanceToastIcon.className = "grid h-10 w-10 shrink-0 place-items-center rounded-xl ";
  if (kind === "arrived") {
    els.ambulanceToastIcon.classList.add("bg-emerald-50");
    els.ambulanceToastIcon.innerHTML =
      '<svg class="h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10"/></svg>';
  } else if (kind === "on_way") {
    els.ambulanceToastIcon.classList.add("bg-sky-50");
    els.ambulanceToastIcon.innerHTML =
      '<svg class="h-5 w-5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 9a3 3 0 0 1 3-3h7.17a3 3 0 0 1 2.12.88l2.83 2.83" stroke-linecap="round"/><circle cx="8" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg>';
  } else {
    els.ambulanceToastIcon.classList.add("bg-rose-50");
    els.ambulanceToastIcon.innerHTML =
      '<svg class="h-5 w-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 9a3 3 0 0 1 3-3h7.17a3 3 0 0 1 2.12.88l2.83 2.83A3 3 0 0 1 20 12.83V16a2 2 0 0 1-2 2h-1.5" stroke-linecap="round"/><path d="M4 9v7a2 2 0 0 0 2 2h1.5" stroke-linecap="round"/><circle cx="8" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg>';
  }
  els.ambulanceToast.classList.remove("hidden");
  els.ambulanceToast.classList.add("flex");
}

function hideAmbulanceToast() {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (els.ambulanceToast) {
    els.ambulanceToast.classList.add("hidden");
    els.ambulanceToast.classList.remove("flex");
  }
}

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    let msg;
    if (body && body.error) {
      msg = body.error;
    } else if (res.status === 404) {
      msg =
        "Ambulance service endpoint not found (404). Make sure the backend is running on http://localhost:4000.";
    } else {
      msg = `Request failed (${res.status})`;
    }
    throw new Error(msg);
  }
  return body;
}

function initMap() {
  map = L.map("ambMap", { zoomControl: true }).setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  map.on("click", (e) => {
    setPickupLocation({ lat: e.latlng.lat, lon: e.latlng.lng }, "Pinned on map");
  });
}

function setPickupLocation(loc, sourceLabel) {
  state.pickupLocation = loc;
  if (!patientMarker) {
    patientMarker = L.marker([loc.lat, loc.lon], {
      title: "Pickup location"
    }).addTo(map);
  } else {
    patientMarker.setLatLng([loc.lat, loc.lon]);
  }
  map.setView([loc.lat, loc.lon], 15, { animate: true });

  if (els.pickupSummary) {
    els.pickupSummary.textContent = `${sourceLabel}: ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}`;
  }
  loadNearestHospitalsForPickup().catch((e) => {
    console.error("Nearest hospitals failed:", e);
  });
}

async function geoUseCurrentLocation() {
  if (!navigator.geolocation) {
    setRequestMessage("Geolocation is not supported in this browser.", "error");
    return;
  }
  els.btnPickupCurrent.disabled = true;
  els.btnPickupCurrent.textContent = "Locating…";
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10_000
      });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    setPickupLocation({ lat, lon }, "Current location");
    setRequestMessage("Current location set as pickup. You can adjust by tapping on the map.", "success");
  } catch (e) {
    console.error(e);
    setRequestMessage("Unable to use current location. Please tap on the map to set a pickup point.", "error");
  } finally {
    els.btnPickupCurrent.disabled = false;
    els.btnPickupCurrent.textContent = "Use my current location";
  }
}

function updateMarkers(trip) {
  const p = trip.pickupLocation;
  const a = trip.ambulanceLocation;
  const d = trip.dropLocation;

  if (!patientMarker) {
    patientMarker = L.marker([p.lat, p.lon], {
      title: "Pickup location"
    }).addTo(map);
  } else {
    patientMarker.setLatLng([p.lat, p.lon]);
  }

  if (!ambulanceMarker) {
    const ambIcon = L.divIcon({
      className: "ambulance-marker",
      html: `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#dc2626;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 9a3 3 0 0 1 3-3h7.17a3 3 0 0 1 2.12.88l2.83 2.83A3 3 0 0 1 20 12.83V16a2 2 0 0 1-2 2h-1.5"/>
          <path d="M4 9v7a2 2 0 0 0 2 2h1.5"/>
          <circle cx="8" cy="18" r="1.4"/>
          <circle cx="17" cy="18" r="1.4"/>
          <path d="M9.5 10.5v5m2.5-2.5H7"/>
        </svg>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    ambulanceMarker = L.marker([a.lat, a.lon], {
      title: "Ambulance",
      icon: ambIcon
    }).addTo(map);
  } else {
    ambulanceMarker.setLatLng([a.lat, a.lon]);
  }

  if (routeLine) {
    routeLine.setLatLngs(
      d
        ? [
            [a.lat, a.lon],
            [p.lat, p.lon],
            [d.lat, d.lon]
          ]
        : [
            [a.lat, a.lon],
            [p.lat, p.lon]
          ]
    );
  } else {
    routeLine = L.polyline(
      d
        ? [
            [a.lat, a.lon],
            [p.lat, p.lon],
            [d.lat, d.lon]
          ]
        : [
            [a.lat, a.lon],
            [p.lat, p.lon]
          ],
      { color: "#b91c1c", weight: 3, dashArray: "6 4", opacity: 0.8 }
    ).addTo(map);
  }

  if (d) {
    if (!dropMarker) {
      const hospIcon = L.divIcon({
        className: "",
        html:
          '<div style="background:#0f766e;color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:600;">HOSP</div>',
        iconSize: [36, 18],
        iconAnchor: [18, 9]
      });
      dropMarker = L.marker([d.lat, d.lon], {
        title: "Dropping hospital",
        icon: hospIcon
      }).addTo(map);
    } else {
      dropMarker.setLatLng([d.lat, d.lon]);
    }
  }

  const bounds = L.latLngBounds([
    [a.lat, a.lon],
    [p.lat, p.lon]
  ]);
  if (d) bounds.extend([d.lat, d.lon]);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });

  els.metaAssignment.textContent = `${trip.ambulanceCode || "AMB"} • ${trip.ambulanceType.toUpperCase()} • ${
    trip.status
  }`;
  els.metaEta.textContent = `${trip.etaMinutes.toFixed(1)} min (target &lt; 10 min)`;
  els.metaPosition.textContent = `${trip.ambulanceLocation.lat.toFixed(4)}, ${trip.ambulanceLocation.lon.toFixed(
    4
  )}`;
  if (els.metaDriver) {
    const name = trip.driverName || "Not assigned";
    const phone = trip.driverPhone || "";
    els.metaDriver.textContent = phone ? `${name} • ${phone}` : name;
  }
  if (els.metaSpeed) {
    if (typeof trip.speedKmph === "number" && Number.isFinite(trip.speedKmph)) {
      els.metaSpeed.textContent = `${trip.speedKmph.toFixed(0)} km/h`;
    } else {
      els.metaSpeed.textContent = "—";
    }
  }
}

function validateName(name) {
  if (!name || !name.trim()) return false;
  const t = name.trim();
  if (t.length < 2 || t.length > 80) return false;
  return /^[a-zA-Z\s.'-]+$/.test(t);
}

function validateContactNumber(number) {
  if (!number) return false;
  const trimmed = String(number).replace(/\D/g, "");
  return /^\d{10}$/.test(trimmed);
}

async function startTracking(tripId) {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
  currentTripId = tripId;

  async function poll() {
    try {
      const trip = await api(`/ambulances/track/${encodeURIComponent(tripId)}`, { method: "GET" });
      updateMarkers(trip);
      if (trip.status === "arrived") {
        setTrackStatus("Ambulance has arrived at your location.", "success");
        // Step 3: Show "Ambulance has arrived" popup when ambulance actually arrives
        showAmbulanceToast("Ambulance has arrived", "The ambulance is now at your location. Please proceed.", "arrived");
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(hideAmbulanceToast, 6000);
        clearInterval(trackTimer);
        trackTimer = null;
      } else if (trip.status === "en_route") {
        setTrackStatus("Ambulance en route. Please keep your phone available.", "info");
      }
    } catch (e) {
      console.error(e);
      setTrackStatus("Unable to refresh live location.", "error");
    }
  }

  await poll();
  trackTimer = setInterval(poll, 2000);
}

async function handleRequest(e) {
  e.preventDefault();
  const typeInput = document.querySelector('input[name="ambType"]:checked');
  const ambulanceType = typeInput ? typeInput.value : "bls";
  const patientName = document.getElementById("patientName").value.trim();
  const contactNumber = document.getElementById("contactNumber").value.trim();
  const dropHospitalName = els.dropHospitalName.value.trim();

  if (!state.pickupLocation) {
    setRequestMessage("Please set a pickup pin using your current location or by tapping on the map.", "error");
    return;
  }

  if (!validateName(patientName)) {
    setRequestMessage("Patient name is required (2–80 characters, letters and spaces).", "error");
    return;
  }

  if (!validateContactNumber(contactNumber)) {
    setRequestMessage("Please enter a valid 10-digit Indian contact number.", "error");
    return;
  }

  els.btnRequest.disabled = true;
  els.btnRequest.textContent = "Requesting…";
  setRequestMessage("Submitting your request and assigning the nearest ambulance…", "info");

  // Step 1: Show "Dispatching an ambulance for you" popup immediately
  showAmbulanceToast("Dispatching an ambulance for you", "Please wait while we assign the nearest available unit…", "dispatching");

  // Simulate dispatch delay (5 seconds) before API call
  await new Promise((r) => setTimeout(r, 5000));

  try {
    // If a dropping hospital name is provided but we don't yet have coordinates,
    // attempt to geocode it near India (simple demo behaviour).
    if (dropHospitalName && !state.dropLocation && state.pickupLocation) {
      try {
        const q = encodeURIComponent(`${dropHospitalName}, hospital, India`);
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json"
          }
        });
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr[0]) {
            const lat = Number(arr[0].lat);
            const lon = Number(arr[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              state.dropLocation = { lat, lon };
            }
          }
        }
      } catch (geoErr) {
        console.error("Drop hospital geocode failed:", geoErr);
      }
    }

    const body = await api("/ambulances/request", {
      method: "POST",
      body: JSON.stringify({
        pickupAddress: null,
        ambulanceType,
        patientName,
        contactNumber,
        pickupLocation: state.pickupLocation,
        dropHospitalName,
        dropLocation: state.dropLocation
      })
    });

    const t = body.trip;
    setRequestMessage(
      `Ambulance assigned (${t.ambulanceCode}). Estimated arrival in ${t.etaMinutes.toFixed(1)} minutes.`,
      "success"
    );

    // Step 2: After 8 seconds, show "Ambulance is on its way" popup
    toastTimeout = setTimeout(() => {
      showAmbulanceToast("Ambulance is on its way", "Keep your phone available. Track live on the map above.", "on_way");
      toastTimeout = setTimeout(hideAmbulanceToast, 6000);
    }, 8000);

    // Show confirmation modal with key details
    if (els.confirmBody && els.confirmModal) {
      const items = [];
      items.push(
        `<div><span class="font-medium text-slate-800">Trip ID:</span> <span class="font-mono text-[11px]">${t.id}</span></div>`
      );
      items.push(
        `<div><span class="font-medium text-slate-800">Ambulance:</span> ${t.ambulanceCode} • ${t.ambulanceType.toUpperCase()}</div>`
      );
      items.push(
        `<div><span class="font-medium text-slate-800">ETA:</span> ${t.etaMinutes.toFixed(
          1
        )} minutes (target &lt; 10)</div>`
      );
      items.push(
        `<div><span class="font-medium text-slate-800">Pickup:</span> ${t.pickupAddress || "On-map pin"}</div>`
      );
      if (dropHospitalName) {
        items.push(
          `<div><span class="font-medium text-slate-800">Dropping hospital:</span> ${dropHospitalName}</div>`
        );
      }
      if (contactNumber) {
        items.push(
          `<div><span class="font-medium text-slate-800">Contact:</span> ${contactNumber}</div>`
        );
      }
      if (t.driverName || t.driverPhone) {
        items.push(
          `<div><span class="font-medium text-slate-800">Driver:</span> ${
            t.driverName || "Assigned driver"
          }${t.driverPhone ? ` • ${t.driverPhone}` : ""}</div>`
        );
      }
      els.confirmBody.innerHTML = items
        .map(
          (line) => `<div class="flex items-start gap-2">
            <span class="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <div>${line}</div>
          </div>`
        )
        .join("");
      els.confirmModal.classList.remove("hidden");
      els.confirmModal.classList.add("flex");
    }
    await startTracking(body.trip.id);
  } catch (e) {
    console.error(e);
    setRequestMessage(e.message || "Could not place request. Please try again.", "error");
  } finally {
    els.btnRequest.disabled = false;
    els.btnRequest.textContent = "Request ambulance";
  }
}

function boot() {
  initMap();
  els.requestForm.addEventListener("submit", (e) => handleRequest(e));
  if (els.btnPickupCurrent) {
    els.btnPickupCurrent.addEventListener("click", () => {
      geoUseCurrentLocation();
    });
  }
  if (els.btnConfirmClose && els.btnConfirmOk && els.confirmModal) {
    const hideModal = () => {
      els.confirmModal.classList.add("hidden");
      els.confirmModal.classList.remove("flex");
    };
    els.btnConfirmClose.addEventListener("click", hideModal);
    els.btnConfirmOk.addEventListener("click", hideModal);
    els.confirmModal.addEventListener("click", (e) => {
      if (e.target === els.confirmModal) hideModal();
    });
  }
  setRequestMessage("Fill in pickup details and ambulance type, then submit to start.", "info");
}

boot();

