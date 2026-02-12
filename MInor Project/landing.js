// Simple hero slider + footer year for CareFinder landing page

document.addEventListener("DOMContentLoaded", () => {
  const slides = Array.from(document.querySelectorAll("[data-hero-slide]"));
  const dots = Array.from(document.querySelectorAll("[data-hero-dot]"));
  let current = 0;
  let timer = null;

  function showSlide(index) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    slides.forEach((el, i) => {
      el.style.opacity = i === current ? "1" : "0";
    });
    dots.forEach((el, i) => {
      el.className =
        "h-1.5 w-4 rounded-full " + (i === current ? "bg-slate-900" : "bg-slate-300");
    });
  }

  function startAuto() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      showSlide(current + 1);
    }, 5000);
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      showSlide(i);
      startAuto();
    });
  });

  showSlide(0);
  startAuto();

  // Footer year
  const yearSpan = document.getElementById("yearSpan");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString();
  }
});

