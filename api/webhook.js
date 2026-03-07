// Vercel serverless function — proxies requests to n8n and injects the API key
// The API key is stored in Vercel Environment Variables, never sent to the browser.
//
// Setup in Vercel dashboard:
//   Project → Settings → Environment Variables → Add:
//     Name:  N8N_API_KEY
//     Value: <your actual key>
//     Environment: Production, Preview, Development (tick all three)

const N8N_WEBHOOK_URL =
  'https://n8n.zeeshanai.cloud/webhook/ba56ddca-b81b-4167-ae9a-d486f428d5db';

module.exports = async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'server_misconfigured',
      message: 'N8N_API_KEY environment variable is not set on this deployment.',
    });
  }

  try {
    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await n8nRes.json();
    return res.status(n8nRes.status).json(data);
  } catch (err) {
    return res.status(502).json({
      error: 'upstream_error',
      message: 'Could not reach the n8n webhook.',
    });
  }
};
