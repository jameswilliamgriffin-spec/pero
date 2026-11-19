#!/usr/bin/env node
/* ==========================================================================
   PERRO — one-time Spotify authorisation

   Gets a long-lived refresh token so /api/now-playing can read what the
   restaurant's Spotify account is playing. Run it once on your own machine:

     1. In the Spotify developer dashboard (developer.spotify.com/dashboard),
        signed in as the restaurant's account, create an app with
        Redirect URI exactly:  http://127.0.0.1:8888/callback
        and tick "Web API".
     2. npm run spotify-auth — it asks for the app's Client ID and Client
        Secret if they aren't in .env yet, and saves them there.
     3. Open the link it prints, log in as the restaurant's account, click
        Agree. The script saves SPOTIFY_REFRESH_TOKEN into .env and prints it
        so you can paste it into Vercel's environment variables too.

   The password is only ever typed into Spotify's own login page — this
   script never sees it.
   ========================================================================== */

'use strict';

const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const crypto = require('crypto');
const readline = require('readline');

const ENV_PATH = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_PATH });

let CLIENT_ID       = (process.env.SPOTIFY_CLIENT_ID || '').trim();
let CLIENT_SECRET   = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const HOST          = '127.0.0.1';
const PORT          = 8888;
const REDIRECT_URI  = 'http://' + HOST + ':' + PORT + '/callback';
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' ');

/* One readline interface with a queue of lines, so an answer that arrives
   before its prompt (e.g. pasted in one go) is never dropped. */
let rl = null;
const lines = [];
const waiting = [];
let inputClosed = false;
let muted = false; // true while typing the secret, so it isn't echoed
function ask(question, hidden) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Suppress echo of typed/pasted characters while muted (keep newlines).
    const write = rl._writeToOutput ? rl._writeToOutput.bind(rl) : null;
    if (write) {
      rl._writeToOutput = (s) => {
        if (!muted) write(s);
        else if (/[\r\n]/.test(s)) write('\n');
      };
    }
    rl.on('line', (line) => {
      const next = waiting.shift();
      if (next) next(line.trim()); else lines.push(line.trim());
    });
    rl.on('close', () => {
      inputClosed = true;
      while (waiting.length) waiting.shift()('');
    });
  }
  // Use readline's own prompt so a terminal redraw repaints the question
  // instead of replacing it with a bare "> ".
  muted = false;
  rl.setPrompt(question);
  rl.prompt();
  if (lines.length) return Promise.resolve(lines.shift());
  if (inputClosed) return Promise.resolve('');
  muted = Boolean(hidden);
  return new Promise((resolve) => waiting.push((answer) => { muted = false; resolve(answer); }));
}

const looksLikeKey = (value) => /^[0-9a-f]{32}$/i.test(value);

const state = crypto.randomBytes(16).toString('hex');
const authorizeUrl = () => 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
  state: state,
  show_dialog: 'true'
}).toString();

function saveToEnv(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = key + '=' + value;
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  if (pattern.test(text)) {
    text = text.replace(pattern, line);
  } else {
    if (text && !text.endsWith('\n')) text += '\n';
    text += line + '\n';
  }
  fs.writeFileSync(ENV_PATH, text);
}

function page(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>Perro × Spotify</title>' +
    '<body style="font:16px/1.5 system-ui;padding:40px;max-width:560px">' + message + '</body>');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') return page(res, 404, 'Not found');

  if (url.searchParams.get('state') !== state) {
    return page(res, 400, 'State mismatch — start again with <code>npm run spotify-auth</code>.');
  }
  if (url.searchParams.get('error')) {
    page(res, 400, 'Spotify said: ' + url.searchParams.get('error') + '. Nothing was saved.');
    server.close();
    return;
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: url.searchParams.get('code') || '',
        redirect_uri: REDIRECT_URI
      })
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      throw new Error(data.error_description || data.error || ('HTTP ' + tokenRes.status));
    }

    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: 'Bearer ' + data.access_token }
    });
    const me = meRes.ok ? await meRes.json() : {};

    saveToEnv('SPOTIFY_REFRESH_TOKEN', data.refresh_token);

    page(res, 200, '<h1>Connected ✔</h1><p>Spotify account: <b>' +
      String(me.display_name || me.id || 'unknown').replace(/[<>&]/g, '') +
      '</b>. You can close this tab and go back to the terminal.</p>');

    console.log('\n  Connected to Spotify account: ' + (me.display_name || me.id || 'unknown'));
    console.log('  Saved SPOTIFY_REFRESH_TOKEN to .env');
    console.log('\n  Add this to Vercel → Settings → Environment Variables as SPOTIFY_REFRESH_TOKEN:\n');
    console.log('  ' + data.refresh_token + '\n');
  } catch (err) {
    page(res, 500, 'Token exchange failed: ' + String(err.message).replace(/[<>&]/g, ''));
    console.error('\n  Token exchange failed:', err.message, '\n');
    process.exitCode = 1;
  }
  server.close();
});

async function main() {
  const askedId = !CLIENT_ID;
  const askedSecret = !CLIENT_SECRET;
  if (askedId) CLIENT_ID = await ask('\n  Paste the Spotify app\'s Client ID and press Enter: ');
  if (askedSecret) CLIENT_SECRET = await ask('  Paste the Client Secret and press Enter (it stays hidden): ', true);
  if (rl) rl.close();

  if (!looksLikeKey(CLIENT_ID) || !looksLikeKey(CLIENT_SECRET)) {
    console.error('\n  That doesn\'t look right: the Client ID and Client Secret are each 32 letters and numbers.');
    if (!askedId || !askedSecret) {
      console.error('  Check SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env (or delete those lines) and run this again.');
    } else {
      console.error('  Nothing was saved. Run this again and paste them carefully.');
    }
    console.error('');
    process.exit(1);
  }
  // Only save once both look valid, so a typo never ends up in .env.
  if (askedId) saveToEnv('SPOTIFY_CLIENT_ID', CLIENT_ID);
  if (askedSecret) saveToEnv('SPOTIFY_CLIENT_SECRET', CLIENT_SECRET);

  server.on('error', (err) => {
    console.error('\n  Couldn\'t start on ' + REDIRECT_URI + ': ' + err.message + '\n');
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log('\n  Open this link, log in as the restaurant\'s Spotify account and click Agree:\n');
    console.log('  ' + authorizeUrl() + '\n');
    console.log('  Waiting for Spotify to redirect back to ' + REDIRECT_URI + ' …');
  });
}

main();
