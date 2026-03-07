# SNIP — URL Shortener

A clean, single-page URL shortener with click analytics. Built with vanilla HTML/CSS/JS, deployed on Vercel, and powered by n8n webhooks as the backend.

![Dark Mode](https://img.shields.io/badge/theme-dark%20%2F%20light-6366f1)
![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)
![Backend](https://img.shields.io/badge/backend-n8n-orange)

## Features

- **Shorten URLs** — Paste any link and get a short URL instantly
- **Custom aliases** — Choose your own short code (e.g. `/my-link`)
- **Click analytics** — Look up how many times any short URL has been clicked
- **Dark / Light mode** — Toggle with one click, preference saved in localStorage
- **Secure by design** — API key never exposed to the browser (Vercel proxy)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (single file) |
| Fonts | Syne (display) + DM Mono (monospace) via Google Fonts |
| Deployment | Vercel (static + serverless function) |
| Backend | n8n webhooks |
| Short URL domain | `shorturl.zeeshanai.cloud` |

## Project Structure

```
url-shortener/
├── index.html          # Full SPA — all UI, styles, and logic
├── api/
│   └── webhook.js      # Vercel serverless proxy (injects API key server-side)
├── vercel.json         # Vercel function config
├── config.example.js   # Template for local development config
└── .gitignore
```

## Local Development

1. Install the [Vercel CLI](https://vercel.com/docs/cli):
   ```bash
   npm i -g vercel
   ```

2. Create a local environment file:
   ```bash
   cp config.example.js config.js   # for reference only
   ```
   Then create `.env.local`:
   ```
   N8N_API_KEY=your_api_key_here
   ```

3. Run locally (serves both the HTML and the `/api/webhook` proxy):
   ```bash
   vercel dev
   ```

## Vercel Deployment

1. Push this repo to GitHub.

2. Import the project in the [Vercel dashboard](https://vercel.com/new).

3. Add the environment variable:
   - **Name:** `N8N_API_KEY`
   - **Value:** your n8n API key
   - **Environments:** Production, Preview, Development

4. Deploy — Vercel auto-detects the `api/` folder and the static `index.html`.

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

- The `x-api-key` header is added by the **Vercel serverless function** (`api/webhook.js`), not the browser
- The API key is stored as a **Vercel environment variable** (`N8N_API_KEY`)
- `config.js` (for local dev) is gitignored and never committed

## License

MIT
