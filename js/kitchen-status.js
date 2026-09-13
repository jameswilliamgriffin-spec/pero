/* ==========================================================================
   PERRO — Kitchen status
   Computes the restaurant's current status from Europe/London wall-clock
   time (independent of the visitor's device timezone, and correct across
   the BST/GMT switch). Exposes:

     getKitchenStatus(date?)              -> status string, pure/one-off
     subscribeKitchenStatus(cb, intervalMs?) -> cb(status) now + on change,
                                                 returns an unsubscribe fn

   Edit SCHEDULE below to change opening hours — nothing else needs to
   change. Ranges are inclusive of both start and end minute and must be
   contiguous within a day (no gaps) for every minute to resolve to a status.
   ========================================================================== */

(function (global) {
  'use strict';

  var STATUS = {
    SIESTA: 'Siesta',
    PREP: 'Prep mode',
    FIRING_UP: 'Firing up',
    SERVICE: 'Service',
    LAST_ORDERS: 'Last orders'
  };

  var CLOSED_ALL_DAY = [
    { start: '00:00', end: '23:59', status: STATUS.SIESTA }
  ];

  var DINNER_ONLY = [
    { start: '00:00', end: '08:59', status: STATUS.SIESTA },
    { start: '09:00', end: '16:59', status: STATUS.PREP },
    { start: '17:00', end: '17:59', status: STATUS.FIRING_UP },
    { start: '18:00', end: '22:29', status: STATUS.SERVICE },
    { start: '22:30', end: '22:59', status: STATUS.LAST_ORDERS },
    { start: '23:00', end: '23:59', status: STATUS.SIESTA }
  ];

  var BRUNCH_AND_DINNER = [
    { start: '00:00', end: '07:59', status: STATUS.SIESTA },
    { start: '08:00', end: '09:59', status: STATUS.PREP },
    { start: '10:00', end: '10:59', status: STATUS.FIRING_UP },
    { start: '11:00', end: '13:29', status: STATUS.SERVICE },
    { start: '13:30', end: '13:59', status: STATUS.LAST_ORDERS },
    { start: '14:00', end: '16:59', status: STATUS.PREP },
    { start: '17:00', end: '17:59', status: STATUS.FIRING_UP },
    { start: '18:00', end: '22:29', status: STATUS.SERVICE },
    { start: '22:30', end: '22:59', status: STATUS.LAST_ORDERS },
    { start: '23:00', end: '23:59', status: STATUS.SIESTA }
  ];

  var SCHEDULE = [
    { day: 'Sun', ranges: CLOSED_ALL_DAY },
    { day: 'Mon', ranges: CLOSED_ALL_DAY },
    { day: 'Tue', ranges: DINNER_ONLY },
    { day: 'Wed', ranges: DINNER_ONLY },
    { day: 'Thu', ranges: DINNER_ONLY },
    { day: 'Fri', ranges: DINNER_ONLY },
    { day: 'Sat', ranges: BRUNCH_AND_DINNER }
  ];

  var DEFAULT_INTERVAL_MS = 45000;

  function parseHM(str) {
    var parts = str.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  /* Reads the wall-clock day/hour/minute in Europe/London for a given
     instant, regardless of the browser's own timezone. */
  function getLondonParts(date) {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    var map = {};
    fmt.formatToParts(date).forEach(function (part) {
      map[part.type] = part.value;
    });
    var hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0; /* some engines report midnight as "24" with hour12:false */
    return {
      day: map.weekday, /* 'Mon' .. 'Sun' */
      minuteOfDay: hour * 60 + parseInt(map.minute, 10)
    };
  }

  function findDaySchedule(day) {
    for (var i = 0; i < SCHEDULE.length; i++) {
      if (SCHEDULE[i].day === day) return SCHEDULE[i];
    }
    return null;
  }

  /**
   * Pure lookup: the kitchen status for a given instant (defaults to now),
   * based on Europe/London time.
   */
  function getKitchenStatus(date) {
    var parts = getLondonParts(date || new Date());
    var daySchedule = findDaySchedule(parts.day);
    if (!daySchedule) return STATUS.SIESTA;

    for (var i = 0; i < daySchedule.ranges.length; i++) {
      var range = daySchedule.ranges[i];
      if (parts.minuteOfDay >= parseHM(range.start) && parts.minuteOfDay <= parseHM(range.end)) {
        return range.status;
      }
    }
    return STATUS.SIESTA;
  }

  /**
   * Convenience "hook" for consumers that want to stay in sync without
   * building their own polling loop: calls back immediately with the
   * current status, then again only when the status actually changes,
   * checking every `intervalMs` (default 45s). Returns an unsubscribe fn.
   */
  function subscribeKitchenStatus(callback, intervalMs) {
    var last = null;

    function tick() {
      var current = getKitchenStatus();
      if (current !== last) {
        last = current;
        callback(current);
      }
    }

    tick();
    var id = setInterval(tick, intervalMs || DEFAULT_INTERVAL_MS);
    return function unsubscribe() { clearInterval(id); };
  }

  global.getKitchenStatus = getKitchenStatus;
  global.subscribeKitchenStatus = subscribeKitchenStatus;
  global.KITCHEN_STATUS = STATUS;
})(window);
