require('dotenv').config();

const crypto     = require('crypto');
const express    = require('express');
const multer     = require('multer');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const cloudinary = require('cloudinary').v2;

const app  = express();
const PORT = process.env.PORT || 3000;

if (!process.env.ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD is not set — /admin routes will reject all requests.');
}

/* ----------------------------------------
   CLOUDINARY CONFIG
   ---------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MENU_PUBLIC_ID         = 'perro/menu';
const MENU_PREVIEW_PUBLIC_ID = 'perro/menu-preview';

/* ----------------------------------------
   ADMIN AUTH — password is checked server-side only; the client never
   holds anything more than what the operator just typed.
   ---------------------------------------- */

function passwordMatches(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  const supplied = req.get('x-admin-password') || '';
  if (!passwordMatches(supplied)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

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

app.post('/api/admin-login', (req, res) => {
  if (passwordMatches(req.body && req.body.password)) {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Incorrect password' });
});

app.post('/api/upload-menu', requireAdmin, upload.single('menu'), async (req, res) => {
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

    // A second upload, as an image resource, so Cloudinary can render the
    // PDF's first page as a JPEG for the on-page preview.
    let previewUrl = null;
    try {
      const previewResult = await cloudinary.uploader.upload(fileBase64, {
        public_id:     MENU_PREVIEW_PUBLIC_ID,
        resource_type: 'image',
        overwrite:     true,
        invalidate:    true,
        format:        'jpg'
      });
      previewUrl = previewResult.secure_url;
    } catch (previewErr) {
      console.error('Menu preview JPEG render failed:', previewErr);
    }

    console.log('Menu uploaded to Cloudinary:', result.secure_url);
    res.json({
      success:      true,
      url:          result.secure_url,
      previewUrl:   previewUrl,
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

    let previewUrl = null;
    try {
      const previewResult = await cloudinary.api.resource(MENU_PREVIEW_PUBLIC_ID, {
        resource_type: 'image'
      });
      previewUrl = previewResult.secure_url;
    } catch (previewErr) {
      // No preview yet (e.g. menu uploaded before this feature existed) — fine.
    }

    res.json({ exists: true, url: result.secure_url, previewUrl, updated: result.created_at });
  } catch (err) {
    res.json({ exists: false });
  }
});

app.post('/api/remove-menu', requireAdmin, async (req, res) => {
  try {
    await cloudinary.uploader.destroy(MENU_PUBLIC_ID + '.pdf', { resource_type: 'raw' });
    try {
      await cloudinary.uploader.destroy(MENU_PREVIEW_PUBLIC_ID, { resource_type: 'image' });
    } catch (previewErr) {
      console.error('Preview removal failed:', previewErr);
    }
    console.log('Menu removed from Cloudinary');
    res.json({ success: true });
  } catch (err) {
    console.error('Remove failed:', err);
    res.status(500).json({ error: 'Failed to remove menu' });
  }
});

/* ----------------------------------------
   ROTATION MANIFEST — reorder/remove entries from the local slider-editor
   tool. Rebuilds the manifest as [...portrait entries in the given order,
   ...landscape entries in the given order]; array order only matters to
   the mobile sliders (js/mobile-image-slider.js filters-and-preserves it)
   — the desktop rotation (js/image-rotation.js) shuffles its pool every
   time regardless of manifest order, so this can't affect that.
   ---------------------------------------- */

const MANIFEST_PATH = path.join(__dirname, 'assets/images/rotation/manifest.json');

app.post('/api/update-manifest', requireAdmin, (req, res) => {
  try {
    const { portrait, landscape } = req.body || {};
    if (!Array.isArray(portrait) || !Array.isArray(landscape)) {
      return res.status(400).json({ error: 'portrait and landscape must be arrays of file ids' });
    }

    const current = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const byFile = new Map(current.map((entry) => [entry.file, entry]));

    function resolve(ids, orientation) {
      const out = [];
      for (const id of ids) {
        const entry = byFile.get(id);
        if (!entry || entry.orientation !== orientation) return null;
        out.push(entry);
      }
      return out;
    }

    const newPortrait = resolve(portrait, 'portrait');
    const newLandscape = resolve(landscape, 'landscape');
    if (!newPortrait || !newLandscape) {
      return res.status(400).json({ error: 'Unknown file id, or an id had the wrong orientation' });
    }

    const updated = newPortrait.concat(newLandscape);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + '\n');
    console.log('Rotation manifest updated:', newPortrait.length, 'portrait,', newLandscape.length, 'landscape');
    res.json({ success: true, portraitCount: newPortrait.length, landscapeCount: newLandscape.length });
  } catch (err) {
    console.error('update-manifest failed:', err);
    res.status(500).json({ error: 'Failed to update manifest' });
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
