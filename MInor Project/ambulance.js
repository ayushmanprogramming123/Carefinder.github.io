const API_BASE = "http://localhost:4000/api";

const els = {
  requestForm: document.getElementById("requestForm"),
  pickupAddress: document.getElementById("pickupAddress"),
  pickupSummary: document.getElementById("pickupSummary"),
  btnPickupCurrent: document.getElementById("btnPickupCurrent"),
  requestMessage: document.getElementById("requestMessage"),
  btnRequest: document.getElementById("btnRequest"),
  trackStatus: document.getElementById("trackStatus"),
  metaAssignment: document.getElementById("metaAssignment"),
  metaEta: document.getElementById("metaEta"),
  metaPosition: document.getElementById("metaPosition"),
  dropHospitalName: document.getElementById("dropHospitalName"),
  confirmModal: document.getElementById("confirmModal"),
  confirmBody: document.getElementById("confirmBody"),
  btnConfirmClose: document.getElementById("btnConfirmClose"),
  btnConfirmOk: document.getElementById("btnConfirmOk")
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
    setRequestMessage("Current location set as pickup. Please verify the address text.", "success");
  } catch (e) {
    console.error(e);
    setRequestMessage("Unable to use current location. Please type the address manually.", "error");
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
      className: "",
      html:
        '<div style="background:#b91c1c;color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:600;">AMB</div>',
      iconSize: [30, 18],
      iconAnchor: [15, 9]
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

  const bounds = [
    [a.lat, a.lon],
    [p.lat, p.lon]
  ];
  if (d) bounds.push([d.lat, d.lon]);
  map.fitBounds(bounds, { padding: [30, 30] });

  els.metaAssignment.textContent = `${trip.ambulanceCode || "AMB"} • ${trip.ambulanceType.toUpperCase()} • ${
    trip.status
  }`;
  els.metaEta.textContent = `${trip.etaMinutes.toFixed(1)} min (target &lt; 10 min)`;
  els.metaPosition.textContent = `${trip.ambulanceLocation.lat.toFixed(4)}, ${trip.ambulanceLocation.lon.toFixed(
    4
  )}`;
}

function validateName(name) {
  if (!name) return true; // optional, but if present must be valid
  if (name.length < 2 || name.length > 80) return false;
  return /^[a-zA-Z\s.'-]+$/.test(name);
}

function validateContactNumber(number) {
  if (!number) return false;
  const trimmed = number.replace(/\s+/g, "");
  if (!/^\d{10}$/.test(trimmed)) return false;
  // Indian mobile numbers typically start with 6-9
  return /^[6-9]/.test(trimmed);
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
  trackTimer = setInterval(poll, 5000);
}

async function handleRequest(e) {
  e.preventDefault();
  const address = els.pickupAddress.value.trim();
  const typeInput = document.querySelector('input[name="ambType"]:checked');
  const ambulanceType = typeInput ? typeInput.value : "bls";
  const patientName = document.getElementById("patientName").value.trim();
  const contactNumber = document.getElementById("contactNumber").value.trim();
  const dropHospitalName = els.dropHospitalName.value.trim();

  if (!address && !state.pickupLocation) {
    setRequestMessage("Please provide a pickup address or set a pickup pin on the map.", "error");
    return;
  }

  if (!validateName(patientName)) {
    setRequestMessage("Please enter a valid patient name (letters and spaces only).", "error");
    return;
  }

  if (!validateContactNumber(contactNumber)) {
    setRequestMessage("Please enter a valid 10-digit mobile number starting with 6–9.", "error");
    return;
  }

  els.btnRequest.disabled = true;
  els.btnRequest.textContent = "Requesting…";
  setRequestMessage("Submitting your request and assigning the nearest ambulance…", "info");

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
        pickupAddress: address,
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

