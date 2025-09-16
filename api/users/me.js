// /api/users/me.js
export default async function handler(req, res) {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate our simple token format
    if (!token.startsWith('qiq_')) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    try {
      // Decode our simple token
      const payload = JSON.parse(Buffer.from(token.substring(4), 'base64').toString());
      
      // Check if token is expired
      if (payload.exp && payload.exp < Date.now()) {
        return res.status(401).json({ error: "Token expired" });
      }

      // Return user data
      const userData = {
        id: payload.id,
        email: payload.email,
        company: payload.company,
        name: payload.company // Use company name as display name
      };

      return res.status(200).json({ 
        ok: true, 
        user: userData 
      });

    } catch (decodeError) {
      return res.status(401).json({ error: "Invalid token" });
    }

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
