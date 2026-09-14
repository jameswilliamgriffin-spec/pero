/* ==========================================================================
   MOBILE IMAGE SLIDERS
   Two swipeable, scroll-snap galleries for mobile: one for portrait shots,
   one for landscape shots, each built from the same manifest.json the
   desktop rotation feature reads. Orientation keeps the two pools disjoint
   by construction — a photo is filed as portrait or landscape, never both,
   so nothing can appear in both sliders.

   Touch already scrolls these natively (momentum + snap, for free). Mouse
   pointers don't drag a scroll container by default, so this file also
   adds click-and-drag: hold, move, and it scrolls like a swipe, snapping
   to the nearest slide on release.
   ========================================================================== */
(function () {
  'use strict';

  var MANIFEST_URL = 'assets/images/rotation/manifest.json';

  var sliders = Array.prototype.slice.call(document.querySelectorAll('[data-slider-orientation]'));
  if (!sliders.length) return;

  fetch(MANIFEST_URL)
    .then(function (res) { return res.json(); })
    .then(function (manifest) {
      sliders.forEach(function (el) {
        var orientation = el.getAttribute('data-slider-orientation');
        var items = manifest.filter(function (entry) { return entry.orientation === orientation; });
        if (items.length) buildSlider(el, items);
      });
    })
    .catch(function () { /* no manifest, sliders just stay empty */ });

  function buildSlider(container, items) {
    var scroller = document.createElement('div');
    scroller.className = 'mobile-slider-scroll';

    var track = document.createElement('div');
    track.className = 'mobile-slider-track';

    items.forEach(function (item) {
      var slide = document.createElement('div');
      slide.className = 'mobile-slider-item';

      var img = document.createElement('img');
      img.src = item.path;
      img.alt = item.alt || '';
      img.loading = 'lazy';
      slide.appendChild(img);
      track.appendChild(slide);
    });

    scroller.appendChild(track);
    container.appendChild(scroller);

    enableDragToScroll(scroller);
  }

  /* Mouse-only: touch already gets native scrolling, and layering this on
     top of touch would just fight the browser's own momentum/snap handling. */
  function enableDragToScroll(scroller) {
    var pointerId = null;
    var startX = 0;
    var startScrollLeft = 0;
    var moved = false;

    function onPointerMove(e) {
      if (e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      scroller.scrollLeft = startScrollLeft - dx;
    }

    function endDrag(e) {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      scroller.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);

      if (moved) {
        var slideWidth = scroller.clientWidth;
        var nearest = Math.round(scroller.scrollLeft / slideWidth) * slideWidth;
        scroller.scrollTo({ left: nearest, behavior: 'smooth' });
      }
    }

    scroller.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScrollLeft = scroller.scrollLeft;
      scroller.classList.add('is-dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      e.preventDefault(); // stop the browser's native image-drag ghost
    });

    // A drag that moved the scroll position shouldn't also fire link/image clicks.
    scroller.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }
})();
