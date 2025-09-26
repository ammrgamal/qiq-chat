// api/_lib/helloleads.js — shared HelloLeads integration helpers (ESM)

function readHelloLeadsEnv(){
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
  return { apiKey, listKey, endpoint };
}

async function fetchWithRetry(url, opts, { retries = 1, backoffMs = 800 } = {}){
  let lastErr;
  for (let i=0;i<=retries;i++){
    try{
      const r = await fetch(url, { ...opts, signal: opts?.signal, redirect: 'follow' });
      if (r.status === 429 && i < retries){ await new Promise(s=>setTimeout(s, backoffMs)); continue; }
      return r;
    }catch(e){ lastErr = e; if (i < retries) await new Promise(s=>setTimeout(s, backoffMs)); }
  }
  throw lastErr || new Error('fetch failed');
}

export async function createLead({ client={}, project={}, items=[], number='', date='', source='qiq-quote' }={}){
  const { apiKey, listKey, endpoint } = readHelloLeadsEnv();
  if (!apiKey || !listKey){
    return { ok:false, skipped:true, reason:'missing_keys', provider:'HelloLeads' };
  }
  const lines = (Array.isArray(items)?items:[]).slice(0, 30).map((it,i)=>`${i+1}. ${it.description||it.name||''}${it.pn?` [${it.pn}]`:''} x${it.qty||1}`);
  const notes = [
    `Quotation ${number||''} ${date?('('+date+')'):''}`.trim(),
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
    source,
    notes
  };

  try{
    const r = await fetchWithRetry(endpoint, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) }, { retries: 1 });
    const text = await r.text();
    const ok = r.status >= 200 && r.status < 300;
    return { ok, provider:'HelloLeads', status:r.status, response:text };
  }catch(e){
    return { ok:false, provider:'HelloLeads', error: String(e?.message||e) };
  }
}

export function hasHelloLeads(){
  const { apiKey, listKey } = readHelloLeadsEnv();
  return Boolean(apiKey && listKey);
}
