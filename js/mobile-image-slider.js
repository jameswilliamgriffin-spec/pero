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

  function makeSlide(item) {
    var slide = document.createElement('div');
    slide.className = 'mobile-slider-item';
    var img = document.createElement('img');
    img.src = item.path;
    img.alt = item.alt || '';
    img.loading = 'lazy';
    slide.appendChild(img);
    return slide;
  }

  /* Loops in both directions with just one clone at each end: a copy of the
     last slide before slide 1, and a copy of slide 1 after the last slide.
     The scroller opens on real slide 1 (skipping the leading clone); once a
     swipe settles ON a clone, it jumps — instantly, no animation — to the
     matching real slide at the other end, so the clone is never actually
     seen at rest, only crossed over mid-swipe. */
  function buildSlider(container, items) {
    if (items.length < 2) {
      // Nothing to loop with one slide — build it plain, same as before.
      var scrollerPlain = document.createElement('div');
      scrollerPlain.className = 'mobile-slider-scroll';
      var trackPlain = document.createElement('div');
      trackPlain.className = 'mobile-slider-track';
      items.forEach(function (item) { trackPlain.appendChild(makeSlide(item)); });
      scrollerPlain.appendChild(trackPlain);
      container.appendChild(scrollerPlain);
      enableDragToScroll(scrollerPlain);
      return;
    }

    var scroller = document.createElement('div');
    scroller.className = 'mobile-slider-scroll';

    var track = document.createElement('div');
    track.className = 'mobile-slider-track';

    track.appendChild(makeSlide(items[items.length - 1])); // leading clone of last
    items.forEach(function (item) { track.appendChild(makeSlide(item)); });
    track.appendChild(makeSlide(items[0])); // trailing clone of first

    scroller.appendChild(track);
    container.appendChild(scroller);

    var firstRealIndex = 1;
    var lastRealIndex = items.length; // track.children.length - 2

    function jumpTo(index) {
      scroller.scrollLeft = index * scroller.clientWidth;
    }
    // Open on real slide 1, not the leading clone sitting before it.
    jumpTo(firstRealIndex);

    var settleTimer = null;
    scroller.addEventListener('scroll', function () {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        var width = scroller.clientWidth;
        if (!width) return;
        var index = Math.round(scroller.scrollLeft / width);
        if (index <= 0) jumpTo(lastRealIndex);
        else if (index >= lastRealIndex + 1) jumpTo(firstRealIndex);
      }, 120);
    }, { passive: true });

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
