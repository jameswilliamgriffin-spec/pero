async function loadMenu() {
  try {
    const response = await fetch('/api/current-menu', { cache: 'no-cache' });
    const data     = await response.json();

    if (data.exists && data.url) {
      document.getElementById('menuDownload').href = data.url;

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
  }
}

loadMenu();
