/* ==========================================================================
   PERRO — Weather status (Kings Heath, Birmingham)
   Fetches current weather directly from Open-Meteo — a free forecast API
   that needs no signup or API key, unlike OpenWeatherMap — so this runs
   entirely client-side with no server proxy involved. Exposes:

     getWeatherStatus()             -> last known formatted string, or null
     subscribeWeatherStatus(cb)     -> cb(status) now + whenever it changes,
                                        returns an unsubscribe fn

   The module owns a single fetch/poll loop (every 30 minutes) shared by
   all subscribers, so multiple components consuming this never trigger
   duplicate network requests. On any fetch failure the status is null so
   consumers can simply hide the weather segment instead of rendering
   broken text.
   ========================================================================== */

(function (global) {
  'use strict';

  var LAT = 52.4306;
  var LON = -1.8894;
  var ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LAT
    + '&longitude=' + LON
    + '&current=temperature_2m,weather_code'
    + '&timezone=Europe%2FLondon';

  var REFRESH_MS = 30 * 60 * 1000; /* 30 minutes */

  /* WMO weather codes (used by Open-Meteo) mapped down to the site's
     simplified condition set. */
  var WMO_CONDITION_MAP = {
    0: 'SUNNY',
    1: 'CLOUDY', 2: 'CLOUDY', 3: 'CLOUDY',
    45: 'FOGGY', 48: 'FOGGY',
    51: 'RAIN', 53: 'RAIN', 55: 'RAIN', 56: 'RAIN', 57: 'RAIN',
    61: 'RAIN', 63: 'RAIN', 65: 'RAIN', 66: 'RAIN', 67: 'RAIN',
    80: 'RAIN', 81: 'RAIN', 82: 'RAIN',
    71: 'SNOW', 73: 'SNOW', 75: 'SNOW', 77: 'SNOW', 85: 'SNOW', 86: 'SNOW',
    95: 'STORMY', 96: 'STORMY', 99: 'STORMY'
  };

  function mapCondition(wmoCode) {
    return WMO_CONDITION_MAP[wmoCode] || 'CLOUDY';
  }

  var cached = null;
  var listeners = [];

  function formatStatus(temp, condition) {
    return Math.round(temp) + ' DEGREES ' + condition;
  }

  function setCached(value) {
    if (value === cached) return;
    cached = value;
    listeners.forEach(function (cb) { cb(cached); });
  }

  function fetchWeather() {
    fetch(ENDPOINT)
      .then(function (res) {
        if (!res.ok) throw new Error('Weather request failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var current = data.current;
        if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
          throw new Error('Malformed weather response');
        }
        setCached(formatStatus(current.temperature_2m, mapCondition(current.weather_code)));
      })
      .catch(function (err) {
        console.log('Weather unavailable:', err);
        setCached(null);
      });
  }

  function getWeatherStatus() {
    return cached;
  }

  function subscribeWeatherStatus(callback) {
    listeners.push(callback);
    callback(cached);
    return function unsubscribe() {
      var idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  fetchWeather();
  setInterval(fetchWeather, REFRESH_MS);

  global.getWeatherStatus = getWeatherStatus;
  global.subscribeWeatherStatus = subscribeWeatherStatus;
})(window);
