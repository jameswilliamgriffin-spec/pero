/* ==========================================================================
   PERRO — Homepage behavior
   Loader fade, mobile submenu, hover text scramble, static image tabs,
   footer-pinned sticky logo, scroll-in reveals and the idle ASCII flame
   easter egg.
   ========================================================================== */

(function () {
  'use strict';

  var LG = 1070;
  var PAGE_WIPE_KEY = 'perro-page-wipe';
  var arrivingFromWipe = false;
  try {
    var arrival = JSON.parse(sessionStorage.getItem(PAGE_WIPE_KEY) || 'null');
    arrivingFromWipe = !!arrival && arrival.url === location.href &&
      Date.now() - arrival.time < 15000;
    sessionStorage.removeItem(PAGE_WIPE_KEY);
  } catch (e) {}

  /* ----------------------------------------
     LOADER
     ---------------------------------------- */

  function revealPage() {
    var loader = document.querySelector('.loader-component');
    var main = document.querySelector('main');
    if (loader) loader.classList.add('is-hidden');
    if (main) main.classList.add('is-loaded');
  }
  // After the outgoing wipe, show the destination without a second loader.
  if (arrivingFromWipe) {
    document.documentElement.classList.add('page-wipe-arrival');
    revealPage();
  }
  window.addEventListener('load', function () {
    if (!arrivingFromWipe) setTimeout(revealPage, 600);
  });

  /* ----------------------------------------
     HEADER HEIGHT — keeps the fixed logo band (and main's clearance
     padding) pinned exactly under the fixed header at every breakpoint,
     since the header's own height changes with the responsive nav.
     ---------------------------------------- */

  var headerEl = document.querySelector('header');
  function setHeaderHeight() {
    if (!headerEl) return;
    document.documentElement.style.setProperty('--header-h', headerEl.getBoundingClientRect().height + 'px');
  }
  setHeaderHeight();
  window.addEventListener('load', setHeaderHeight);
  window.addEventListener('resize', debounce(setHeaderHeight, 200));

  /* ----------------------------------------
     THEME TOGGLE — dark (default) / light, persisted
     ---------------------------------------- */

  var THEME_KEY = 'perro-theme';
  var LOGO_DARK = 'assets/images/perro-logo-lime.svg';
  var LOGO_LIGHT = 'assets/images/perro-logo.svg';
  var BG_DARK = '#1C1917';
  var BG_LIGHT = '#B2C703';
  var themeToggle = document.getElementById('themeToggle');
  var heroLogo = document.querySelector('.pr-perro-logo');
  var asciiLogo = document.querySelector('.ascii-idle-logo');
  var mobileLogo = document.querySelector('.mobile-logo-bleed-img');
  var footerLogo = document.querySelector('.footer-logo-giant img');
  var themeOverlay = document.querySelector('.theme-transition-overlay');
  var themeAnimating = false;
  var pageNavigating = false;
  var cancelWipe = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeToggle) themeToggle.setAttribute('aria-label', 'Switch to dark mode');
      if (heroLogo) heroLogo.src = LOGO_LIGHT;
      if (asciiLogo) asciiLogo.src = LOGO_LIGHT;
      if (mobileLogo) mobileLogo.src = LOGO_LIGHT;
      /* the footer's own background is the inverse of the site's, so its
         logo needs the inverse logo too */
      if (footerLogo) footerLogo.src = LOGO_DARK;
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeToggle) themeToggle.setAttribute('aria-label', 'Switch to light mode');
      if (heroLogo) heroLogo.src = LOGO_DARK;
      if (asciiLogo) asciiLogo.src = LOGO_DARK;
      if (mobileLogo) mobileLogo.src = LOGO_DARK;
      if (footerLogo) footerLogo.src = LOGO_LIGHT;
    }
  }

  function resetOverlay() {
    themeOverlay.classList.add('no-transition');
    themeOverlay.classList.remove('is-active');
    void themeOverlay.offsetHeight;
    themeOverlay.classList.remove('no-transition');
  }

  function runWipe(colour, complete) {
    if (!themeOverlay || reducedMotion.matches) {
      complete();
      return;
    }
    themeOverlay.style.background = colour;
    resetOverlay();
    var finished = false;
    var fallback;
    var firstFrame;
    var secondFrame;
    function cleanup() {
      clearTimeout(fallback);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      themeOverlay.removeEventListener('transitionend', onRiseEnd);
      cancelWipe = null;
    }
    function finish() {
      if (finished) return;
      finished = true;
      cleanup();
      complete();
    }
    function onRiseEnd(event) {
      if (event.target !== themeOverlay || event.propertyName !== 'height') return;
      if (!themeOverlay.classList.contains('is-active')) return;
      finish();
    }
    cancelWipe = function () { finished = true; cleanup(); };
    themeOverlay.addEventListener('transitionend', onRiseEnd);
    // Never strand navigation if a transition event is cancelled or suppressed.
    fallback = setTimeout(finish, 900);
    firstFrame = requestAnimationFrame(function () {
      secondFrame = requestAnimationFrame(function () {
        themeOverlay.classList.add('is-active');
      });
    });
  }

  function switchTheme(next) {
    if (themeAnimating || pageNavigating) return;
    themeAnimating = true;
    if (themeToggle) themeToggle.disabled = true;
    runWipe(next === 'light' ? BG_LIGHT : BG_DARK, function () {
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      if (themeOverlay) resetOverlay();
      themeAnimating = false;
      if (themeToggle) themeToggle.disabled = false;
    });
  }

  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      switchTheme(next);
    });
  }

  /* Internal page links share the theme wipe without changing the theme. */
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') ||
        (link.target && link.target !== '_self') || link.hasAttribute('data-toggle')) return;
    var destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin ||
        !(/\.html$|\/$/i).test(destination.pathname) ||
        (destination.pathname === location.pathname && destination.search === location.search)) return;
    event.preventDefault();
    if (pageNavigating || themeAnimating) return;
    pageNavigating = true;
    if (themeToggle) themeToggle.disabled = true;
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    runWipe(light ? BG_DARK : BG_LIGHT, function () {
      try {
        sessionStorage.setItem(PAGE_WIPE_KEY, JSON.stringify({
          url: destination.href, time: Date.now()
        }));
      } catch (e) {}
      location.assign(destination.href);
    });
  });

  // A back/forward-cache restore must not retain the outgoing full-screen wipe.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    if (cancelWipe) cancelWipe();
    if (themeOverlay) resetOverlay();
    themeAnimating = pageNavigating = false;
    if (themeToggle) themeToggle.disabled = false;
    revealPage();
  });

  /* ----------------------------------------
     [data-toggle="show"] — mobile submenu open/close
     ---------------------------------------- */

  var menuButton = document.getElementById('abrir-menu');
  var mobileMenu = document.getElementById('submenu');

  function setMenuOpen(open) {
    if (!menuButton || !mobileMenu) return;
    document.querySelectorAll(menuButton.getAttribute('data-target')).forEach(function (el) {
      el.classList.toggle('show', open);
    });
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileMenu.inert = !open;
  }
  if (menuButton && mobileMenu) setMenuOpen(mobileMenu.classList.contains('show'));

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-toggle="show"]');
    if (!trigger) return;
    if (trigger.tagName === 'A') event.preventDefault();

    var selector = trigger.getAttribute('data-target');
    if (!selector) return;
    if (mobileMenu && document.querySelectorAll(selector).length &&
        Array.prototype.includes.call(document.querySelectorAll(selector), mobileMenu)) {
      setMenuOpen(!mobileMenu.classList.contains('show'));
      return;
    }
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.toggle('show');
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('show')) {
      setMenuOpen(false);
      menuButton.focus();
    }
  });
  var menuDesktop = window.matchMedia('(min-width: 768px)');
  menuDesktop.addEventListener('change', function (event) {
    if (event.matches) setMenuOpen(false);
  });

  /* ----------------------------------------
     .ch-txt — leet scramble on hover, restore on leave
     ---------------------------------------- */

  var scrambleRules = [
    { regex: /a|á/i, replacement: '4' },
    { regex: /i|í/, replacement: '1' },
    { regex: /I|Í/, replacement: '1' },
    { regex: /e|é/, replacement: '3' },
    { regex: /o|ó/, replacement: Math.random() < 0.5 ? '*' : '#' },
    { regex: /s|z/, replacement: '$' }
  ];

  document.addEventListener('mouseenter', function (event) {
    var el = event.target instanceof Element && event.target.closest('.ch-txt');
    if (!el) return;

    var original = el.textContent.trim();
    el.dataset.originalText = original;

    var maxSwaps = Math.floor(Math.random() * 3) + 1;
    var count = 0;
    var words = original.split(' ');

    for (var i = 0; i < words.length && count < maxSwaps; i++) {
      var indices = words[i].split('').map(function (_, k) { return k; })
        .sort(function () { return Math.random() - 0.5; });

      for (var j = 0; j < scrambleRules.length && count < maxSwaps; j++) {
        for (var k = 0; k < indices.length; k++) {
          var idx = indices[k];
          var rule = scrambleRules[j];
          if (rule.regex.test(words[i][idx])) {
            count++;
            words[i] = words[i].substring(0, idx) +
              words[i].substring(idx).replace(rule.regex, rule.replacement);
            break;
          }
        }
      }
    }
    el.textContent = words.join(' ');
  }, true);

  document.addEventListener('mouseleave', function (event) {
    var el = event.target instanceof Element && event.target.closest('.ch-txt');
    if (!el || el.dataset.originalText === undefined) return;
    el.textContent = el.dataset.originalText;
  }, true);

  /* ----------------------------------------
     SCROLL-IN REVEALS (.animate-on-scroll / .zoom-out)
     ---------------------------------------- */

  var revealTargets = document.querySelectorAll('.animate-on-scroll, .zoom-out');
  if ('IntersectionObserver' in window && revealTargets.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('animate'); });
  }

  /* The old auto-cycling mobile slider (toggling .is-active between the 3
     desktop grid tiles) has been replaced by the swipeable galleries in
     js/mobile-image-slider.js — .mobile-slider is now display:none on
     mobile, so there's nothing left here to cycle. */

  /* ----------------------------------------
     STICKY LOGO — pins lower once the footer comes into view
     ---------------------------------------- */

  var footerEl = document.querySelector('footer');
  var logoSticky = document.querySelector('.sticky-home');
  var logoImg = document.querySelector('.pr-perro-logo');

  if (footerEl && logoSticky && 'IntersectionObserver' in window) {
    var footerObserver = new IntersectionObserver(function (entries) {
      var entry = entries[0];
      if (entry.intersectionRatio < 0.8) {
        logoSticky.classList.add('is-pinned');
      } else {
        logoSticky.classList.remove('is-pinned');
      }
    }, { threshold: [0.8] });
    footerObserver.observe(footerEl);
  }

  /* Park the sticky hero logo just above the footer map strip. */
  function setFooterHeight() {
    if (window.innerWidth < LG || !logoImg || !footerEl) return;
    logoImg.style.marginBottom = (footerEl.offsetHeight + 100) + 'px';
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  window.addEventListener('load', function () {
    setTimeout(setFooterHeight, 300);
  });
  window.addEventListener('resize', debounce(setFooterHeight, 200));

  /* ----------------------------------------
     IDLE ASCII FLAME — appears 15s after the window loses focus
     ---------------------------------------- */

  var flameContainer = document.querySelector('.container-pre');
  var flamePre = document.querySelector('.ascii-idle');
  var flameStarted = false;
  var flameRafId = null;
  var idleTimeoutId = null;

  function startFlame() {
    if (!flamePre || flameStarted) return;
    flameStarted = true;

    var RAMP = ' ...::/\\/\\/\\+=*perRO01#';
    var FPS = 30;
    var frameInterval = 1000 / FPS;
    var lastTime = 0;

    var cellW = 8.4, cellH = 14, cols, rows, heat;
    var maxHeat = RAMP.length - 1;

    /* Re-measure the monospace cell so the grid always fills the full
       container width — covers a font-swap after first measurement
       (font-display: swap) and a window resize while the flame is up. */
    function measure() {
      var probe = document.createElement('span');
      probe.textContent = 'XXXXXXXXXX';
      probe.style.visibility = 'hidden';
      flamePre.appendChild(probe);
      var rect = probe.getBoundingClientRect();
      flamePre.removeChild(probe);
      if (rect.width > 0) {
        cellW = rect.width / 10;
        cellH = rect.height || cellH;
      }
      cols = Math.max(10, Math.floor(flamePre.clientWidth / cellW));
      rows = Math.max(10, Math.floor(flamePre.clientHeight / cellH));
      heat = new Array(cols * rows).fill(0);
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 200);
    });

    function step(time) {
      flameRafId = requestAnimationFrame(step);
      if (time - lastTime < frameInterval) return;
      lastTime = time;

      /* seed the bottom row */
      for (var x = 0; x < cols; x++) {
        var edge = Math.sin(time / 900 + x / 7) * 0.25 + 0.75;
        heat[(rows - 1) * cols + x] =
          Math.random() < edge ? maxHeat : Math.floor(maxHeat * Math.random());
      }

      /* propagate upward with decay and sideways drift */
      for (var y = 0; y < rows - 1; y++) {
        for (var x2 = 0; x2 < cols; x2++) {
          var drift = Math.floor(Math.random() * 3) - 1;
          var srcX = Math.min(cols - 1, Math.max(0, x2 + drift));
          var below = heat[(y + 1) * cols + srcX];
          var decay = Math.floor(Math.random() * 3);
          heat[y * cols + x2] = Math.max(0, below - decay);
        }
      }

      var out = '';
      for (var y2 = 0; y2 < rows; y2++) {
        for (var x3 = 0; x3 < cols; x3++) {
          out += RAMP[heat[y2 * cols + x3]];
        }
        out += '\n';
      }
      flamePre.textContent = out;
    }

    flameRafId = requestAnimationFrame(step);
  }

  function showFlame() {
    if (!flameContainer) return;
    var idleLogo = document.querySelector('.ascii-idle-logo');
    if (idleLogo) {
      document.documentElement.style.setProperty('--idle-logo-h', idleLogo.getBoundingClientRect().height + 'px');
    }
    flameContainer.classList.add('show');
    if (themeToggle) themeToggle.classList.add('is-hidden');
    setTimeout(startFlame, 500);
  }

  function resetIdleTimeout(time) {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(showFlame, time);
  }

  if (flameContainer) {
    document.addEventListener('click', function (event) {
      if (event.target.closest('.container-pre')) {
        flameContainer.classList.remove('show');
        if (themeToggle) themeToggle.classList.remove('is-hidden');
      }
    });
    window.addEventListener('blur', function () { resetIdleTimeout(15000); });
    window.addEventListener('focus', function () {
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
    });
  }

  /* ----------------------------------------
     CONSOLE STAMP
     ---------------------------------------- */

  console.log([
    '..........................................',
    '..........................................',
    '.#####...######..#####...#####....####....',
    '.##..##..##......##..##..##..##..##..##...',
    '.#####...####....#####...#####...##..##...',
    '.##......##......##..##..##..##..##..##...',
    '.##......######..##..##..##..##...####....',
    '..........................................'
  ].join('\n'));

})();
