// Vercel serverless function — proxies short code redirects to n8n
// When a user visits https://shorturl.zeeshanai.cloud/:code, this function
// calls the n8n redirect webhook which responds with HTTP 302 to the original URL.

const N8N_REDIRECT_BASE =
  'https://n8n.zeeshanai.cloud/webhook/d3991e9b-c4bc-4dc4-8297-fd21d55c02b6/r/';

module.exports = async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: 'missing_code' });
  }

  try {
    const n8nRes = await fetch(`${N8N_REDIRECT_BASE}${code}`, {
      method: 'GET',
      redirect: 'manual', // capture the 302 instead of following it
    });

    const location = n8nRes.headers.get('location');
    if ((n8nRes.status === 301 || n8nRes.status === 302) && location) {
      return res.redirect(302, location);
    }

    // n8n returned non-redirect (e.g. 404 for unknown code)
    const data = await n8nRes.json().catch(() => ({ error: 'not_found' }));
    return res.status(n8nRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      error: 'upstream_error',
      message: 'Could not reach the redirect service.',
    });
  }
};
