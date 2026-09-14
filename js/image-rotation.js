/* ==========================================================================
   HOMEPAGE IMAGE ROTATION
   Desktop only. Each image position on the page (the food-image grid tiles,
   NOT the animated GIF) independently cycles through the other available
   shots in the manifest, crossfading between two stacked <img> layers.

   - Positions never change in sync: each gets its own staggered start time.
   - A position only pulls from images of its own orientation (the portrait
     tile draws from portrait/, the landscape tiles from landscape/).
   - Before swapping, a position checks every OTHER currently-visible
     position and skips/rerolls a candidate if it's that shot's paired
     crop (same pairGroup) or the exact same file, so two positions never
     show the same source photo at once.
   - The next image is preloaded (a real Image() load) before the crossfade
     starts, so there is never a blank/loading flash mid-transition.

   Tunables ---------------------------------------------------------------- */
var IMG_ROTATE_INTERVAL_MS = 30000; // how often one position swaps, once started
var IMG_ROTATE_STAGGER_MS  = 10000; // gap between each position's first swap
var IMG_ROTATE_INITIAL_MS  = 10000; // first position's first swap, after page load
var IMG_ROTATE_FADE_MS     = 1200;  // crossfade duration
var IMG_ROTATE_MANIFEST    = 'assets/images/rotation/manifest.json';
var IMG_ROTATE_MIN_WIDTH   = '(min-width: 768px)'; // matches the desktop grid breakpoint
/* -------------------------------------------------------------------------- */

(function () {
  'use strict';

  var positions = Array.prototype.slice.call(document.querySelectorAll('[data-rotate-orientation]'));
  if (!positions.length) return;

  document.documentElement.style.setProperty('--rotate-fade-ms', IMG_ROTATE_FADE_MS + 'ms');

  fetch(IMG_ROTATE_MANIFEST)
    .then(function (res) { return res.json(); })
    .then(start)
    .catch(function () { /* no manifest, no rotation — the static images stay put */ });

  function start(manifest) {
    var pools = { portrait: [], landscape: [] };
    manifest.forEach(function (entry) {
      if (pools[entry.orientation]) pools[entry.orientation].push(entry);
    });

    var controllers = positions.map(function (el, index) {
      return createController(el, pools[el.getAttribute('data-rotate-orientation')] || [], index);
    });

    var mq = window.matchMedia(IMG_ROTATE_MIN_WIDTH);
    function sync() {
      controllers.forEach(function (c) { if (mq.matches) c.start(); else c.stop(); });
    }
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
  }

  function createController(el, pool, index) {
    var layers = Array.prototype.slice.call(el.querySelectorAll('.rotate-layer'));
    if (layers.length < 2 || !pool.length) return { start: function () {}, stop: function () {} };

    var visible = el.querySelector('.rotate-layer.is-visible') || layers[0];
    var hidden = visible === layers[0] ? layers[1] : layers[0];
    var currentFile = el.getAttribute('data-rotate-file') || '';
    var currentPairGroup = el.getAttribute('data-rotate-pairgroup') || '';
    var queue = shuffled(pool);
    var timeoutId = null;
    var intervalId = null;

    function otherPositions() {
      return positions.filter(function (p) { return p !== el; });
    }

    function collides(candidate) {
      return otherPositions().some(function (p) {
        var file = p.getAttribute('data-rotate-file');
        var group = p.getAttribute('data-rotate-pairgroup');
        if (file && file === candidate.file) return true;
        if (candidate.pairGroup && group && group === candidate.pairGroup) return true;
        return false;
      });
    }

    function nextCandidate() {
      var attempts = 0;
      var maxAttempts = pool.length * 3;
      while (attempts < maxAttempts) {
        attempts++;
        if (!queue.length) queue = shuffled(pool);
        var candidate = queue.shift();
        if (candidate.file === currentFile) continue;
        if (collides(candidate)) continue;
        return candidate;
      }
      return null;
    }

    function swap() {
      var next = nextCandidate();
      if (!next) return;

      var preload = new Image();
      preload.onload = function () { applySwap(next); };
      preload.onerror = function () { /* skip this candidate, try again next tick */ };
      preload.src = next.path;
    }

    function applySwap(entry) {
      hidden.src = entry.path;
      hidden.alt = entry.alt || '';
      // Force layout so the opacity transition below actually animates
      // instead of jumping straight to its end state.
      void hidden.offsetWidth;
      hidden.classList.add('is-visible');
      visible.classList.remove('is-visible');

      var swapTmp = visible;
      visible = hidden;
      hidden = swapTmp;

      currentFile = entry.file;
      currentPairGroup = entry.pairGroup || '';
      el.setAttribute('data-rotate-file', currentFile);
      el.setAttribute('data-rotate-pairgroup', currentPairGroup);
    }

    return {
      start: function () {
        if (timeoutId || intervalId) return;
        var delay = IMG_ROTATE_INITIAL_MS + index * IMG_ROTATE_STAGGER_MS;
        timeoutId = setTimeout(function () {
          timeoutId = null;
          swap();
          intervalId = setInterval(swap, IMG_ROTATE_INTERVAL_MS);
        }, delay);
      },
      stop: function () {
        if (timeoutId) clearTimeout(timeoutId);
        if (intervalId) clearInterval(intervalId);
        timeoutId = null;
        intervalId = null;
      }
    };
  }

  function shuffled(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
})();
