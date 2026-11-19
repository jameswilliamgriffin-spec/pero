/* ==========================================================================
   PERRO — Status ticker
   Marquee bar above the footer combining now-playing, kitchen status
   (getKitchenStatus, kitchen-status.js) and weather (getWeatherStatus,
   weather-status.js). Renders the repeating unit into #tickerTrack and
   drives a CSS transform loop — this file never re-derives kitchen/weather
   logic itself, it only consumes the two existing modules.

   Now playing comes from GET /api/now-playing (server.js), which returns
   the Spotify track playing now, else one played recently, else a random
   pick from the house playlist. It's only requested, and only shown,
   while the kitchen status is one of OPEN_STATUSES (everything but Siesta).
   ========================================================================== */

(function () {
  'use strict';

  /* Kitchen statuses when the now-playing item is shown (from prep at 09:00
     until closing, Tue–Sat). On Siesta it's hidden and Spotify isn't asked. */
  var OPEN_STATUSES = ['Prep mode', 'Firing up', 'Service', 'Last orders'];
  var NOW_PLAYING_URL = '/api/now-playing';
  var NOW_PLAYING_POLL_MS = 30000;

  var nowPlaying = null; // { artist, track } or null

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

  function currentKitchenStatus() {
    return (typeof getKitchenStatus === 'function') ? getKitchenStatus() : '';
  }

  function isOpen() {
    return OPEN_STATUSES.indexOf(currentKitchenStatus()) !== -1;
  }

  function buildUnitHTML() {
    var kitchenStatus = currentKitchenStatus();
    var weather = (typeof getWeatherStatus === 'function') ? getWeatherStatus() : null;

    var html = '';

    if (nowPlaying && isOpen()) {
      html += '<span class="ticker-unit">';
      html += '<span class="ticker-play" aria-hidden="true">▶</span>';
      html += '<span>Now playing: ' + escapeHTML(nowPlaying.artist) + ' – ' + escapeHTML(nowPlaying.track) + '</span>';
      html += '</span>';
    }

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

  /* Only re-render when the song actually changes — a re-render restarts
     the marquee, so polling must not cause a visible jump every 30s. */
  function setNowPlaying(next) {
    var nextKey = next ? next.artist + '\u0000' + next.track : '';
    var prevKey = nowPlaying ? nowPlaying.artist + '\u0000' + nowPlaying.track : '';
    nowPlaying = next;
    if (nextKey !== prevKey) renderStatus();
  }

  function refreshNowPlaying() {
    if (!track) return;
    if (!isOpen()) { setNowPlaying(null); return; }
    if (typeof fetch !== 'function') return;
    fetch(NOW_PLAYING_URL, { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        setNowPlaying(data && data.source && data.artist && data.track
          ? { artist: String(data.artist), track: String(data.track) }
          : null);
      })
      .catch(function () { /* keep whatever is showing; try again next poll */ });
  }

  if (typeof subscribeKitchenStatus === 'function') {
    subscribeKitchenStatus(function () { renderStatus(); refreshNowPlaying(); });
  } else {
    refreshNowPlaying();
  }

  setInterval(function () {
    if (!document.hidden) refreshNowPlaying();
  }, NOW_PLAYING_POLL_MS);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshNowPlaying();
  });
  if (typeof subscribeWeatherStatus === 'function') subscribeWeatherStatus(renderStatus);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderStatus(); renderLinks(); }, 200);
  });
})();
