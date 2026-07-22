# SNIP — URL Shortener

A clean, single-page URL shortener with click analytics. Built with vanilla HTML/CSS/JS, served by a zero-dependency Node server, self-hosted on Coolify, and powered by n8n webhooks as the backend.

![Dark Mode](https://img.shields.io/badge/theme-dark%20%2F%20light-6366f1)
![Self-hosted on Coolify](https://img.shields.io/badge/self--hosted-Coolify-8b5cf6)
![Backend](https://img.shields.io/badge/backend-n8n-orange)

## Features

- **Shorten URLs** — Paste any link and get a short URL instantly
- **Custom aliases** — Choose your own short code (e.g. `/my-link`)
- **Click analytics** — Look up how many times any short URL has been clicked
- **Dark / Light mode** — Toggle with one click, preference saved in localStorage
- **Secure by design** — API key never exposed to the browser (server-side proxy)
- **Privacy analytics** — Self-hosted, cookieless Umami page-view tracking
- **SEO ready** — Open Graph, Twitter Card, JSON-LD schema, sitemap, and web manifest

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (single file) |
| Fonts | Syne (display) + DM Mono (monospace) via Google Fonts |
| Server | Zero-dependency Node.js (`server.js`, Node ≥ 20 built-ins only) |
| Container | Docker (`node:22-alpine`) |
| Deployment | Coolify on a Hostinger VPS (auto-deploy via GitHub Actions) |
| Backend | n8n webhooks |
| Analytics | Self-hosted Umami |
| Short URL domain | `shorturl.zeeshanai.cloud` |

## How It Works

One Node process owns the whole domain:

- `GET /` and static assets → served from the repo root with cache/security headers
- `POST /api/webhook` → proxies to n8n, injecting the `N8N_API_KEY` header server-side
- `GET /:code` (and `GET /api/redirect?code=…`) → proxies to n8n, relaying its `302` to the original URL

> The `api/` folder and `vercel.json` are retained only for reference / Vercel rollback; the live server is `server.js`.

## Project Structure

```
url-shortener/
├── server.js               # Node server — static files + /api/webhook + /:code redirect
├── package.json            # No dependencies; `npm start` runs server.js
├── Dockerfile              # node:22-alpine image (used by Coolify)
├── .dockerignore
├── index.html              # Full SPA — all UI, styles, and logic
├── robots.txt              # Crawl rules (homepage only; blocks short-code paths)
├── sitemap.xml             # Single-URL sitemap
├── manifest.json           # PWA web manifest
├── og-image.png            # Open Graph / Twitter Card image (1200×630)
├── apple-touch-icon.png    # iOS home screen icon (180×180)
├── .github/workflows/
│   └── deploy.yml          # Auto-deploy to Coolify on push to main
├── api/, vercel.json       # Legacy Vercel setup (kept for rollback)
└── config.example.js       # Template for local config
```

## Local Development

No build step and no dependencies — just Node ≥ 20:

```bash
N8N_API_KEY=your_api_key_here node server.js
# → http://localhost:3000
```

`PORT` is configurable (defaults to `3000`).

## Deployment (Coolify)

Deployed on Coolify (Hostinger VPS) as a Docker application:

- **Build pack:** Dockerfile (`node:22-alpine`) · **Exposed port:** `3000`
- **Env vars:** `N8N_API_KEY` (runtime secret), `NODE_ENV=production`
- **Domain:** `shorturl.zeeshanai.cloud` with automatic Let's Encrypt SSL
- **Auto-deploy:** pushing to `main` triggers `.github/workflows/deploy.yml`, which
  calls the Coolify deploy API (repo secrets `COOLIFY_API_TOKEN` + `COOLIFY_APP_UUID`)

## n8n Webhook Setup

The app uses a **single n8n webhook** for all operations, differentiated by `event_type` in the request body.

### Endpoint

```
POST https://your-n8n-instance.com/webhook/<webhook-id>
Header: x-api-key: <your-api-key>
```

### Shorten URL

```json
// Request
{ "event_type": "short_url", "url": "https://example.com/long-path" }

// Response
{
  "success": true,
  "short_code": "ab3f9z",
  "short_url": "https://shorturl.zeeshanai.cloud/ab3f9z",
  "original_url": "https://example.com/long-path",
  "clicks": 0
}
```

### Get Stats

```json
// Request
{ "event_type": "stats", "short_code": "ab3f9z" }

// Response
{
  "success": true,
  "short_code": "ab3f9z",
  "short_url": "https://shorturl.zeeshanai.cloud/ab3f9z",
  "original_url": "https://example.com/long-path",
  "clicks": 42
}
```

### Redirect

Short URLs redirect via a separate GET webhook:
```
GET https://your-n8n-instance.com/webhook/<redirect-webhook-id>/r/<short_code>
→ HTTP 302 to original URL + increments click counter
```

## Security

- The `x-api-key` header is added by the **Node server** (`server.js`), never the browser
- The API key is stored as the `N8N_API_KEY` environment variable (a Coolify runtime secret)
- `.env.local` and `config.js` are gitignored and never committed

## License

MIT
