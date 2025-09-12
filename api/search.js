// api/search.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body;

    // Agent Studio details
    const AGENT_API_URL = "https://R4ZBQNB1VE.algolia.net/agent-studio/1/agents/30281a71-4e7a-4c40-a135-2c65a562f411/response"; 
    const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
    const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;

    // call Algolia Agent
    const response = await fetch(AGENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-algolia-application-id": ALGOLIA_APP_ID,
        "x-algolia-api-key": ALGOLIA_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: query }
        ]
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("Search API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
