// pages/api/agent.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body;

    const agentRes = await fetch(
      `https://${process.env.ALGOLIA_APP_ID}.algolia.net/agent-studio/1/agents/${process.env.ALGOLIA_AGENT_ID}/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-algolia-api-key": process.env.ALGOLIA_API_KEY,
          "x-algolia-application-id": process.env.ALGOLIA_APP_ID,
        },
        body: JSON.stringify({
          message: query,
          conversation: "qiq-chat",
        }),
      }
    );

    const data = await agentRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Agent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
