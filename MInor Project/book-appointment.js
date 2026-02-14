const API = "http://localhost:4000/api";

const TESTS = [
  { name: "Complete Blood Count (CBC)", price: 350 },
  { name: "Lipid Profile", price: 550 },
  { name: "Thyroid Function Test", price: 650 },
  { name: "Blood Sugar (Fasting & PP)", price: 200 },
  { name: "X-Ray (Chest)", price: 450 },
  { name: "Ultrasound (Abdomen)", price: 900 },
  { name: "ECG", price: 350 },
  { name: "MRI (single region)", price: 4500 },
  { name: "CT Scan", price: 2800 },
  { name: "Liver Function Test", price: 500 }
];

function timeSlots() {
  const s = [];
  for (let h = 9; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 19 && m > 0) break;
      s.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return s;
}

let bookType = "doctor";
let doctors = [];
const slots = timeSlots();

async function loadDoctors() {
  try {
    const res = await fetch(`${API}/doctors`);
    const data = await res.json();
    doctors = data.doctors || [];
  } catch (e) {
    doctors = [];
  }
}

function getPatient() {
  try {
    const p = localStorage.getItem("carefinder_patient");
    return p ? JSON.parse(p) : null;
  } catch {
    return null;
  }
}

function render() {
  const selDoctor = document.getElementById("selDoctor");
  const selTest = document.getElementById("selTest");
  const apptTime = document.getElementById("apptTime");
  const doctorFields = document.getElementById("doctorFields");
  const testFields = document.getElementById("testFields");
  const btnTypeDoctor = document.getElementById("btnTypeDoctor");
  const btnTypeTest = document.getElementById("btnTypeTest");

  doctorFields.classList.toggle("hidden", bookType !== "doctor");
  testFields.classList.toggle("hidden", bookType !== "test");
  btnTypeDoctor.className = bookType === "doctor" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm text-slate-600";
  btnTypeTest.className = bookType === "test" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm text-slate-600";

  if (selDoctor) {
    selDoctor.innerHTML = '<option value="">Select doctor</option>' + doctors.map((d) => `<option value="${d.id}" data-fee="${d.fee}" data-name="${d.name.replace(/"/g, "&quot;")}">${d.name} - ${d.specialty} (₹${d.fee})</option>`).join("");
  }
  if (selTest) {
    selTest.innerHTML = '<option value="">Select test</option>' + TESTS.map((t) => `<option value="${t.name}" data-fee="${t.price}">${t.name} (₹${t.price})</option>`).join("");
  }
  if (apptTime) {
    apptTime.innerHTML = slots.map((s) => `<option value="${s}">${s}</option>`).join("");
  }
  updateFee();
}

function updateFee() {
  const displayFee = document.getElementById("displayFee");
  const doctorFee = document.getElementById("doctorFee");
  const testFee = document.getElementById("testFee");
  let fee = 0;
  if (bookType === "doctor") {
    const opt = document.getElementById("selDoctor")?.selectedOptions[0];
    fee = opt ? parseInt(opt.dataset.fee || "0", 10) : 0;
    if (doctorFee) doctorFee.textContent = fee ? `Consultation fee: ₹${fee}` : "";
    if (testFee) testFee.textContent = "";
  } else {
    const opt = document.getElementById("selTest")?.selectedOptions[0];
    fee = opt ? parseInt(opt.dataset.fee || "0", 10) : 0;
    if (testFee) testFee.textContent = fee ? `Test fee: ₹${fee}` : "";
    if (doctorFee) doctorFee.textContent = "";
  }
  if (displayFee) displayFee.textContent = `₹${fee}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  const type = params.get("type");
  if (type === "test") bookType = "test";
  const preDoctorId = params.get("doctorId");
  const preDoctorName = params.get("doctorName");
  const preFee = params.get("fee");

  await loadDoctors();
  render();

  if (preDoctorId && document.getElementById("selDoctor")) {
    const sel = document.getElementById("selDoctor");
    const opt = [...sel.options].find((o) => o.value === preDoctorId);
    if (opt) {
      sel.value = preDoctorId;
      updateFee();
    } else {
      sel.innerHTML = `<option value="${preDoctorId}" data-fee="${preFee || 0}" data-name="${(preDoctorName || "").replace(/"/g, "&quot;")}">${preDoctorName || "Doctor"} (₹${preFee || 0})</option>` + sel.innerHTML;
      sel.value = preDoctorId;
      updateFee();
    }
  }

  document.getElementById("btnTypeDoctor")?.addEventListener("click", () => {
    bookType = "doctor";
    render();
  });
  document.getElementById("btnTypeTest")?.addEventListener("click", () => {
    bookType = "test";
    render();
  });
  document.getElementById("selDoctor")?.addEventListener("change", updateFee);
  document.getElementById("selTest")?.addEventListener("change", updateFee);

  const minDate = new Date().toISOString().slice(0, 10);
  const apptDate = document.getElementById("apptDate");
  if (apptDate) apptDate.min = minDate;

  document.getElementById("bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const patient = getPatient();
    if (!patient) {
      document.getElementById("formMsg").textContent = "Please log in as a patient first.";
      document.getElementById("formMsg").className = "text-xs text-rose-600";
      setTimeout(() => { window.location.href = "./patient.html?redirect=book-appointment.html"; }, 1500);
      return;
    }
    const doctorId = document.getElementById("selDoctor")?.value;
    const doctorOpt = document.getElementById("selDoctor")?.selectedOptions[0];
    const testOpt = document.getElementById("selTest")?.selectedOptions[0];
    const testName = bookType === "test" ? document.getElementById("selTest")?.value : null;
    const date = document.getElementById("apptDate")?.value;
    const time = document.getElementById("apptTime")?.value;
    let fee = 0;
    if (bookType === "doctor" && doctorOpt) fee = parseInt(doctorOpt.dataset.fee || "0", 10);
    else if (bookType === "test" && testOpt) fee = parseInt(testOpt.dataset.fee || "0", 10);
    if (!date || !time) {
      document.getElementById("formMsg").textContent = "Please select date and time.";
      return;
    }
    document.getElementById("btnBook").disabled = true;
    try {
      const res = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          type: bookType,
          doctorId: bookType === "doctor" ? doctorId : null,
          testName,
          hospitalName: document.getElementById("hospitalName")?.value || "KIIMS",
          appointmentDate: date,
          appointmentTime: time,
          fee
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      sessionStorage.setItem("carefinder_last_booking", JSON.stringify(data.appointment));
      window.location.href = "./booking-confirmation.html";
    } catch (err) {
      document.getElementById("formMsg").textContent = err.message || "Booking failed";
      document.getElementById("formMsg").className = "text-xs text-rose-600";
    } finally {
      document.getElementById("btnBook").disabled = false;
    }
  });
});
