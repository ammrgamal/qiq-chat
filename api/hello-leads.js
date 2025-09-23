// api/hello-leads.js — Create a lead in HelloLeads using API key + list key from env
import dotenv from 'dotenv';
try{ dotenv.config(); }catch{}

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  try{
    const body = req.body || {};
    const client = body.client || {};
    const project = body.project || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // Env variables (support multiple spellings)
    const apiKey = process.env.HELLOLEADS_API_KEY
      || process.env.HELLO_LEADS_API_KEY
      || process.env.Heallo_Leads_API_Key_Token
      || process.env.HELLO_LEADS_API_KEY_TOKEN
      || '';
    const listKey = process.env.HELLOLEADS_LIST_KEY
      || process.env.HELLO_LEADS_LIST_KEY
      || process.env.Heallo_Leads_QuickITQuote_List_Key
      || '';
    const endpoint = process.env.HELLOLEADS_ENDPOINT
      || process.env.HELLO_LEADS_ENDPOINT
      || 'https://app.helloleads.io/index.php/api/leads/add';

    if (!apiKey || !listKey){
      return res.status(400).json({ ok:false, error:'HELLOLEADS keys missing', hint:'Set HELLOLEADS_API_KEY and HELLOLEADS_LIST_KEY (or the provided Heallo_… names) in environment.' });
    }

    // Prepare a concise note
    const lines = items.slice(0, 20).map((it,i)=>`${i+1}. ${it.description||it.name||''}${it.pn?` [${it.pn}]`:''} x${it.qty||1}`);
    const notes = [
      `Quotation ${body.number||''} ${body.date?('('+body.date+')'):''}`.trim(),
      project.name ? `Project: ${project.name}` : '',
      project.requester_role ? `Role: ${project.requester_role}` : '',
      project.expected_closing_date ? `Expected Close: ${project.expected_closing_date}` : '',
      lines.length ? 'Items:\n'+lines.join('\n') : ''
    ].filter(Boolean).join('\n');

    const payload = {
      apiKey,
      listKey,
      name: client.contact || client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      company: client.name || '',
      projectName: project.name || '',
      requesterRole: project.requester_role || '',
      expectedClosingDate: project.expected_closing_date || '',
      source: 'qiq-quote',
      notes
    };

    let hlStatus = 0, hlText = '';
    try{
      const r = await fetch(endpoint, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) });
      hlStatus = r.status;
      hlText = await r.text();
    }catch(e){
      return res.status(502).json({ ok:false, error:'Failed to reach HelloLeads', details: String(e?.message||e) });
    }

    // Consider any 2xx a success (API formats may vary)
    const ok = hlStatus >= 200 && hlStatus < 300;
    return res.status(ok?200:502).json({ ok, provider:'HelloLeads', status: hlStatus, response: hlText });
  }catch(e){
    console.warn('hello-leads error', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}
