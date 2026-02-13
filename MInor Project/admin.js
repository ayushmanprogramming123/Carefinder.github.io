const API_BASE = "http://localhost:4000/api";

const els = {
  btnModeLogin: document.getElementById("btnModeLogin"),
  btnModeRegister: document.getElementById("btnModeRegister"),
  authForm: document.getElementById("authForm"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authHospitalName: document.getElementById("authHospitalName"),
  hospitalNameField: document.getElementById("hospitalNameField"),
  hospitalDetailsFields: document.getElementById("hospitalDetailsFields"),
  authHospitalAddress: document.getElementById("authHospitalAddress"),
  authHospitalCity: document.getElementById("authHospitalCity"),
  authHospitalState: document.getElementById("authHospitalState"),
  authHospitalDistrict: document.getElementById("authHospitalDistrict"),
  authHospitalPincode: document.getElementById("authHospitalPincode"),
  authHospitalPhone: document.getElementById("authHospitalPhone"),
  authHospitalCapacity: document.getElementById("authHospitalCapacity"),
  btnUseHospitalLocation: document.getElementById("btnUseHospitalLocation"),
  authModeLabel: document.getElementById("authModeLabel"),
  authMessage: document.getElementById("authMessage"),
  dashboard: document.getElementById("dashboard"),
  btnLogout: document.getElementById("btnLogout"),
  dashHospitalName: document.getElementById("dashHospitalName"),
  dashHospitalKey: document.getElementById("dashHospitalKey"),
  bedsCapacity: document.getElementById("bedsCapacity"),
  bedsAvailable: document.getElementById("bedsAvailable"),
  bedsIcu: document.getElementById("bedsIcu"),
  bedsEmergency: document.getElementById("bedsEmergency"),
  bedsMessage: document.getElementById("bedsMessage"),
  btnSaveBeds: document.getElementById("btnSaveBeds"),
  btnAuthSubmit: document.getElementById("btnAuthSubmit")
};

const state = {
  mode: "login",
  token: null,
  user: null,
  hospital: null,
  hospitalLocation: null
};

function setAuthMessage(msg, kind = "info") {
  const base = "mt-1 text-xs";
  const map = {
    info: "text-slate-500",
    success: "text-emerald-600",
    error: "text-rose-600",
    warn: "text-amber-600"
  };
  els.authMessage.className = `${base} ${map[kind] || map.info}`;
  els.authMessage.textContent = msg || "";
}

function setBedsMessage(msg, kind = "info") {
  const base = "mt-2 text-xs";
  const map = {
    info: "text-slate-500",
    success: "text-emerald-600",
    error: "text-rose-600",
    warn: "text-amber-600"
  };
  els.bedsMessage.className = `${base} ${map[kind] || map.info}`;
  els.bedsMessage.textContent = msg || "";
}

function setMode(mode) {
  state.mode = mode;
  els.authModeLabel.textContent = mode === "login" ? "Login" : "Register";
  els.hospitalNameField.classList.toggle("hidden", mode === "login");
  if (els.hospitalDetailsFields) {
    els.hospitalDetailsFields.classList.toggle("hidden", mode === "login");
  }

  els.btnModeLogin.className =
    "flex-1 rounded-lg px-3 py-2 text-xs font-medium " +
    (mode === "login"
      ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
      : "text-slate-600");
  els.btnModeRegister.className =
    "flex-1 rounded-lg px-3 py-2 text-xs font-medium " +
    (mode === "register"
      ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
      : "text-slate-600");

  setAuthMessage(
    mode === "login"
      ? "Use your registered hospital email to sign in."
      : "New staff accounts are linked to a hospital record. Enter the exact hospital name."
  );
}

function storeToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem("carefinder_token", token);
  } else {
    localStorage.removeItem("carefinder_token");
  }
}

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

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
    const msg = body && body.error ? body.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value.trim();
  const name = els.authName.value.trim();
  const hospitalName = els.authHospitalName.value.trim();
  const hospitalAddress = els.authHospitalAddress ? els.authHospitalAddress.value.trim() : "";
  const hospitalCity = els.authHospitalCity ? els.authHospitalCity.value.trim() : "";
  const hospitalState = els.authHospitalState ? els.authHospitalState.value.trim() : "";
  const hospitalPhone = els.authHospitalPhone ? els.authHospitalPhone.value.trim() : "";
  const hospitalCapacityRaw = els.authHospitalCapacity ? els.authHospitalCapacity.value.trim() : "";

  if (!email || !password) {
    setAuthMessage("Email and password are required.", "error");
    return;
  }

  els.btnAuthSubmit.disabled = true;
  els.btnAuthSubmit.textContent = state.mode === "login" ? "Logging in…" : "Registering…";
  setAuthMessage(
    state.mode === "login" ? "Checking your credentials…" : "Creating your staff account…",
    "info"
  );

  try {
    if (state.mode === "login") {
      const body = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      storeToken(body.token);
      state.user = body.user;
      setAuthMessage("Logged in successfully.", "success");
      await loadDashboard();
    } else {
      if (!name || !hospitalName) {
        setAuthMessage("Name and hospital name are required for registration.", "error");
        return;
      }
      const hospitalDistrict = els.authHospitalDistrict ? els.authHospitalDistrict.value.trim() : "";
      const hospitalPincode = els.authHospitalPincode ? els.authHospitalPincode.value.trim() : "";
      if (!hospitalAddress || !hospitalCity || !hospitalState || !hospitalPhone) {
        setAuthMessage("Please fill hospital address, city, state, and contact number.", "error");
        return;
      }
      const hospitalCapacity = hospitalCapacityRaw ? Number(hospitalCapacityRaw) : null;
      const hospitalLocation = state.hospitalLocation || null;
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          hospitalName,
          hospitalAddress,
          hospitalCity,
          hospitalState,
          hospitalDistrict,
          hospitalPincode,
          hospitalPhone,
          hospitalCapacity,
          hospitalLocation
        })
      });
      setAuthMessage("Registered successfully. You can now log in.", "success");
      setMode("login");
    }
  } catch (e) {
    console.error(e);
    setAuthMessage(e.message || "Something went wrong.", "error");
  } finally {
    els.btnAuthSubmit.disabled = false;
    els.btnAuthSubmit.textContent = "Continue";
  }
}

