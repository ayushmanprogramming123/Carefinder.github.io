document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("btnNavMenu");
  const closeButton = document.getElementById("btnNavClose");
  const drawer = document.getElementById("navDrawer");
  const overlay = document.getElementById("navOverlay");
  const iconBars = menuButton ? menuButton.querySelectorAll("span.block") : null;

  // Show patient avatar + name in sidebar when logged in
  const profileEl = document.getElementById("navPatientProfile");
  const avatarEl = document.getElementById("navPatientAvatar");
  const nameEl = document.getElementById("navPatientName");
  if (profileEl) {
    try {
      const raw = localStorage.getItem("carefinder_patient");
      const patient = raw ? JSON.parse(raw) : null;
      if (patient && patient.name) {
        profileEl.classList.remove("hidden");
        if (avatarEl) {
          const initial = (patient.name || "").charAt(0).toUpperCase() || "?";
          avatarEl.textContent = initial;
        }
        if (nameEl) nameEl.textContent = patient.name;
      } else {
        profileEl.classList.add("hidden");
      }
    } catch (_) {
      profileEl.classList.add("hidden");
    }
  }

  // Global visual polish: light load animations + vibrant accents.
  const styleId = "carefinder-global-effects";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      :root { --cf-accent: #06b6d4; --cf-accent-2: #7c3aed; }
      @keyframes cfFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      [data-cf-animate] { opacity: 0; animation: cfFadeUp .55s ease forwards; }
      [data-cf-animate][data-cf-delay="1"] { animation-delay: .06s; }
      [data-cf-animate][data-cf-delay="2"] { animation-delay: .12s; }
      [data-cf-animate][data-cf-delay="3"] { animation-delay: .18s; }
      button, a, input, select, textarea, article, section, .rounded-2xl, .rounded-xl {
        transition: transform .2s ease, box-shadow .2s ease, filter .2s ease, background-color .2s ease;
      }
      article:hover, section:hover, .rounded-2xl:hover, .rounded-xl:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(8, 47, 73, .08);
      }
      .bg-calm-600 { background-color: #0891b2 !important; }
      .bg-calm-700 { background-color: #0e7490 !important; }
      .text-calm-700 { color: #0e7490 !important; }
      .text-calm-800 { color: #155e75 !important; }
    `;
    document.head.appendChild(style);
  }

  const animated = document.querySelectorAll("main > section, main .rounded-2xl, main h1, main h2");
  animated.forEach((el, idx) => {
    el.setAttribute("data-cf-animate", "1");
    el.setAttribute("data-cf-delay", String(Math.min(3, idx % 4)));
  });

  if (!menuButton || !drawer || !overlay) return;

  const openDrawer = () => {
    drawer.classList.remove("-translate-x-full");
    drawer.classList.add("translate-x-0");
    overlay.classList.remove("pointer-events-none");
    overlay.classList.add("opacity-100");

    menuButton.setAttribute("aria-expanded", "true");
    if (iconBars && iconBars.length === 3) {
      iconBars[0].style.transform = "translateY(4px) rotate(45deg)";
      iconBars[1].style.opacity = "0";
      iconBars[2].style.transform = "translateY(-4px) rotate(-45deg)";
    }
    document.body.classList.add("overflow-hidden");
  };

  const closeDrawer = () => {
    drawer.classList.remove("translate-x-0");
    drawer.classList.add("-translate-x-full");
    overlay.classList.remove("opacity-100");
    overlay.classList.add("pointer-events-none");

    menuButton.setAttribute("aria-expanded", "false");
    if (iconBars && iconBars.length === 3) {
      iconBars[0].style.transform = "";
      iconBars[1].style.opacity = "1";
      iconBars[2].style.transform = "";
    }
    document.body.classList.remove("overflow-hidden");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = drawer.classList.contains("translate-x-0");
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  overlay.addEventListener("click", closeDrawer);

  if (closeButton) {
    closeButton.addEventListener("click", closeDrawer);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });

  const drawerLinks = drawer.querySelectorAll("a[href]");
  drawerLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeDrawer();
    });
  });
});

