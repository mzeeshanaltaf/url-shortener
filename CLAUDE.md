# CLAUDE.md

Guidance for working in this repository.

## What this is

**SNIP** — a single-page URL shortener with click analytics. Vanilla HTML/CSS/JS
frontend served by a **zero-dependency Node server**, self-hosted on **Coolify**
(Hostinger VPS), backed by **n8n webhooks**. Live at `shorturl.zeeshanai.cloud`.

## Architecture

One Node process (`server.js`) owns the whole domain — there is no build step and
no dependencies (Node ≥ 20 built-ins only, including global `fetch`):

- `GET /` + static assets → served from the repo root with the cache/security
  headers defined in `headersFor()` (mirrors the legacy `vercel.json`).
- `POST /api/webhook` → proxies to the n8n webhook, injecting the `x-api-key`
  header from `process.env.N8N_API_KEY` (the key is **never** sent to the browser).
- `GET /:code` (single dotless segment) and `GET /api/redirect?code=…` → proxy to
  the n8n redirect webhook and relay its `302` to the original URL.

The frontend (`index.html`) posts `{ event_type: 'short_url' | 'stats', … }` to
`/api/webhook`. n8n branches on `event_type`; a request without it returns an
empty body.

## Key files

- `server.js` — the entire server (routing, static serving, n8n proxying).
- `index.html` — the whole SPA (UI, styles, logic) + the Umami tracker in `<head>`.
- `Dockerfile` — `node:22-alpine`; used by Coolify. `package.json` has no deps.
- `.github/workflows/deploy.yml` — auto-deploys to Coolify on push to `main`.
- `api/` + `vercel.json` — **legacy Vercel setup, kept only for rollback.** Do not
  add features here; edit `server.js` instead. If you change one, keep them in sync.

## Conventions

- **No dependencies.** Keep `server.js` on Node built-ins only — do not introduce
  npm packages (Express, etc.) without a strong reason; it keeps the image tiny and
  the build instant.
- **Secrets never reach the client.** `N8N_API_KEY` stays server-side. Never inline
  it into `index.html` or any client code.
- **n8n endpoints** are hardcoded constants at the top of `server.js` (`N8N_WEBHOOK_URL`,
  `N8N_REDIRECT_BASE`). Update there if the workflow IDs change.
- **Short-code route** must stay a single dotless path segment (`^/[A-Za-z0-9_-]+$`)
  so it never shadows the dotted static assets.
- `.env.local` holds infra tokens (Coolify) and is gitignored — never commit it.

## Local development

```bash
N8N_API_KEY=your_api_key_here node server.js   # → http://localhost:3000
```

No CLI, no bundler. `PORT` overrides the default `3000`.

## Deployment

Push to `main` → GitHub Actions (`deploy.yml`) calls the Coolify deploy API
(retry + backoff). Coolify builds the Dockerfile and restarts the container.

- Coolify build pack: **Dockerfile**, exposed port **3000**.
- Env vars in Coolify: `N8N_API_KEY` (runtime), `NODE_ENV=production`.
- Domain + Let's Encrypt SSL are managed by Coolify's Traefik proxy.
- **Verify a live change** without depending on DNS/cert:
  `curl -sk --resolve shorturl.zeeshanai.cloud:443:76.13.7.106 https://shorturl.zeeshanai.cloud/`

## Analytics

Self-hosted **Umami** (cookieless). The tracker `<script>` is in `index.html`'s
`<head>`, pointing at `analytics.zeeshanai.cloud` with the site's website ID.
