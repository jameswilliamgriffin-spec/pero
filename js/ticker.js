/* ==========================================================================
   PERRO — Status ticker
   Marquee bar above the footer combining now-playing, kitchen status
   (getKitchenStatus, kitchen-status.js) and weather (getWeatherStatus,
   weather-status.js). Renders the repeating unit into #tickerTrack and
   drives a CSS transform loop — this file never re-derives kitchen/weather
   logic itself, it only consumes the two existing modules.
   ========================================================================== */

(function () {
  'use strict';

  /* Static placeholder — swap the fetch that populates this for a real
     Spotify "currently playing" call later; the template below doesn't
     need to change, just where `nowPlaying` comes from. */
  var nowPlaying = {
    artist: 'Antony and the Johnsons',
    track: 'Kiss My Name'
  };

  var PX_PER_SECOND = 55; // shared by all three tickers, so they move at one pace
  var MIN_REPEATS = 4;

  var track = document.getElementById('tickerTrack');

  /* Menu/book link tickers (.link-ticker__track): each ships one unit in
     the HTML; capture it once so re-renders always repeat the original. */
  var linkTracks = Array.prototype.map.call(
    document.querySelectorAll('.link-ticker__track'),
    function (el) { return { el: el, unitHTML: el.innerHTML }; }
  );

  if (!track && !linkTracks.length) return;

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function buildUnitHTML() {
    var kitchenStatus = (typeof getKitchenStatus === 'function') ? getKitchenStatus() : '';
    var weather = (typeof getWeatherStatus === 'function') ? getWeatherStatus() : null;

    var html = '';

    html += '<span class="ticker-unit">';
    html += '<span class="ticker-play" aria-hidden="true">▶</span>';
    html += '<span>Now playing: ' + escapeHTML(nowPlaying.artist) + ' – ' + escapeHTML(nowPlaying.track) + '</span>';
    html += '</span>';

    if (kitchenStatus) {
      html += '<span class="ticker-unit">';
      html += '<span class="ticker-dot" aria-hidden="true"></span>';
      html += '<span>Kitchen status: ' + escapeHTML(kitchenStatus) + '</span>';
      html += '</span>';
    }

    if (weather) {
      html += '<span class="ticker-unit">';
      html += '<span class="ticker-dot ticker-dot--static" aria-hidden="true"></span>';
      html += '<span>Kings Heath: ' + escapeHTML(weather) + '</span>';
      html += '</span>';
    }

    return html;
  }

  function measureWidth(el, html) {
    var probe = document.createElement('div');
    probe.className = el.className;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.animation = 'none';
    probe.innerHTML = html;
    document.body.appendChild(probe);
    var width = probe.scrollWidth;
    document.body.removeChild(probe);
    return width;
  }

  function fillTrack(el, unitHTML, pxPerSecond) {
    var unitWidth = measureWidth(el, unitHTML) || 300;

    /* Repeat the unit until one "half" comfortably exceeds twice the
       viewport width, then duplicate that half once more — animating
       exactly -50% loops seamlessly since copy 2 always lands where
       copy 1 started (and the same holds run in reverse). */
    var targetWidth = window.innerWidth * 2;
    var repeats = Math.max(MIN_REPEATS, Math.ceil(targetWidth / unitWidth));

    var half = '';
    for (var i = 0; i < repeats; i++) half += unitHTML;
    el.innerHTML = half + half;

    requestAnimationFrame(function () {
      var halfWidth = el.scrollWidth / 2;
      el.style.animationDuration = (halfWidth / pxPerSecond) + 's';
    });
  }

  function renderStatus() {
    if (track) fillTrack(track, buildUnitHTML(), PX_PER_SECOND);
  }

  function renderLinks() {
    linkTracks.forEach(function (t) { fillTrack(t.el, t.unitHTML, PX_PER_SECOND); });
  }

  renderStatus();
  renderLinks();
  // Departure Mono may land after first render; re-measure once it has so
  // the loop width matches the real glyph widths.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { renderStatus(); renderLinks(); });
  }

  if (typeof subscribeKitchenStatus === 'function') subscribeKitchenStatus(renderStatus);
  if (typeof subscribeWeatherStatus === 'function') subscribeWeatherStatus(renderStatus);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderStatus(); renderLinks(); }, 200);
  });
})();
