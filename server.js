// ─────────────────────────────────────────────────────────────────────────────
//  SNIP — self-hostable Node server (zero dependencies, Node 18+ built-ins only)
//
//  Replaces the Vercel setup for Coolify/VPS deployment:
//    • POST /api/webhook            → proxy to n8n, injects the secret N8N_API_KEY
//    • GET  /api/redirect?code=X    → proxy to n8n, relays its 302 redirect
//    • GET  /:code                  → same redirect (was the vercel.json rewrite)
//    • everything else              → static files (index.html at /), with the
//                                     same cache/security headers as vercel.json
//
//  The one server owns the whole domain: landing page at / and short codes at
//  /:code. N8N_API_KEY must be set in the environment (never sent to the browser).
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const N8N_WEBHOOK_URL =
  'https://n8n.zeeshanai.cloud/webhook/ba56ddca-b81b-4167-ae9a-d486f428d5db';
const N8N_REDIRECT_BASE =
  'https://n8n.zeeshanai.cloud/webhook/d3991e9b-c4bc-4dc4-8297-fd21d55c02b6/r/';

// A short code is a single path segment of [A-Za-z0-9_-] with no dot — the same
// shape as the old vercel.json rewrite, so it never collides with the dotted
// static assets (og-image.png, robots.txt, …).
const SHORT_CODE_RE = /^\/([A-Za-z0-9_-]+)$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map':  'application/json; charset=utf-8',
};

// Per-path headers mirroring vercel.json (content-type overrides + cache).
function headersFor(urlPath, ext) {
  const h = {};
  if (urlPath === '/robots.txt') {
    h['Cache-Control'] = 'public, max-age=86400';
    h['Content-Type'] = 'text/plain; charset=utf-8';
  } else if (urlPath === '/sitemap.xml') {
    h['Cache-Control'] = 'public, max-age=86400';
    h['Content-Type'] = 'application/xml; charset=utf-8';
  } else if (urlPath === '/manifest.json') {
    h['Cache-Control'] = 'public, max-age=604800';
    h['Content-Type'] = 'application/manifest+json';
  } else if (urlPath === '/og-image.png' || urlPath === '/apple-touch-icon.png') {
    h['Cache-Control'] = 'public, max-age=2592000, immutable';
  } else if (ext === '.ico') {
    h['Cache-Control'] = 'public, max-age=2592000, immutable';
  } else if (urlPath === '/' || urlPath === '/index.html') {
    h['Cache-Control'] = 'public, max-age=0, must-revalidate';
    h['X-Content-Type-Options'] = 'nosniff';
    h['X-Frame-Options'] = 'DENY';
    h['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }
  if (!h['Content-Type']) h['Content-Type'] = MIME[ext] || 'application/octet-stream';
  return h;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// ── POST /api/webhook — inject the API key, proxy to n8n ─────────────────────
async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, {
      error: 'server_misconfigured',
      message: 'N8N_API_KEY environment variable is not set on this deployment.',
    });
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) req.destroy(); // guard against oversized payloads
  });
  req.on('end', async () => {
    try {
      const n8nRes = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: body || '{}',
      });
      const data = await n8nRes.json();
      return sendJson(res, n8nRes.status, data);
    } catch (err) {
      return sendJson(res, 502, {
        error: 'upstream_error',
        message: 'Could not reach the n8n webhook.',
      });
    }
  });
}

// ── Short-code redirect — proxy to n8n, relay its 302 ────────────────────────
async function handleRedirect(res, code) {
  if (!code) return sendJson(res, 400, { error: 'missing_code' });
  try {
    const n8nRes = await fetch(`${N8N_REDIRECT_BASE}${encodeURIComponent(code)}`, {
      method: 'GET',
      redirect: 'manual', // capture the 302 instead of following it
    });
    const location = n8nRes.headers.get('location');
    if ((n8nRes.status === 301 || n8nRes.status === 302) && location) {
      res.writeHead(302, { Location: location });
      return res.end();
    }
    // n8n returned non-redirect (e.g. 404 for unknown code)
    const data = await n8nRes.json().catch(() => ({ error: 'not_found' }));
    return sendJson(res, n8nRes.status, data);
  } catch (err) {
    return sendJson(res, 502, {
      error: 'upstream_error',
      message: 'Could not reach the redirect service.',
    });
  }
}

// ── Static file serving ──────────────────────────────────────────────────────
function serveStatic(urlPath, res) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath.slice(1));
  const filePath = path.join(ROOT, rel);
  // Path-traversal guard: resolved path must stay inside ROOT.
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    return false;
  }
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, headersFor(urlPath, ext));
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // 1. Webhook proxy
  if (urlPath === '/api/webhook') return handleWebhook(req, res);

  // 2. Direct redirect endpoint
  if (urlPath === '/api/redirect' && req.method === 'GET') {
    const code = new URL(req.url, `http://${req.headers.host}`).searchParams.get('code');
    return handleRedirect(res, code);
  }

  // 3. Static file (index.html at /, images, robots/sitemap/manifest, icons)
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (serveStatic(urlPath, res)) return;

    // 4. Short-code redirect (single dotless segment)
    const m = urlPath.match(SHORT_CODE_RE);
    if (m) return handleRedirect(res, m[1]);
  }

  // 5. Nothing matched
  return sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`SNIP server listening on port ${PORT}`);
});
