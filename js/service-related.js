// Animate once on entry; links remain visible and usable without JavaScript.
(() => {
  const section = document.querySelector('.service-related');
  if (!section || !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    section.querySelectorAll('nav a').forEach((link, index) => {
      link.style.setProperty('--reveal-delay', `${index * 70}ms`);
      link.classList.add('is-revealing');
      link.addEventListener('animationend', () => {
        link.classList.remove('is-revealing');
      }, { once: true });
    });
    observer.disconnect();
  }, { threshold: 0.15 });
  observer.observe(section);
})();
