// /api/users/quotations.js
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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

      // Generate mock quotations for the user
      const mockQuotations = [
        {
          id: "QT-2024-001",
          date: "2024-01-15",
          clientName: "شركة التقنيات المتقدمة",
          status: "مكتمل",
          total: 15250,
          currency: "USD",
          itemsCount: 5,
          lastModified: "2024-01-15T10:30:00Z"
        },
        {
          id: "QT-2024-002", 
          date: "2024-01-20",
          clientName: "مؤسسة الحلول الذكية",
          status: "قيد المراجعة",
          total: 8900,
          currency: "USD",
          itemsCount: 3,
          lastModified: "2024-01-20T14:20:00Z"
        },
        {
          id: "QT-2024-003",
          date: "2024-01-25", 
          clientName: "شركة الابتكار التقني",
          status: "مسودة",
          total: 22150,
          currency: "USD",
          itemsCount: 8,
          lastModified: "2024-01-25T09:15:00Z"
        }
      ];

      return res.status(200).json({ 
        ok: true, 
        quotations: mockQuotations,
        total: mockQuotations.length
      });

    } catch (decodeError) {
      return res.status(401).json({ error: "Invalid token" });
    }

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}