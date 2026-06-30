const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ----------------------------------------
   MIDDLEWARE
   ---------------------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ----------------------------------------
   MULTER — FILE UPLOAD CONFIG
   ---------------------------------------- */

const menuDir = path.join(__dirname, 'menu', 'current');

if (!fs.existsSync(menuDir)) {
  fs.mkdirSync(menuDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, menuDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'menu.pdf');
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/* ----------------------------------------
   API ROUTES
   ---------------------------------------- */

app.post('/api/upload-menu', upload.single('menu'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const manifest = {
    filename:     'menu.pdf',
    updated:      new Date().toISOString(),
    originalName: req.file.originalname,
    size:         req.file.size
  };

  const manifestPath = path.join(menuDir, 'manifest.json');

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Menu uploaded:', manifest);
    res.json({ success: true, manifest });
  } catch (err) {
    console.error('Manifest write failed:', err);
    res.status(500).json({ error: 'Failed to save manifest' });
  }
});

app.post('/api/remove-menu', (req, res) => {
  const pdfPath      = path.join(menuDir, 'menu.pdf');
  const manifestPath = path.join(menuDir, 'manifest.json');

  try {
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
    fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
    console.log('Menu removed');
    res.json({ success: true });
  } catch (err) {
    console.error('Remove failed:', err);
    res.status(500).json({ error: 'Failed to remove menu' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ----------------------------------------
   ERROR HANDLING
   ---------------------------------------- */

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum 20MB.' });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

/* ----------------------------------------
   START
   ---------------------------------------- */

app.listen(PORT, () => {
  console.log('');
  console.log('  PERRO — Server running');
  console.log('  http://localhost:' + PORT);
  console.log('  Admin: http://localhost:' + PORT + '/admin.html');
  console.log('');
});
