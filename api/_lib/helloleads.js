// api/_lib/helloleads.js — HelloLeads integration helpers (ESM)

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
  const listName = process.env.HELLOLEADS_LIST_NAME || process.env.HELLO_LEADS_LIST_NAME || '';
  const ghuid = process.env.HELLOLEADS_GHUID || process.env.HELLO_LEADS_GHUID || process.env.HELLOLEADS_GH_UID || '';
  // Documented URL-based AuthLead endpoint (token in URL)
  const endpoint = process.env.HELLOLEADS_ENDPOINT
    || process.env.HELLO_LEADS_ENDPOINT
    || 'https://app.helloleads.io/index.php/private/integrate/AuthLead';
  return { apiKey, listKey, listName, ghuid, endpoint };
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

export async function createLead({ client={}, project={}, items=[], number='', date='', source='qiq-quote', visitor={}, quotation={} }={}){
  const { apiKey, listKey, ghuid, endpoint } = readHelloLeadsEnv();
  if (!apiKey || !listKey){
    return { ok:false, skipped:true, reason:'missing_keys', provider:'HelloLeads' };
  }

  // Prepare concise notes (cap items to avoid very long payloads)
  const lines = (Array.isArray(items)?items:[]).slice(0, 30).map((it,i)=>`${i+1}. ${it.description||it.name||''}${it.pn?` [${it.pn}]`:''} x${it.qty||1}`);
  const notes = [
    `Quotation ${number||''} ${date?('('+date+')'):''}`.trim(),
    project.name ? `Project: ${project.name}` : '',
    quotation.total ? `Total: ${quotation.currency||'USD'} ${quotation.total}` : '',
    visitor.utm?.utm_source ? `Source: ${visitor.utm.utm_source}${visitor.utm.utm_medium ? '/'+visitor.utm.utm_medium : ''}` : '',
    visitor.ipAddress && visitor.ipAddress !== 'unknown' ? `IP: ${visitor.ipAddress}` : '',
    lines.length ? 'Items:\n'+lines.join('\n') : ''
  ].filter(Boolean).join('\n');

  // Split name into first/last for API fields
  const fullName = (client.contact || client.name || '').trim();
  const [first_name, ...rest] = fullName ? fullName.split(/\s+/) : [''];
  const last_name = rest.join(' ').trim();

  // Optional mobile_code support (e.g., +20); strip non-digits as API expects numeric
  const mobile_code_raw = client.mobile_code || client.country_code || '';
  const mobile_code = String(mobile_code_raw || '').replace(/[^0-9]/g,'');

  // Build JSON payload per HelloLeads POST (URL auth)
  const body = {
    list_key: listKey,
    first_name,
    last_name,
    company: client.name || '',
    designation: client.title || client.role || '',
    email: client.email || '',
    mobile: client.mobile || client.phone || client.tel || '',
    ...(mobile_code ? { mobile_code } : {}),
    phone: client.phone || '',
    address_line1: client.address_line1 || '',
    address_line2: client.address_line2 || '',
    city: client.city || '',
    state: client.state || '',
    country: client.country || '',
    potential: (quotation && quotation.total != null) ? String(quotation.total) : undefined,
    tags: source,
    notes
  };
  if (ghuid) body.ghuid = ghuid;

  try{
    const url = endpoint.includes('?')
      ? `${endpoint}&token=${encodeURIComponent(apiKey)}`
      : `${endpoint}?token=${encodeURIComponent(apiKey)}`;
    const r = await fetchWithRetry(url, {
      method:'POST',
      headers:{ 'content-type':'application/json', 'accept':'application/json,text/plain,*/*' },
      body: JSON.stringify(body)
    }, { retries: 1 });
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
