document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("btnNavMenu");
  const closeButton = document.getElementById("btnNavClose");
  const drawer = document.getElementById("navDrawer");
  const overlay = document.getElementById("navOverlay");
  const iconBars = menuButton ? menuButton.querySelectorAll("span.block") : null;

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

