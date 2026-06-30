// Main JavaScript entry point — initialises page interactions and coordinates all modules

// ── Nav scroll state ──────────────────────────────────────────
const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
  nav.classList.toggle('nav--scrolled', window.scrollY > 80);
}, { passive: true });


// ── Motion guard — respect prefers-reduced-motion ─────────────
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {

  // ── Parallax ────────────────────────────────────────────────
  // Only on desktop where the decorative elements are visible
  const parallaxTargets = [
    { selector: '.hero__dog',          speed: 0.12 },
    { selector: '.hero__gif',          speed: 0.08 },
    { selector: '.drinks__saint',      speed: 0.10 },
    { selector: '.reviews__bg-dog',    speed: 0.14 },
    { selector: '.reviews__skeleton',  speed: 0.18 },
    { selector: '.reviews__oyster',    speed: 0.14 },
  ].map(({ selector, speed }) => ({
    el: document.querySelector(selector),
    speed,
  })).filter(p => p.el);

  let rafPending = false;

  function applyParallax() {
    if (window.innerWidth < 768) {
      rafPending = false;
      return;
    }
    const vh = window.innerHeight;
    parallaxTargets.forEach(({ el, speed }) => {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const offset = (vh / 2 - elCenter) * speed;
      el.style.setProperty('--py', offset + 'px');
    });
    rafPending = false;
  }

  window.addEventListener('scroll', () => {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(applyParallax);
    }
  }, { passive: true });

  // Run once on load so initial positions are set
  applyParallax();


  // ── Reveal on scroll (IntersectionObserver) ─────────────────
  const revealSelectors = [
    '.food__header',
    '.food__item',
    '.menu__header',
    '.menu__body',
    '.drinks__header',
    '.reviews__header',
    '.review',
    '.player__header',
    '.player__records',
    '.find-us__address-block',
    '.find-us__hours-block',
    '.find-us__transport-item',
    '.booking__inner',
  ];

  const revealEls = document.querySelectorAll(revealSelectors.join(', '));

  // Stagger siblings in grid containers
  document.querySelectorAll('.food__grid, .reviews__grid, .find-us__transport-inner').forEach(container => {
    [...container.children].forEach((child, i) => {
      child.style.transitionDelay = `${i * 0.07}s`;
    });
  });

  revealEls.forEach(el => {
    el.dataset.reveal = '';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px',
  });

  revealEls.forEach(el => observer.observe(el));
}
