async function loadMenu() {
  try {
    const response = await fetch('/api/current-menu', { cache: 'no-cache' });
    const data     = await response.json();

    if (data.exists && data.url) {
      showMenu(data.url, data.updated);
    } else {
      showPlaceholder();
    }
  } catch (err) {
    console.log('No menu available:', err);
    showPlaceholder();
  }
}

function showMenu(url, updated) {
  const placeholder = document.getElementById('menuPlaceholder');
  const pdfWrap     = document.getElementById('menuPdfWrap');
  const iframe      = document.getElementById('menuIframe');
  const download    = document.getElementById('menuDownload');
  const updatedEl   = document.getElementById('menuUpdated');

  placeholder.style.display = 'none';
  pdfWrap.style.display     = 'block';
  iframe.src                = url;
  download.href             = url;

  if (updated) {
    const date = new Date(updated);
    updatedEl.textContent = 'Updated ' + date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

function showPlaceholder() {
  document.getElementById('menuPlaceholder').style.display = 'flex';
  document.getElementById('menuPdfWrap').style.display     = 'none';
}

loadMenu();
