module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, hitsPerPage } = req.body;

    // لو ناقص query
    if (!query) {
      return res.status(400).json({ error: "Missing query" });
    }

    // استخدم القيم اللي من الـ Environment
    const agentId = process.env.ALGOLIA_AGENT_ID;
    const appId = process.env.ALGOLIA_APP_ID;
    const apiKey = process.env.ALGOLIA_API_KEY;

    if (!agentId || !appId || !apiKey) {
      return res.status(500).json({ error: "Missing Algolia env vars" });
    }

    // استدعاء Algolia Agent API
    const resp = await fetch(
      `https://${appId}.algolia.net/agent-studio/1/agents/${agentId}/infer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-algolia-api-key": apiKey,
          "x-algolia-application-id": appId
        },
        body: JSON.stringify({
          input: query,
          searchParameters: { hitsPerPage: hitsPerPage || 5 }
        })
      }
    );

    if (!resp.ok) {
      const errTxt = await resp.text();
      return res.status(resp.status).json({ error: errTxt });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Agent API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
