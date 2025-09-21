import { quotationStorage, activityStorage } from '../storage/quotations.js';

export default async function handler(req, res) {
  // Auth for both GET and POST
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No authorization token provided" });
  }
  const token = authHeader.substring(7);
  if (!token.startsWith('qiq_')) {
    return res.status(401).json({ error: "Invalid token format" });
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(token.substring(4), 'base64').toString()); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
  if (payload.exp && payload.exp < Date.now()) {
    return res.status(401).json({ error: "Token expired" });
  }

  if (req.method === 'POST'){
    try{
      const body = req.body || {};
      const id = body.number || `QT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      
      const quotationData = {
        id, 
        date: body.date || new Date().toISOString().slice(0,10), 
        status: 'مسودة', 
        currency: body.currency||'USD', 
        total: body?.totals?.grand || '-', 
        clientName: body?.client?.name || '', 
        payload: body,
        userToken: token,
        userEmail: payload.email
      };
      
      // Save to persistent storage
      const savedQuotation = await quotationStorage.save(quotationData);
      
      if (savedQuotation) {
        // Log activity
        await activityStorage.log({
          action: 'quotation_save',
          userEmail: payload.email,
          userToken: token,
          quotationId: id,
          details: { 
            clientName: quotationData.clientName,
            total: quotationData.total,
            currency: quotationData.currency
          }
        });
        
        return res.status(200).json({ ok:true, id, record: savedQuotation });
      } else {
        return res.status(500).json({ error: 'Failed to save quotation' });
      }
    }catch(e){
      console.warn('save quotation error', e);
      return res.status(500).json({ error:'Failed to save quotation' });
    }
  }
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Get user's quotations from persistent storage
    const userQuotations = await quotationStorage.getByUser(token);
    
    // Log activity
    await activityStorage.log({
      action: 'quotations_view',
      userEmail: payload.email,
      userToken: token,
      details: { count: userQuotations.length }
    });

    // Mock quotations for demo
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

    const result = [...userQuotations, ...mockQuotations];
    return res.status(200).json({ ok: true, quotations: result, total: result.length });

  } catch (error) {
    console.error('Error fetching quotations:', error);
    return res.status(500).json({ error: "Server error" });
  }
}