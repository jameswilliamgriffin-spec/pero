# Perro

Static site + small Express API for Taqueria/Perro (Kings Heath, Birmingham). Plain HTML/CSS/vanilla JS pages served by `server.js`, with a Cloudinary-backed menu-PDF upload flow behind a password-protected admin page.

## Pages

- `index.html` — home
- `menu.html` — menu (PDF download + JPEG preview, both kept in sync by the admin upload)
- `faq.html` — FAQ
- `admin.html` — password-protected menu management (upload/remove the menu PDF)
- `dog-options.html` — internal, unlinked design-review page (not part of the public site; consider removing before launch if you don't want it publicly reachable)

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

None of these are hardcoded in the codebase — `server.js` reads them all from `process.env`. If `ADMIN_PASSWORD` is unset, the server logs a warning at startup and every admin request is rejected.

## The admin/menu-upload flow

1. `admin.html` posts the entered password to `POST /api/admin-login`, which checks it against `process.env.ADMIN_PASSWORD` (constant-time comparison) and never returns the real password to the client.
2. On success, the password is kept in `sessionStorage` for that tab only and sent as the `x-admin-password` header on the actual admin actions.
3. `POST /api/upload-menu` (multipart, field name `menu`, PDF only, 20MB max) uploads the PDF to Cloudinary twice: once as a `raw` resource (the direct download link) and once as an `image` resource rendered to JPEG (the on-page preview on `menu.html`). Both are read back by `GET /api/current-menu` (public, no auth — it only exposes the current menu URLs).
4. `POST /api/remove-menu` deletes both Cloudinary resources.

## Deploying to Vercel

`vercel.json` builds `server.js` with `@vercel/node` and routes all requests through it; there is no separate frontend build step (`npm run build` doesn't exist — this isn't a bundled framework app, so don't add a Vercel build command).

1. Push to GitHub (`.env` is gitignored — set the same variables in the Vercel dashboard instead).
2. In Vercel → Project → Settings → Environment Variables, add the five variables listed above.
3. Deploy. `server.js` only calls `app.listen()` when run directly, so it works as a Vercel serverless function.

## Known gaps / things to double check before going live

- `dog-options.html` isn't linked from anywhere but is publicly reachable at `/dog-options.html` once deployed — remove it or leave it, your call.
- A handful of large, unused prototype images live under `assets/images/` (leftover from scrapped features) and were left in place by request — see the audit summary for exact paths if you want to delete them to shrink the deploy bundle.
