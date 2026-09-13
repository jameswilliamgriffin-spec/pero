(function () {
  'use strict';
  var list = document.querySelector('[data-faq-list]');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.faq-item'));
  var buttons = items.map(function (item) { return item.querySelector('button'); });

  function setOpen(item, open) {
    var button = item.querySelector('button');
    var answer = item.querySelector('.faq-answer');
    var wasOpen = item.classList.contains('is-open');
    button.setAttribute('aria-expanded', String(open));

    if (open) {
      answer.removeAttribute('hidden');
      item.classList.add('is-open');
      return;
    }

    if (!wasOpen) {
      answer.setAttribute('hidden', '');
      return;
    }

    item.classList.remove('is-open');
    var hideAfterClose = function () {
      if (!item.classList.contains('is-open')) answer.setAttribute('hidden', '');
    };
    answer.addEventListener('transitionend', hideAfterClose, { once: true });
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(hideAfterClose, reducedMotion ? 0 : 500);
  }
  function toggle(item) {
    var open = item.classList.contains('is-open');
    items.forEach(function (other) { setOpen(other, other === item && !open); });
  }
  items.forEach(function (item, index) {
    var button = buttons[index];
    button.addEventListener('click', function () { toggle(item); });
    button.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
      if (event.key === 'Escape' && item.classList.contains('is-open')) toggle(item);
    });
  });
})();
