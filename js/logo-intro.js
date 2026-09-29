/* ==========================================================================
   PERRO — Logo intro (desktop, first session load only)
   A full-screen solid overlay with the brand logo cut out via a CSS mask
   zooms from a huge fragment of a single letter down to its resting size,
   holds, then dissolves to reveal the live homepage underneath.

   The mask itself (size/position, css/home.css) never animates — only
   .logo-intro__wrap's transform: scale() does, via GSAP. Scaling a
   wrapper AROUND an already-masked layer lets the browser composite the
   mask once and just transform the resulting layer on the GPU, instead of
   re-rasterising the mask every frame.

   Eligibility (desktop, first session load, motion OK) is re-checked here
   even though CSS + the inline head-script bootstrap already prevent any
   visible flash for ineligible visitors — this is the actual gate that
   decides whether to run the animation at all.

   TUNING — adjust these, nothing else needs to change:
   ========================================================================== */
(function () {
  'use strict';

  var START_SCALE     = 50;    // wrapper's starting transform:scale() — brief calls for ~40-60, tune visually
  var ZOOM_DURATION    = 2.4;  // seconds — scale down from START_SCALE to resting size (1)
  var ZOOM_EASE        = 'expo.inOut';
  var HOLD_DURATION    = 0.5;  // seconds — pause at resting size before the overlay fades
  var FADE_DURATION    = 0.8;  // seconds — overlay fade-out + hero entrance, played together
  var SKIP_APPEAR_DELAY = 1;   // seconds before the Skip control becomes visible/clickable
  var HERO_FROM = { opacity: 0, y: 24, scale: 1.06 }; // header/headline starting state

  var SESSION_KEY = 'perro-intro-played';
  var DESKTOP_MIN_WIDTH = 1024;

  var intro = document.getElementById('logoIntro');
  if (!intro) return;

  function removeIntro() {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    document.documentElement.classList.remove('intro-locked');
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isDesktop = window.innerWidth >= DESKTOP_MIN_WIDTH;
  var alreadyPlayed = false;
  try { alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) {}

  // Not eligible: drop the overlay immediately and let the existing plain
  // loader fade (home.js) run completely unchanged — no animation, no
  // scroll lock, nothing else about the page's normal load behaviour changes.
  if (!isDesktop || reducedMotion || alreadyPlayed || typeof window.gsap === 'undefined') {
    removeIntro();
    return;
  }

  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}

  var wrap = document.getElementById('logoIntroWrap');
  var skipBtn = document.getElementById('logoIntroSkip');
  var main = document.querySelector('main');
  var header = document.querySelector('header');
  var heroBlock = document.querySelector('.hero-top-divider .col-md-10.col-xl-9');
  var heroEls = [header, heroBlock].filter(Boolean);

  document.documentElement.classList.add('intro-locked');

  // The real homepage needs to be visible underneath the mask cutout from
  // frame one (whatever's in the hero — photos, the gif-slot video —
  // shows through the logo shape as it zooms). main's own default
  // opacity fade (main.is-loaded, css/home.css) is bypassed via
  // .intro-skip-fade so it snaps to visible instantly instead of
  // fighting GSAP's separate hero-entrance tween below.
  if (main) main.classList.add('is-loaded', 'intro-skip-fade');

  gsap.set(wrap, { scale: START_SCALE });
  if (heroEls.length) gsap.set(heroEls, HERO_FROM);

  var skipTimer = setTimeout(function () {
    if (skipBtn) skipBtn.classList.add('is-visible');
  }, SKIP_APPEAR_DELAY * 1000);

  function finish() {
    clearTimeout(skipTimer);
    removeIntro();
  }

  var tl = gsap.timeline({ onComplete: finish });
  tl.to(wrap, { scale: 1, duration: ZOOM_DURATION, ease: ZOOM_EASE })
    .to({}, { duration: HOLD_DURATION })
    .to(intro, { opacity: 0, duration: FADE_DURATION, ease: 'power2.out' });
  if (heroEls.length) {
    tl.to(heroEls, { opacity: 1, y: 0, scale: 1, duration: FADE_DURATION, ease: 'power2.out' }, '<');
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', function () {
      tl.kill();
      if (heroEls.length) gsap.set(heroEls, { opacity: 1, y: 0, scale: 1 });
      gsap.to(intro, { opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: finish });
    });
  }
})();
