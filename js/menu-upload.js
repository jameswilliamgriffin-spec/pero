// Checks for uploaded menu PDF and renders it, or shows placeholder

async function loadMenu() {
  try {
    const response = await fetch('menu/current/manifest.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('No menu');
    const manifest = await response.json();
    if (manifest && manifest.filename) {
      showMenu(manifest);
    } else {
      showPlaceholder();
    }
  } catch (err) {
    console.log('No menu available:', err);
    showPlaceholder();
  }
}

function showMenu(manifest) {
  const placeholder = document.getElementById('menuPlaceholder');
  const pdfWrap     = document.getElementById('menuPdfWrap');
  const iframe      = document.getElementById('menuIframe');
  const download    = document.getElementById('menuDownload');
  const updated     = document.getElementById('menuUpdated');

  const pdfPath = 'menu/current/' + manifest.filename;

  placeholder.style.display = 'none';
  pdfWrap.style.display     = 'block';
  iframe.src                = pdfPath;
  download.href             = pdfPath;

  if (manifest.updated) {
    const date = new Date(manifest.updated);
    updated.textContent = 'Updated ' + date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

function showPlaceholder() {
  document.getElementById('menuPlaceholder').style.display = 'flex';
  document.getElementById('menuPdfWrap').style.display     = 'none';
}

loadMenu();
