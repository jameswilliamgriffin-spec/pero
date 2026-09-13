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

  var PX_PER_SECOND = 55;
  var MIN_REPEATS = 4;

  var track = document.getElementById('tickerTrack');
  if (!track) return;

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

  function measureWidth(html) {
    var probe = document.createElement('div');
    probe.className = 'ticker-bar__track';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.animation = 'none';
    probe.innerHTML = html;
    document.body.appendChild(probe);
    var width = probe.scrollWidth;
    document.body.removeChild(probe);
    return width;
  }

  function render() {
    var unitHTML = buildUnitHTML();
    var unitWidth = measureWidth(unitHTML) || 300;

    /* Repeat the unit until one "half" comfortably exceeds twice the
       viewport width, then duplicate that half once more — animating
       exactly -50% loops seamlessly since copy 2 always lands where
       copy 1 started. */
    var targetWidth = window.innerWidth * 2;
    var repeats = Math.max(MIN_REPEATS, Math.ceil(targetWidth / unitWidth));

    var half = '';
    for (var i = 0; i < repeats; i++) half += unitHTML;
    track.innerHTML = half + half;

    requestAnimationFrame(function () {
      var halfWidth = track.scrollWidth / 2;
      track.style.animationDuration = (halfWidth / PX_PER_SECOND) + 's';
    });
  }

  render();

  if (typeof subscribeKitchenStatus === 'function') subscribeKitchenStatus(render);
  if (typeof subscribeWeatherStatus === 'function') subscribeWeatherStatus(render);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });
})();
