/* ══════════════════════════════════════════
   INTRO DISMISS
══════════════════════════════════════════ */
setTimeout(() => {
  document.getElementById('intro').classList.add('hidden');
}, 2200);

/* ══════════════════════════════════════════
   SCROLL PROGRESS BAR
══════════════════════════════════════════ */
const bar = document.getElementById('progress');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const total    = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
}, { passive: true });

/* ══════════════════════════════════════════
   REVEAL ON SCROLL  (Intersection Observer)
══════════════════════════════════════════ */
const revealElements = document.querySelectorAll('[data-reveal]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealElements.forEach(el => observer.observe(el));
