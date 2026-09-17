async function loadMenu() {
  var img = document.getElementById('menuImage');

  try {
    const response = await fetch('/api/current-menu', { cache: 'no-cache' });
    const data     = await response.json();

    if (data.exists && data.url) {
      document.getElementById('menuDownload').href = data.url;

      if (data.previewUrl) {
        // Swap the src only once the live preview has actually finished
        // loading — otherwise .is-ready would reveal a broken/blank image
        // for the moment it takes to fetch. On failure just keep the
        // bundled fallback that's already in the HTML.
        await new Promise(function (resolve) {
          var probe = new Image();
          probe.onload = function () { img.src = data.previewUrl; resolve(); };
          probe.onerror = resolve;
          probe.src = data.previewUrl;
        });
      }

      if (data.updated) {
        const date = new Date(data.updated);
        document.getElementById('menuUpdated').textContent =
          'Updated ' + date.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
          });
      }
    }
  } catch (err) {
    console.log('No menu available:', err);
  } finally {
    // Reveal whatever ended up as the final src — the live preview above,
    // or the bundled fallback already in the HTML if anything failed —
    // never the stale fallback mid-swap.
    img.classList.add('is-ready');
  }
}

loadMenu();
