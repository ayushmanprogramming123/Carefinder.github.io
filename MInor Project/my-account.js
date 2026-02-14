document.addEventListener("DOMContentLoaded", () => {
  const loginPrompt = document.getElementById("loginPrompt");
  const accountContent = document.getElementById("accountContent");

  try {
    const raw = localStorage.getItem("carefinder_patient");
    const patient = raw ? JSON.parse(raw) : null;

    if (!patient || !patient.name) {
      if (loginPrompt) loginPrompt.classList.remove("hidden");
      if (accountContent) accountContent.classList.add("hidden");
      return;
    }

    if (loginPrompt) loginPrompt.classList.add("hidden");
    if (accountContent) accountContent.classList.remove("hidden");

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || "—";
    };

    set("accountName", patient.name);
    set("accountId", patient.id || "—");
    set("accountAge", patient.age ? String(patient.age) : "—");
    set("accountGender", patient.gender ? String(patient.gender).charAt(0).toUpperCase() + String(patient.gender).slice(1) : "—");
    set("accountAddress", patient.address || "—");
    set("accountEmail", patient.email || "—");
    set("accountMobile", patient.mobile || "—");

    const avatar = document.getElementById("accountAvatar");
    if (avatar) {
      const initial = (patient.name || "").charAt(0).toUpperCase() || "?";
      avatar.textContent = initial;
    }
  } catch (_) {
    if (loginPrompt) loginPrompt.classList.remove("hidden");
    if (accountContent) accountContent.classList.add("hidden");
  }
});
