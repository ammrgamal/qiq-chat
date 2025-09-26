// api/hello-leads.js — Create a lead in HelloLeads using shared helper
import { createLead } from './_lib/helloleads.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  try{
    const body = req.body || {};
    const r = await createLead({
      client: body.client,
      project: body.project,
      items: Array.isArray(body.items)? body.items : [],
      number: body.number || '',
      date: body.date || '',
      source: 'qiq-quote'
    });
    if (r.skipped){ return res.status(200).json(r); }
    return res.status(r.ok?200:502).json(r);
  }catch(e){
    console.warn('hello-leads error', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}
