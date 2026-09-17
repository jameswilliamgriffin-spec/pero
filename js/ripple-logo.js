/* A continuous 2D wave field controls sampling position only.
   All visible colour comes from the unchanged SourceGraphic. */
(function () {
  'use strict';
  var container = document.querySelector('.footer-logo-giant');
  var img = container && container.querySelector('img');
  var displacement = document.getElementById('logo-ripple-displace');
  var waveMap = document.getElementById('logo-wave-map');
  if (!img || !displacement || !waveMap) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = document.createElement('canvas');
  // Stretched across the full (very wide) logo by the filter's feImage, so a
  // coarse map shows up as visible blocky/stepped edges once magnified —
  // 4x the pixel count of the original 192x32 to keep the wave smooth.
  canvas.width = 384;
  canvas.height = 64;
  var context = canvas.getContext('2d');
  if (!context) return;
  var field = context.createImageData(canvas.width, canvas.height);
  var duration = 550;
  var amount = 0, from = 0, target = 0, started = 0;
  var previous = 0, mapTime = -Infinity, phase = 0, frame = null;

  function drawMap() {
    for (var y = 0; y < canvas.height; y++) {
      // Cover the filter padding with the same continuous wave as the logo.
      var v = y / (canvas.height - 1) * 1.3 - 0.15;
      for (var x = 0; x < canvas.width; x++) {
        var u = x / (canvas.width - 1) * 1.3 - 0.15;
        var i = (y * canvas.width + x) * 4;
        field.data[i] = Math.round(127.5 + 48 * Math.sin(v * Math.PI + phase));
        field.data[i + 1] = Math.round(127.5 + 120 * Math.sin(u * Math.PI * 2 + phase));
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
    container.classList.remove('is-waving');
  }

  function render(now) {
    amount = sample(now);
    phase += Math.min(64, now - previous) * 0.00065;
    previous = now;
    if (target === 0 && now - started >= duration) {
      reset();
      return;
    }
    // Slow wave: refresh the map at 30fps, envelope at display refresh rate.
    if (now - mapTime >= 32) {
      drawMap();
      mapTime = now;
    }
    displacement.setAttribute('scale', (12 * amount).toFixed(3));
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
      drawMap();
      mapTime = now;
      container.classList.add('is-waving');
      frame = requestAnimationFrame(render);
    }
  }

  img.addEventListener('pointerenter', function (event) {
    if (event.pointerType === 'mouse') setTarget(1);
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
