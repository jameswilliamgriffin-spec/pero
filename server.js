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

/* ----------------------------------------
   SPOTIFY — NOW PLAYING for the status ticker (js/ticker.js).
   Order of preference:
     1. whatever the restaurant's account is playing right now
     2. the last track it played, if that was within SPOTIFY_RECENT_WINDOW_MS
     3. a random track from SPOTIFY_PLAYLIST_ID, held for
        SPOTIFY_FALLBACK_HOLD_MS so it reads like a song actually playing
   Opening hours are decided client-side (the ticker only asks while the
   restaurant is open). Auth is a long-lived refresh token from the
   one-time `npm run spotify-auth` script; nothing here ever sees the
   account's password. Any failure returns { source: null } and the ticker
   simply leaves the now-playing item out.
   ---------------------------------------- */

const SPOTIFY_RECENT_WINDOW_MS   = 30 * 60 * 1000;
const SPOTIFY_FALLBACK_HOLD_MS   = 4 * 60 * 1000;
const SPOTIFY_PLAYLIST_CACHE_MS  = 60 * 60 * 1000;
const SPOTIFY_PLAYLIST_MAX_PAGES = 10; // 100 tracks a page

const spotifyState = {
  accessToken: null,
  expiresAt: 0,
  playlist: null,
  playlistFetchedAt: 0,
  fallback: null,
  fallbackUntil: 0
};

function spotifyConfigured() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REFRESH_TOKEN
  );
}

async function spotifyAccessToken() {
  if (spotifyState.accessToken && Date.now() < spotifyState.expiresAt - 60 * 1000) {
    return spotifyState.accessToken;
  }
  const basic = Buffer.from(
    process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN
    })
  });
  if (!res.ok) throw new Error('Spotify token refresh failed: ' + res.status);
  const data = await res.json();
  spotifyState.accessToken = data.access_token;
  spotifyState.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return spotifyState.accessToken;
}

async function spotifyGet(pathAndQuery) {
  const token = await spotifyAccessToken();
  const res = await fetch('https://api.spotify.com/v1' + pathAndQuery, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (res.status === 204) return null; // nothing playing
  if (!res.ok) {
    const err = new Error('Spotify ' + pathAndQuery.split('?')[0] + ' returned ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function spotifyTrackInfo(item) {
  if (!item || !item.name || !Array.isArray(item.artists) || !item.artists.length) return null;
  return {
    track: item.name,
    artist: item.artists.map((a) => a.name).filter(Boolean).join(', ')
  };
}

async function spotifyPlaylistTracks() {
  const id = process.env.SPOTIFY_PLAYLIST_ID;
  if (!id) return [];
  if (spotifyState.playlist && Date.now() - spotifyState.playlistFetchedAt < SPOTIFY_PLAYLIST_CACHE_MS) {
    return spotifyState.playlist;
  }

  // Spotify has been moving playlist contents from /tracks to /items;
  // try the newer path first and fall back, reading either entry shape.
  const bases = ['/playlists/' + encodeURIComponent(id) + '/items', '/playlists/' + encodeURIComponent(id) + '/tracks'];
  let lastErr = null;
  for (const base of bases) {
    try {
      const tracks = [];
      for (let page = 0; page < SPOTIFY_PLAYLIST_MAX_PAGES; page++) {
        const data = await spotifyGet(base + '?limit=100&offset=' + page * 100);
        const entries = (data && data.items) || [];
        entries.forEach((entry) => {
          const info = spotifyTrackInfo(entry && (entry.item || entry.track));
          if (info) tracks.push(info);
        });
        if (!data || !data.next) break;
      }
      spotifyState.playlist = tracks;
      spotifyState.playlistFetchedAt = Date.now();
      return tracks;
    } catch (err) {
      lastErr = err;
      if (err.status !== 404 && err.status !== 410) break;
    }
  }
  throw lastErr;
}

async function spotifyNowPlaying() {
  const current = await spotifyGet('/me/player/currently-playing');
  const playing = current && current.is_playing && spotifyTrackInfo(current.item);
  if (playing) return Object.assign({ source: 'playing' }, playing);

  const recent = await spotifyGet('/me/player/recently-played?limit=1');
  const last = recent && recent.items && recent.items[0];
  if (last && Date.now() - Date.parse(last.played_at) < SPOTIFY_RECENT_WINDOW_MS) {
    const info = spotifyTrackInfo(last.track);
    if (info) return Object.assign({ source: 'recent' }, info);
  }

  if (!spotifyState.fallback || Date.now() > spotifyState.fallbackUntil) {
    const tracks = await spotifyPlaylistTracks();
    spotifyState.fallback = tracks.length
      ? tracks[Math.floor(Math.random() * tracks.length)]
      : null;
    spotifyState.fallbackUntil = Date.now() + SPOTIFY_FALLBACK_HOLD_MS;
  }
  if (spotifyState.fallback) return Object.assign({ source: 'playlist' }, spotifyState.fallback);
  return { source: null };
}

app.get('/api/now-playing', async (req, res) => {
  if (!spotifyConfigured()) {
    res.set('Cache-Control', 'no-store');
    return res.json({ source: null });
  }
  try {
    const result = await spotifyNowPlaying();
    // Short shared cache so every visitor's poll doesn't hit Spotify.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
    res.json(result);
  } catch (err) {
    console.error('now-playing failed:', err.message);
    res.set('Cache-Control', 'no-store');
    res.json({ source: null });
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
