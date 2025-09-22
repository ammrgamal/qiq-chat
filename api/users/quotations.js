import { quotationStorage, activityStorage } from '../storage/quotations.js';
import { sendEmail } from '../_lib/email.js';

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
      // Require at least a project name; if missing, return 400 so frontend can prompt
      const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
      let projectName = body?.project?.name || '';
      if (!projectName) {
        if (!AUTO_APPROVE) {
          return res.status(400).json({ error: 'PROJECT_NAME_REQUIRED' });
        }
        projectName = `Project ${new Date().toISOString().slice(0,10)}`;
      }

      // Generate sequential-like projectId using date + counter from storage
      // We'll compute next sequence by counting existing user's quotations for the year
      const year = new Date().getFullYear();
      const basePrefix = `QT-${year}`;
      let seq = 1;
      try {
        const existing = await quotationStorage.getByUser(token);
        const mine = existing.filter(q => (q.id||'').startsWith(basePrefix));
        // Extract numeric suffixes
        const nums = mine.map(q => {
          const m = (q.id||'').match(/QT-\d{4}-(\d{3,})/); return m? Number(m[1]) : 0;
        }).filter(n=>!isNaN(n));
        seq = (nums.length? Math.max(...nums) : 0) + 1;
      } catch {}
      const seqStr = String(seq).padStart(3,'0');
      const id = body.number || `${basePrefix}-${seqStr}`;
      
      const quotationData = {
        id, 
        date: body.date || new Date().toISOString().slice(0,10), 
        status: 'مسودة', 
        currency: body.currency||'USD', 
        total: body?.totals?.grand || '-', 
        clientName: body?.client?.name || '', 
        payload: body,
        projectId: id,
        projectName,
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
        
        // Try to notify via email (admin + user) if configured
        try{
          const adminTo = process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_TO || ''; // destination for admin
          const userTo  = quotationData.userEmail;
          const items   = Array.isArray(quotationData?.payload?.items) ? quotationData.payload.items : [];
          const lines   = items.slice(0,20).map((it,i)=> `${i+1}. ${it.description||it.name||'-'} ${it.pn?`(${it.pn})`:''} x${it.qty||1} @ ${it.unit||it.price||''}`).join('<br/>');
          const html = `
            <div style="font-family:Segoe UI,Arial">
              <h3 style="margin:0 0 8px">New quotation saved: ${id}</h3>
              <div>Date: ${quotationData.date} • Currency: ${quotationData.currency}</div>
              <div>Client: ${quotationData.clientName || '-'}</div>
              <hr style="border:0;border-top:1px solid #e5e7eb;margin:10px 0"/>
              <div>${lines || 'No items provided'}</div>
            </div>`;
          if (adminTo) { try{ await sendEmail({ to: adminTo, subject: `New quotation ${id}`, html }); }catch{} }
          if (userTo)  { try{ await sendEmail({ to: userTo, subject: `Your quotation ${id}`, html }); }catch{} }
        }catch{}

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