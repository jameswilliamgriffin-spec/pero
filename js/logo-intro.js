/* ==========================================================================
   PERRO — Logo intro: "set, then placed"
   The wordmark's five real letterforms rise one by one out of their own
   baseline, like type being set. The finished word then glides into the
   exact position and size of the live hero logo (the sticky logo at
   1070px+, the fixed logo band below that) while the page assembles
   around it. On landing the real logo takes over on the same frame, so
   the intro never "disappears": it becomes the page.

   Markup: index.html (#logoIntro, letter paths inlined so there's nothing
   to fetch). Pre-paint gating + failsafe: index.html's head script. State
   CSS: css/home.css ("logo intro"). GSAP is used because the choreography
   is a set of overlapping tweens whose glide target has to be measured at
   the moment of the handoff (the sticky logo settles during load). A
   timeline expresses that directly.

   Force it for testing: add ?intro=1 to the URL. ?intro=slow also forces
   it, at 1/5 speed, for judging easing and overlap frame by frame.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     CONFIG: every timing, distance and curve lives here.
     Times are seconds. Eases are cubic-bezier control points, same format
     as CSS, so they can be lifted straight from / into home.css.
     ---------------------------------------------------------------------- */
  var CONFIG = {
    START_WIDTH: 'min(86vw, 1180px)', // size of the word while it's being set

    // Beat 1: the letters rise out of their baseline
    RISE_DELAY: 0.15,              // a breath of empty stage first
    RISE_DURATION: 0.9,
    RISE_STAGGER: 0.07,            // P → E → R → R → O
    RISE_EASE: [0.19, 1, 0.22, 1], // = --ease-standard
    RISE_SETTLE: 0.6,              // fraction of a letter's rise after which it reads
                                   // as landed (the rest is an invisible expo tail)

    HOLD: 0.18,                    // beat on the finished word, from when the last
                                   // letter reads as landed, before it moves

    // Beat 2: the word glides home into the hero logo
    GLIDE_DURATION: 1.1,
    GLIDE_EASE: [0.55, 0, 0.1, 1], // decisive departure, long soft landing

    // Beat 3: the stage drops away top-to-bottom as the word lifts off it,
    // and the hero copy follows the edge down the page
    REVEAL_AT: 0.3,                // fraction of the glide at which it begins
    STAGE_WIPE_DURATION: 0.95,
    STAGE_WIPE_EASE: [0.65, 0, 0.35, 1], // = --ease-wipe (the site's page wipe)
    COPY_DELAY: 0.12,              // copy trails the wipe edge slightly
    COPY_DURATION: 0.9,
    COPY_STAGGER: 0.06,
    COPY_RISE: 14,                 // px the hero copy travels up as it fades in
    COPY_EASE: [0.19, 1, 0.22, 1], // = --ease-standard
    COPY_SELECTOR: [
      'header .nav-item',
      '#abrir-menu',
      '#themeToggle',
      '.hero-top-divider .divider-dot',
      '.hero-top-divider .text-center'
    ].join(','),

    // Safety
    FONT_WAIT_MAX: 0.8,  // max seconds to wait for Departure Mono before handoff
    LATE_START_MAX: 2.5, // if this script starts later than this after
                         // navigation, skip straight to the page
    FAILSAFE: 6          // hard cap: the intro always ends by this point
  };

  var SESSION_KEY = 'perro-intro-played';
  var LOGO_ASPECT = 106.5 / 622.69; // logo SVG viewBox height / width

  var root = document.documentElement;
  var intro = document.getElementById('logoIntro');
  if (!intro) return;

  function removeIntro() {
    if (intro.parentNode) intro.parentNode.removeChild(intro);
  }

  // Not selected by the head script (repeat visit, reduced motion, arrival
  // via page wipe): nothing to do but drop the markup.
  if (root.getAttribute('data-intro') !== 'pending') {
    removeIntro();
    return;
  }

  // Can't animate, or the visitor has already been looking at a blank stage
  // for too long: hand straight over to the normal page load.
  if (typeof window.gsap === 'undefined' ||
      (window.performance && performance.now() > CONFIG.LATE_START_MAX * 1000)) {
    root.removeAttribute('data-intro');
    removeIntro();
    return;
  }

  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}

  var SPEED = /[?&]intro=slow(&|$)/.test(location.search) ? 0.2 : 1;
  gsap.globalTimeline.timeScale(SPEED);

  var mark =document.getElementById('logoIntroMark');
  var stage = intro.querySelector('.logo-intro__stage');
  var letters = intro.querySelectorAll('.logo-intro__letter');
  var main = document.querySelector('main');
  var loader = document.querySelector('.loader-component');

  root.setAttribute('data-intro', 'rising');

  /* ----------------------------------------------------------------------
     Page lock: no scroll, no focus, no clicks until the intro is done.
     Scroll lock itself is CSS (html[data-intro]); inert covers keyboard and
     pointer. The intro is aria-hidden, so screen readers skip it and
     simply land on the page once inert lifts.
     ---------------------------------------------------------------------- */
  var inerted = [];
  Array.prototype.forEach.call(document.body.children, function (el) {
    if (el === intro || el.tagName === 'SCRIPT' || el.inert) return;
    el.inert = true;
    inerted.push(el);
  });

  // The intro is a fresh landing: start at the top, and stop the browser
  // restoring an old scroll position from under it on reload.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // The page underneath is shown as-is (no load fade of its own) because
  // the intro is what reveals it. Pre-empt home.js's generic loader.
  if (main) main.classList.add('is-loaded');
  if (loader) loader.classList.add('is-hidden');

  /* ----------------------------------------------------------------------
     Helpers
     ---------------------------------------------------------------------- */

  // cubic-bezier(x1, y1, x2, y2) as a GSAP ease, so the motion can use the
  // site's own CSS curves exactly. Newton-Raphson, with bisection fallback.
  function bezier(p) {
    var x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    function curve(t, a, b) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; }
    function slope(t, a, b) { var u = 1 - t; return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i;
      for (i = 0; i < 8; i++) {
        var err = curve(t, x1, x2) - x;
        var s = slope(t, x1, x2);
        if (Math.abs(err) < 1e-6 || Math.abs(s) < 1e-6) break;
        t -= err / s;
      }
      if (t < 0 || t > 1 || Math.abs(curve(t, x1, x2) - x) > 1e-4) {
        var lo = 0, hi = 1;
        for (i = 0, t = x; i < 30; i++) {
          var c = curve(t, x1, x2);
          if (Math.abs(c - x) < 1e-6) break;
          if (c < x) lo = t; else hi = t;
          t = (lo + hi) / 2;
        }
      }
      return curve(t, y1, y2);
    };
  }

  function isRendered(el) {
    return !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0;
  }

  // The live hero logo at this breakpoint. Its height is derived from its
  // width rather than read, since the <img> may not have decoded yet.
  function heroLogoRect() {
    var candidates = document.querySelectorAll('.pr-perro-logo, .mobile-logo-bleed-img');
    for (var i = 0; i < candidates.length; i++) {
      if (!isRendered(candidates[i])) continue;
      var r = candidates[i].getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.width * LOGO_ASPECT };
    }
    return null;
  }

  var fontsReady = Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise(function (resolve) { setTimeout(resolve, CONFIG.FONT_WAIT_MAX * 1000); })
  ]);

  /* ----------------------------------------------------------------------
     Finish: shared by the normal ending and the failsafe.
     ---------------------------------------------------------------------- */
  var finished = false;
  var failsafe = setTimeout(finish, CONFIG.FAILSAFE * 1000 / SPEED);
  var copy = [];
  var timelines = [];

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    // Kill the timelines themselves (not just their tweens) so no queued
    // callback can re-set data-intro after the page has been handed back.
    timelines.forEach(function (t) { t.kill(); });
    gsap.globalTimeline.timeScale(1);
    if (copy.length) gsap.set(copy, { clearProps: 'opacity,transform' });
    root.removeAttribute('data-intro');
    removeIntro();
    inerted.forEach(function (el) { el.inert = false; });
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  }

  /* ----------------------------------------------------------------------
     Beat 1: set the type
     ---------------------------------------------------------------------- */
  mark.style.width = CONFIG.START_WIDTH;

  copy = Array.prototype.filter.call(document.querySelectorAll(CONFIG.COPY_SELECTOR), isRendered);
  gsap.set(copy, { opacity: 0, y: CONFIG.COPY_RISE });

  // Park every letter just below the SVG's bottom edge. The SVG clips its
  // own overflow, so each one is invisible until it rises past the baseline.
  gsap.set(letters, { y: 110 });
  mark.classList.add('is-ready');

  var rise = gsap.timeline({ delay: CONFIG.RISE_DELAY });
  timelines.push(rise);
  rise.to(letters, {
    y: 0,
    duration: CONFIG.RISE_DURATION,
    ease: bezier(CONFIG.RISE_EASE),
    stagger: CONFIG.RISE_STAGGER
  });

  // The glide is cued from when the last letter *reads* as landed, not from
  // when its tween technically ends: an expo-out spends its final 40% moving
  // sub-pixel amounts, and waiting that out reads as dead air.
  var settledAt = (letters.length - 1) * CONFIG.RISE_STAGGER + CONFIG.RISE_DURATION * CONFIG.RISE_SETTLE;
  var risen = new Promise(function (resolve) { rise.call(resolve, null, settledAt); });

  Promise.all([risen, fontsReady]).then(function () {
    if (!finished) timelines.push(gsap.delayedCall(CONFIG.HOLD, handoff));
  });

  /* ----------------------------------------------------------------------
     Beats 2 + 3: glide home while the page assembles around it
     ---------------------------------------------------------------------- */
  function handoff() {
    if (finished) return;

    var from = mark.getBoundingClientRect();
    var to = heroLogoRect();
    var revealAt = CONFIG.GLIDE_DURATION * CONFIG.REVEAL_AT;
    var tl = gsap.timeline({ onComplete: finish });
    timelines.push(tl);

    if (to) {
      tl.to(mark, {
        x: (to.left + to.width / 2) - (from.left + from.width / 2),
        y: (to.top + to.height / 2) - (from.top + from.height / 2),
        scale: to.width / from.width,
        duration: CONFIG.GLIDE_DURATION,
        ease: bezier(CONFIG.GLIDE_EASE),
        force3D: true
      }, 0);

      // Landing: the real logo appears and the intro's copy of it goes, on
      // the same frame, at the same position and size.
      tl.call(function () {
        root.setAttribute('data-intro', 'landed');
        mark.style.visibility = 'hidden';
      }, null, CONFIG.GLIDE_DURATION);
    } else {
      // No hero logo on screen (shouldn't happen): let the word go with the
      // stage instead of gliding to nothing.
      tl.to(mark, {
        opacity: 0,
        duration: CONFIG.STAGE_WIPE_DURATION,
        ease: bezier(CONFIG.STAGE_WIPE_EASE)
      }, revealAt);
      tl.call(function () { root.setAttribute('data-intro', 'landed'); }, null, revealAt);
    }

    // Release the site's scroll-in reveals so they play as part of this.
    tl.call(function () {
      if (root.getAttribute('data-intro') === 'rising') root.setAttribute('data-intro', 'handoff');
    }, null, revealAt);

    // The stage drops away from the top edge down, a hard edge in the same
    // curve as the site's page wipe. The word is on its own layer above it,
    // so it lifts off the stage rather than being wiped with it.
    tl.fromTo(stage,
      { clipPath: 'inset(0% 0% 0% 0%)' },
      {
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: CONFIG.STAGE_WIPE_DURATION,
        ease: bezier(CONFIG.STAGE_WIPE_EASE)
      }, revealAt);

    if (copy.length) {
      tl.to(copy, {
        opacity: 1,
        y: 0,
        duration: CONFIG.COPY_DURATION,
        ease: bezier(CONFIG.COPY_EASE),
        stagger: CONFIG.COPY_STAGGER,
        clearProps: 'opacity,transform'
      }, revealAt + CONFIG.COPY_DELAY);
    }
  }
})();