async function loadDashboard() {
  if (!state.token) {
    els.dashboard.classList.add("hidden");
    return;
  }

  try {
    const me = await api("/me", { method: "GET" });
    state.user = me;
    const hospital = await api("/hospitals/mine", { method: "GET" });
    state.hospital = hospital;

    els.dashHospitalName.textContent = hospital.name || "Unknown hospital";
    els.dashHospitalKey.textContent = `Key: ${hospital.key}`;

    els.bedsCapacity.value = hospital.beds?.capacity ?? "";
    els.bedsAvailable.value = hospital.beds?.available ?? "";
    els.bedsIcu.value = hospital.beds?.icu ?? "";
    els.bedsEmergency.checked = !!hospital.beds?.emergency;

    els.dashboard.classList.remove("hidden");
    setBedsMessage("Adjust values and click Save changes. Patients will see updated numbers immediately.", "info");
  } catch (e) {
    console.error(e);
    setAuthMessage("Session expired, please log in again.", "warn");
    storeToken(null);
    els.dashboard.classList.add("hidden");
  }
}

async function handleSaveBeds() {
  if (!state.token) return;
  els.btnSaveBeds.disabled = true;
  els.btnSaveBeds.textContent = "Saving…";
  setBedsMessage("Saving updated bed information…", "info");

  try {
    const payload = {
      capacity: els.bedsCapacity.value,
      available: els.bedsAvailable.value,
      icu: els.bedsIcu.value,
      emergency: els.bedsEmergency.checked
    };
    const res = await api("/hospitals/mine/beds", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    state.hospital.beds = res.beds;
    setBedsMessage("Bed availability updated successfully.", "success");
  } catch (e) {
    console.error(e);
    setBedsMessage(e.message || "Unable to save changes.", "error");
  } finally {
    els.btnSaveBeds.disabled = false;
    els.btnSaveBeds.textContent = "Save changes";
  }
}

function handleLogout() {
  storeToken(null);
  state.user = null;
  state.hospital = null;
  els.dashboard.classList.add("hidden");
  setAuthMessage("Logged out. You can safely close this tab.", "info");
}

async function useHospitalLocation() {
  if (!navigator.geolocation) {
    setAuthMessage("Geolocation is not supported.", "error");
    return;
  }
  const btn = els.btnUseHospitalLocation;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Locating…";
  }
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    state.hospitalLocation = { lat, lon };
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Geocoding failed");
    const data = await res.json();
    const addr = data.address || {};
    if (els.authHospitalAddress) els.authHospitalAddress.value = data.display_name || "";
    if (els.authHospitalCity) els.authHospitalCity.value = addr.city || addr.town || addr.village || addr.county || "";
    if (els.authHospitalDistrict) els.authHospitalDistrict.value = addr.state_district || addr.county || "";
    if (els.authHospitalState) els.authHospitalState.value = addr.state || "";
    if (els.authHospitalPincode) els.authHospitalPincode.value = addr.postcode || "";
    setAuthMessage("Location set. Verify the address and fill any missing fields.", "success");
  } catch (e) {
    console.error(e);
    setAuthMessage("Could not get location. Please enter address manually.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Use my current location";
    }
  }
}

function boot() {
  setMode("login");

  els.btnModeLogin.addEventListener("click", () => setMode("login"));
  els.btnModeRegister.addEventListener("click", () => setMode("register"));
  if (els.btnUseHospitalLocation) {
    els.btnUseHospitalLocation.addEventListener("click", () => useHospitalLocation());
  }
  els.authForm.addEventListener("submit", (e) => {
    handleAuthSubmit(e);
  });
  els.btnSaveBeds.addEventListener("click", () => {
    handleSaveBeds();
  });
  els.btnLogout.addEventListener("click", () => {
    handleLogout();
  });

  const token = localStorage.getItem("carefinder_token");
  if (token) {
    storeToken(token);
    loadDashboard().catch((e) => console.error(e));
  }

  if (window.location.hash === "#register") {
    setMode("register");
  }
}

boot();

