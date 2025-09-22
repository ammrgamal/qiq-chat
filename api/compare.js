import dotenv from 'dotenv';
try { dotenv.config(); } catch {}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { products } = req.body || {};
    if (!Array.isArray(products) || products.length < 2) {
      return res.status(400).json({ error: 'Need at least two products' });
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const safeProducts = products.map(p => ({
      name: String(p.name || ''),
      pn: String(p.pn || p.sku || ''),
      brand: String(p.brand || p.manufacturer || ''),
      price: Number(p.price || 0),
      features: Array.isArray(p.features) ? p.features.slice(0, 12) : []
    }));

    if (!hasOpenAI) {
      // fallback: simple table data
      const summary = `Comparison (fallback):\n` + safeProducts.map(p => `- ${p.brand} ${p.name} (${p.pn}) • USD ${p.price}`).join('\n');
      return res.json({ ok: true, provider: 'fallback', comparison: safeProducts, summaryMarkdown: '```\n' + summary + '\n```' });
    }

    // Build prompt stressing factual comparison and "no fabrication"
    const system = `You are a technical procurement assistant. Compare networking or IT products strictly and factually. If a feature is unknown, say Unknown. Provide a concise, trustworthy comparison with a table of key features (CPU, RAM, Ports, Speed, Form factor, Warranty, Power, Notable features) and a short recommendation.`;
    const user = `Compare the following products and highlight their key differences. Return a concise markdown with:\n1) A feature table.\n2) Pros/cons bullets per item.\n3) A recommendation line.\nProducts JSON:\n${JSON.stringify(safeProducts, null, 2)}`;

    // Use OpenAI Responses API if available (gpt-4o-mini or similar)
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const resp = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        temperature: 0.2,
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(500).json({ error: 'OpenAI error', details: errText });
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || 'No response';
    return res.json({ ok: true, provider: 'openai', comparison: safeProducts, summaryMarkdown: content });
  } catch (e) {
    console.error('compare api error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
