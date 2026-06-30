require('dotenv').config();

const express    = require('express');
const multer     = require('multer');
const cors       = require('cors');
const path       = require('path');
const cloudinary = require('cloudinary').v2;

const app  = express();
const PORT = process.env.PORT || 3000;

/* ----------------------------------------
   CLOUDINARY CONFIG
   ---------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MENU_PUBLIC_ID = 'perro/menu';

/* ----------------------------------------
   MIDDLEWARE
   ---------------------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ----------------------------------------
   MULTER — IN-MEMORY STORAGE
   ---------------------------------------- */

const upload = multer({
  storage: multer.memoryStorage(),
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
   ROUTES
   ---------------------------------------- */

app.post('/api/upload-menu', upload.single('menu'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileBase64 = 'data:application/pdf;base64,' +
      req.file.buffer.toString('base64');

    const result = await cloudinary.uploader.upload(fileBase64, {
      public_id:     MENU_PUBLIC_ID + '.pdf',
      resource_type: 'raw',
      overwrite:     true,
      invalidate:    true,
      format:        'pdf'
    });

    console.log('Menu uploaded to Cloudinary:', result.secure_url);
    res.json({
      success:      true,
      url:          result.secure_url,
      updated:      new Date().toISOString(),
      originalName: req.file.originalname
    });

  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    res.status(500).json({ error: 'Upload to Cloudinary failed' });
  }
});

app.get('/api/current-menu', async (req, res) => {
  try {
    const result = await cloudinary.api.resource(MENU_PUBLIC_ID + '.pdf', {
      resource_type: 'raw'
    });
    res.json({ exists: true, url: result.secure_url, updated: result.created_at });
  } catch (err) {
    res.json({ exists: false });
  }
});

app.post('/api/remove-menu', async (req, res) => {
  try {
    await cloudinary.uploader.destroy(MENU_PUBLIC_ID + '.pdf', { resource_type: 'raw' });
    console.log('Menu removed from Cloudinary');
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  PERRO — Server running');
    console.log('  http://localhost:' + PORT);
    console.log('  Admin: http://localhost:' + PORT + '/admin.html');
    console.log('');
  });
}

module.exports = app;
