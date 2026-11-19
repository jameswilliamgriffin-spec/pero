# Perro

Static site + small Express API for Taqueria/Perro (Kings Heath, Birmingham). Plain HTML/CSS/vanilla JS pages served by `server.js`, with a Cloudinary-backed menu-PDF upload flow behind a password-protected admin page.

## Pages

- `index.html` — home
- `menu.html` — menu (PDF download + JPEG preview, both kept in sync by the admin upload)
- `faq.html` — FAQ
- `admin.html` — password-protected menu management (upload/remove the menu PDF)

Header/footer markup is duplicated across `index.html`, `menu.html`, and `faq.html` (no shared template/build step) — a change to one (nav links, footer, etc.) needs to be repeated in the others.

## Local setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run dev             # nodemon, restarts on change — http://localhost:3000
# or: npm start          # plain node, no restart-on-change
```

## Environment variables

Required, in `.env` locally and in your Vercel project's Environment Variables:

| Variable | Used for |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account — menu PDF/JPEG storage |
| `CLOUDINARY_API_KEY` | Cloudinary auth |
| `CLOUDINARY_API_SECRET` | Cloudinary auth |
| `ADMIN_PASSWORD` | Password for `/admin.html` — checked server-side in `server.js`, never shipped to the client |
| `PORT` | Local dev only; Vercel sets its own port |
| `SPOTIFY_CLIENT_ID` | Spotify app (developer.spotify.com) — ticker now-playing. Optional: without the Spotify vars the ticker just leaves now-playing out |
| `SPOTIFY_CLIENT_SECRET` | Spotify app secret |
| `SPOTIFY_REFRESH_TOKEN` | From `npm run spotify-auth` (one-time; see `scripts/spotify-auth.js`) |
| `SPOTIFY_PLAYLIST_ID` | House playlist used for a random pick when nothing is playing — the ID from the playlist's share link (`open.spotify.com/playlist/<ID>`) |

None of these are hardcoded in the codebase — `server.js` reads them all from `process.env`. If `ADMIN_PASSWORD` is unset, the server logs a warning at startup and every admin request is rejected.

## The admin/menu-upload flow

1. `admin.html` posts the entered password to `POST /api/admin-login`, which checks it against `process.env.ADMIN_PASSWORD` (constant-time comparison) and never returns the real password to the client.
2. On success, the password is kept in `sessionStorage` for that tab only and sent as the `x-admin-password` header on the actual admin actions.
3. `POST /api/upload-menu` (multipart, field name `menu`, PDF only, 20MB max) uploads the PDF to Cloudinary twice: once as a `raw` resource (the direct download link) and once as an `image` resource rendered to JPEG (the on-page preview on `menu.html`). Both are read back by `GET /api/current-menu` (public, no auth — it only exposes the current menu URLs).
4. `POST /api/remove-menu` deletes both Cloudinary resources.

## Ticker now-playing (Spotify)

`GET /api/now-playing` returns the track the restaurant's Spotify account is playing; if nothing is, the last track played in the past 30 minutes; otherwise a random track from `SPOTIFY_PLAYLIST_ID`, held for 4 minutes. `js/ticker.js` only asks for it, and only shows it, while the kitchen status is Prep mode, Firing up, Service or Last orders, i.e. Tue–Sat 09:00–23:00 (`OPEN_STATUSES` at the top of that file), polling every 30s. Responses are edge-cached for 20s.

Setup is one-time: create an app at developer.spotify.com/dashboard while signed in as the restaurant's account (Redirect URI `http://127.0.0.1:8888/callback`, Web API ticked), put its ID and secret in `.env`, run `npm run spotify-auth` and approve in the browser. Then copy the four `SPOTIFY_*` values into Vercel.

**Re-connect every 6 months.** Spotify gives this app refresh tokens that expire after 180 days (shown as "Refresh Token Lifetime" on the app's page). When it lapses the ticker silently drops the now-playing item. Fix: run `npm run spotify-auth` again (it reuses the ID and secret already in `.env`), click Agree as the restaurant's account, and replace `SPOTIFY_REFRESH_TOKEN` in Vercel, then redeploy. First token issued 2026-11-19, so due around mid-May 2027.

## Deploying to Vercel

`vercel.json` builds `server.js` with `@vercel/node` and routes all requests through it; there is no separate frontend build step (`npm run build` doesn't exist — this isn't a bundled framework app, so don't add a Vercel build command).

1. Push to GitHub (`.env` is gitignored — set the same variables in the Vercel dashboard instead).
2. In Vercel → Project → Settings → Environment Variables, add the variables listed above.
3. Deploy. `server.js` only calls `app.listen()` when run directly, so it works as a Vercel serverless function.

## Known gaps / things to double check before going live

- The rotation manifest (`assets/images/rotation/manifest.json`) used to be reorderable via a local `slider-editor.html` tool. That tool (and its read-only `slider-review.html` companion) was removed as part of a cleanup pass — it wasn't linked from the public site but was publicly reachable, and reordering the manifest by hand is straightforward if needed again.
