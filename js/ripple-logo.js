/* A localised ripple that follows the cursor, rather than an ambient wave
   across the whole wordmark — kept subtle: short reach, low amplitude, a
   touch of chromatic aberration at the peak. All visible colour still
   comes from the unchanged SourceGraphic; this only ever displaces and
   fringes it. */
(function () {
  'use strict';
  var container = document.querySelector('.footer-logo-giant');
  var img = container && container.querySelector('img');
  var displacement = document.getElementById('logo-ripple-displace');
  var waveMap = document.getElementById('logo-wave-map');
  var rOffset = document.getElementById('logo-ripple-r-offset');
  var bOffset = document.getElementById('logo-ripple-b-offset');
  if (!img || !displacement || !waveMap || !rOffset || !bOffset) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 64;
  var context = canvas.getContext('2d');
  if (!context) return;
  var field = context.createImageData(canvas.width, canvas.height);

  var MAX_SCALE = 6;     // displacement strength, kept low for subtlety
  var MAX_FRINGE = 2.2;  // chromatic aberration reach, in px, at full strength
  var RADIUS = 0.3;      // ripple's reach as a fraction of the logo's width
  var duration = 420;

  var amount = 0, from = 0, target = 0, started = 0;
  var previous = 0, mapTime = -Infinity, phase = 0, frame = null;
  var cx = 0.5, cy = 0.5; // cursor position, normalised to the logo's own box
  var aspect = 1;

  function updateAspect() {
    var rect = img.getBoundingClientRect();
    if (rect.width && rect.height) aspect = rect.width / rect.height;
  }

  function setCursorFromEvent(event) {
    var rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cx = (event.clientX - rect.left) / rect.width;
    cy = (event.clientY - rect.top) / rect.height;
  }

  function drawMap() {
    var w = canvas.width, h = canvas.height;
    for (var y = 0; y < h; y++) {
      var v = y / (h - 1);
      for (var x = 0; x < w; x++) {
        var u = x / (w - 1);
        var dx = u - cx;
        // Corrected for the logo's own aspect ratio so the ripple reads as
        // a circle expanding from the cursor, not an oval stretched to
        // match the wordmark's own very wide, short shape.
        var dy = (v - cy) / aspect;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var falloff = Math.max(0, 1 - dist / RADIUS);
        falloff = falloff * falloff * (3 - 2 * falloff); // smoothstep
        var ripple = Math.sin(dist * 34 - phase) * falloff;
        var nx = dist > 0.0001 ? dx / dist : 0;
        var ny = dist > 0.0001 ? dy / dist : 0;
        var i = (y * w + x) * 4;
        field.data[i] = Math.round(127.5 + 90 * ripple * nx);
        field.data[i + 1] = Math.round(127.5 + 90 * ripple * ny);
        field.data[i + 2] = 128;
        field.data[i + 3] = 255;
      }
    }
    context.putImageData(field, 0, 0);
    waveMap.setAttribute('href', canvas.toDataURL());
  }

  function sample(now) {
    var t = Math.min(1, (now - started) / duration);
    return from + (target - from) * t * t * (3 - 2 * t);
  }

  function reset() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    amount = from = target = 0;
    displacement.setAttribute('scale', '0');
    rOffset.setAttribute('dx', '0');
    bOffset.setAttribute('dx', '0');
    container.classList.remove('is-waving');
  }

  function render(now) {
    amount = sample(now);
    phase += Math.min(64, now - previous) * 0.006;
    previous = now;
    if (target === 0 && now - started >= duration) {
      reset();
      return;
    }
    if (now - mapTime >= 32) {
      drawMap();
      mapTime = now;
    }
    displacement.setAttribute('scale', (MAX_SCALE * amount).toFixed(3));
    var fringe = MAX_FRINGE * amount;
    rOffset.setAttribute('dx', fringe.toFixed(3));
    bOffset.setAttribute('dx', (-fringe).toFixed(3));
    frame = requestAnimationFrame(render);
  }

  function setTarget(value) {
    if (reducedMotion.matches || target === value) return;
    var now = performance.now();
    from = frame === null ? amount : sample(now);
    target = value;
    started = now;
    if (frame === null) {
      previous = now;
      updateAspect();
      drawMap();
      mapTime = now;
      container.classList.add('is-waving');
      frame = requestAnimationFrame(render);
    }
  }

  img.addEventListener('pointerenter', function (event) {
    if (event.pointerType !== 'mouse') return;
    updateAspect();
    setCursorFromEvent(event);
    setTarget(1);
  });
  img.addEventListener('pointermove', function (event) {
    if (event.pointerType !== 'mouse') return;
    setCursorFromEvent(event);
  });
  img.addEventListener('pointerleave', function () { setTarget(0); });
  img.addEventListener('pointercancel', function () { setTarget(0); });
  window.addEventListener('blur', function () { setTarget(0); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) reset();
  });
  reducedMotion.addEventListener('change', function () {
    reset();
    if (!reducedMotion.matches && img.matches(':hover')) setTarget(1);
  });
})();
