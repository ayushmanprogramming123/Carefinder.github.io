const API = "http://localhost:4000/api";

const els = {
  btnModeLogin: document.getElementById("btnModeLogin"),
  btnModeRegister: document.getElementById("btnModeRegister"),
  regFields: document.getElementById("regFields"),
  patientForm: document.getElementById("patientForm"),
  patientName: document.getElementById("patientName"),
  patientAge: document.getElementById("patientAge"),
  patientGender: document.getElementById("patientGender"),
  patientAddress: document.getElementById("patientAddress"),
  patientEmail: document.getElementById("patientEmail"),
  patientMobile: document.getElementById("patientMobile"),
  btnUseLocation: document.getElementById("btnUseLocation"),
  formMessage: document.getElementById("formMessage"),
  btnSubmit: document.getElementById("btnSubmit")
};

let mode = "login";

function setMode(m) {
  mode = m;
  els.regFields.style.display = m === "register" ? "block" : "none";
  els.btnModeLogin.className = m === "login" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm text-slate-600";
  els.btnModeRegister.className = m === "register" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm text-slate-600";
  els.btnSubmit.textContent = m === "login" ? "Login" : "Register";
  els.formMessage.textContent = "";
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }
}

function validate() {
  showErr("errName", "");
  showErr("errAge", "");
  showErr("errEmail", "");
  showErr("errMobile", "");
  const email = (els.patientEmail?.value || "").trim();
  const mobile = (els.patientMobile?.value || "").replace(/\D/g, "");
  if (!email) {
    showErr("errEmail", "Email is required");
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showErr("errEmail", "Invalid email format");
    return false;
  }
  const mobileRegex = /^\d{10}$/;
  if (!mobile || !mobileRegex.test(mobile)) {
    showErr("errMobile", "Valid 10-digit Indian mobile required");
    return false;
  }
  if (mode === "register") {
    const name = (els.patientName?.value || "").trim();
    const age = parseInt(els.patientAge?.value || "0", 10);
    if (!name || name.length < 2) {
      showErr("errName", "Name must be at least 2 characters");
      return false;
    }
    if (!Number.isFinite(age) || age < 1 || age > 120) {
      showErr("errAge", "Age must be 1-120");
      return false;
    }
    if (!["male", "female", "other"].includes((els.patientGender?.value || "").toLowerCase())) {
      els.formMessage.textContent = "Please select gender";
      return false;
    }
    const addr = (els.patientAddress?.value || "").trim();
    if (!addr || addr.length < 5) {
      els.formMessage.textContent = "Address is required (min 5 characters). Use 'Use location' or enter manually.";
      return false;
    }
  }
  return true;
}

async function useLocation() {
  if (!navigator.geolocation) {
    els.formMessage.textContent = "Geolocation not supported";
    return;
  }
  els.btnUseLocation.disabled = true;
  els.btnUseLocation.textContent = "Locating…";
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (els.patientAddress) els.patientAddress.value = data.display_name || "";
  } catch (e) {
    els.formMessage.textContent = "Could not get location";
  } finally {
    els.btnUseLocation.disabled = false;
    els.btnUseLocation.textContent = "Use location";
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) return;
  els.btnSubmit.disabled = true;
  els.formMessage.textContent = mode === "login" ? "Logging in…" : "Registering…";
  try {
    const email = els.patientEmail.value.trim();
    const mobile = els.patientMobile.value.replace(/\D/g, "");
    let res, body;
    if (mode === "login") {
      res = await fetch(`${API}/patients/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mobile })
      });
    } else {
      res = await fetch(`${API}/patients/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: els.patientName.value.trim(),
          age: parseInt(els.patientAge.value, 10),
          gender: els.patientGender.value,
          address: els.patientAddress?.value?.trim() || "",
          email,
          mobile
        })
      });
    }
    body = await res.json();
    if (!res.ok) throw new Error(body.error || "Request failed");
    localStorage.setItem("carefinder_patient_token", body.token);
    localStorage.setItem("carefinder_patient", JSON.stringify(body.patient));
    const msg = mode === "login" ? "Login successful! Redirecting…" : "Registration successful! Redirecting…";
    alert(msg);
    window.location.href = "./appointments.html";
  } catch (e) {
    els.formMessage.textContent = e.message || "Something went wrong";
    els.formMessage.className = "text-xs text-rose-600";
  } finally {
    els.btnSubmit.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setMode("login");
  els.btnModeLogin?.addEventListener("click", () => setMode("login"));
  els.btnModeRegister?.addEventListener("click", () => setMode("register"));
  els.btnUseLocation?.addEventListener("click", useLocation);
  els.patientForm?.addEventListener("submit", handleSubmit);
  els.patientMobile?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });
});
