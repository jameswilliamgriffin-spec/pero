(function () {
  'use strict';

  var STORAGE_KEY = 'perro-saturation';
  var MIN_ANGLE = -135;
  var MAX_ANGLE = 135;
  var SWEEP = MAX_ANGLE - MIN_ANGLE;
  var DRAG_RANGE_PX = 150;
  var CX = 20, CY = 20, TRACK_R = 16, POINTER_INNER_R = 5, POINTER_OUTER_R = 11;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function polarToXY(r, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    return {
      x: CX + r * Math.sin(rad),
      y: CY - r * Math.cos(rad)
    };
  }

  function describeArc(r, startAngle, endAngle) {
    if (endAngle - startAngle < 0.01) return '';
    var start = polarToXY(r, startAngle);
    var end = polarToXY(r, endAngle);
    var largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return 'M ' + start.x + ' ' + start.y + ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + end.x + ' ' + end.y;
  }

  function applySaturation(value) {
    document.documentElement.style.filter = 'saturate(' + value + '%)';
  }

  function initKnob(container) {
    var svg = container.querySelector('.saturation-knob__dial');
    var arcPath = container.querySelector('.saturation-knob__arc');
    var pointer = container.querySelector('.saturation-knob__pointer');
    var valueEl = container.querySelector('.saturation-knob__value');
    if (!svg || !arcPath || !pointer || !valueEl) return;

    var value = 100;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        var n = parseInt(saved, 10);
        if (!isNaN(n)) value = clamp(n, 0, 100);
      }
    } catch (e) {}

    function render() {
      var angle = MIN_ANGLE + (value / 100) * SWEEP;
      arcPath.setAttribute('d', describeArc(TRACK_R, MIN_ANGLE, angle));
      var p1 = polarToXY(POINTER_INNER_R, angle);
      var p2 = polarToXY(POINTER_OUTER_R, angle);
      pointer.setAttribute('x1', p1.x);
      pointer.setAttribute('y1', p1.y);
      pointer.setAttribute('x2', p2.x);
      pointer.setAttribute('y2', p2.y);
      valueEl.textContent = String(value);
    }

    function setValue(v) {
      var clamped = clamp(Math.round(v), 0, 100);
      if (clamped === value) return;
      value = clamped;
      render();
      applySaturation(value);
      try { localStorage.setItem(STORAGE_KEY, String(value)); } catch (e) {}
    }

    render();
    applySaturation(value);

    var startY = 0;
    var startValue = value;
    var activePointerId = null;

    /* pointermove/pointerup are bound to window only while a drag is
       active (added on pointerdown, removed on pointerup/cancel) rather
       than to the small 40x40 svg — a fast vertical drag easily carries
       the pointer outside the icon's bounds, and if the release happens
       out there too, listeners scoped to the svg would never see it,
       leaving `dragging` stuck true so the knob keeps tracking mouse
       movement with no button held. */
    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      var deltaY = startY - e.clientY;
      setValue(startValue + (deltaY / DRAG_RANGE_PX) * 100);
    }

    function endDrag(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    }

    function onPointerDown(e) {
      activePointerId = e.pointerId;
      startY = e.clientY;
      startValue = value;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      e.preventDefault();
    }

    svg.addEventListener('pointerdown', onPointerDown);
  }

  var knobs = document.querySelectorAll('.saturation-knob');
  for (var i = 0; i < knobs.length; i++) initKnob(knobs[i]);
})();
