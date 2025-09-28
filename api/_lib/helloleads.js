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
  const listName = process.env.HELLOLEADS_LIST_NAME || process.env.HELLO_LEADS_LIST_NAME || '';
  const endpoint = process.env.HELLOLEADS_ENDPOINT
    || process.env.HELLO_LEADS_ENDPOINT
    || 'https://app.helloleads.io/index.php/api/leads/add/';
  return { apiKey, listKey, listName, endpoint };
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
  const { apiKey, listKey, listName, endpoint } = readHelloLeadsEnv();
  if (!apiKey || !listKey){
    return { ok:false, skipped:true, reason:'missing_keys', provider:'HelloLeads' };
  }
  const lines = (Array.isArray(items)?items:[]).slice(0, 30).map((it,i)=>`${i+1}. ${it.description||it.name||''}${it.pn?` [${it.pn}]`:''} x${it.qty||1}`);
  
  // Enhanced notes with visitor and quotation info
  const notes = [
    `Quotation ${number||''} ${date?('('+date+')'):''}`.trim(),
    project.name ? `Project: ${project.name}` : '',
    project.requester_role ? `Role: ${project.requester_role}` : '',
    project.expected_closing_date ? `Expected Close: ${project.expected_closing_date}` : '',
    quotation.total ? `Total: ${quotation.currency||'USD'} ${quotation.total}` : '',
    quotation.itemCount ? `Items: ${quotation.itemCount}` : '',
    visitor.browser ? `Browser: ${visitor.browser}/${visitor.os}` : '',
    visitor.utm?.utm_source ? `Source: ${visitor.utm.utm_source}${visitor.utm.utm_medium ? '/'+visitor.utm.utm_medium : ''}` : '',
    visitor.ipAddress && visitor.ipAddress !== 'unknown' ? `IP: ${visitor.ipAddress}` : '',
    lines.length ? 'Items:\n'+lines.join('\n') : ''
  ].filter(Boolean).join('\n');

  // HelloLeads expects at least: apikey, listkey, name, email, mobile
  // We'll include extended metadata as additional fields (typically ignored if unknown)
  const minimal = {
    apikey: apiKey,
    listkey: listKey,
    name: client.contact || client.name || '',
    email: client.email || '',
    mobile: client.mobile || client.phone || client.tel || ''
  };
  const extended = {
    company: client.name || '',
    listName,
    source,
    notes,
    projectName: project.name || '',
    requesterRole: project.requester_role || '',
    expectedClosingDate: project.expected_closing_date || '',
    quotationId: number,
    quotationDate: date,
    quotationTotal: quotation.total || 0,
    quotationCurrency: quotation.currency || 'USD',
    quotationItemCount: quotation.itemCount || 0,
    quotationAction: quotation.action || 'unknown',
    visitorIp: visitor.ipAddress || '',
    visitorBrowser: visitor.browser || '',
    visitorOs: visitor.os || '',
    visitorDevice: visitor.device || '',
    visitorReferer: visitor.referer || '',
    visitorSessionId: visitor.sessionId || '',
    utmSource: visitor.utm?.utm_source || '',
    utmMedium: visitor.utm?.utm_medium || '',
    utmCampaign: visitor.utm?.utm_campaign || '',
    utmTerm: visitor.utm?.utm_term || '',
    utmContent: visitor.utm?.utm_content || ''
  };
  const payload = { ...minimal, ...extended };

  try{
    // Strategy: JSON first; if 404/400/415, try form-encoded; also try URL variants
    const attempts = [];
    const endpoints = (()=>{
      const e = (endpoint||'').trim();
      const forms = new Set();
      if (e) forms.add(e);
      if (e.endsWith('/')) forms.add(e.slice(0,-1)); else forms.add(e + '/');
      // Add format hints
      for (const base of Array.from(forms)){
        if (!base.includes('?')){
          forms.add(base + '?format=json');
        }
      }
      return Array.from(forms);
    })();

    const encForm = (obj)=>{
      const usp = new URLSearchParams();
      for (const [k,v] of Object.entries(obj)){
        // Only append defined, non-object scalars; put extended metadata into notes (already consolidated)
        if (v === undefined || v === null) continue;
        if (typeof v === 'object') continue;
        usp.append(k, String(v));
      }
      return usp.toString();
    };

    const tryOnce = async (url, useJson)=>{
      if (useJson){
        return fetchWithRetry(url, {
          method:'POST',
          headers:{ 'content-type':'application/json', 'accept':'application/json,text/plain,*/*' },
          body: JSON.stringify({ ...minimal, // ensure minimum fields
            // Keep extended mostly in notes to avoid unknown field rejections in some setups
            notes
          })
        }, { retries: 0 });
      }
      const body = encForm({ ...minimal, notes });
      return fetchWithRetry(url, {
        method:'POST',
        headers:{ 'content-type':'application/x-www-form-urlencoded', 'accept':'application/json,text/plain,*/*' },
        body
      }, { retries: 0 });
    };

    let lastText = '';
    let lastStatus = 0;
    for (const url of endpoints){
      // 1) JSON
      try{
        const r1 = await tryOnce(url, true);
        const t1 = await r1.text();
        attempts.push({ url, mode:'json', status:r1.status, body:t1.slice(0,200) });
        if (r1.status >= 200 && r1.status < 300){
          return { ok:true, provider:'HelloLeads', status:r1.status, response:t1 };
        }
        lastText = t1; lastStatus = r1.status;
        // If 404/400/415 then try form-encoded
        if ([400,404,415].includes(r1.status)){
          const r2 = await tryOnce(url, false);
          const t2 = await r2.text();
          attempts.push({ url, mode:'form', status:r2.status, body:t2.slice(0,200) });
          if (r2.status >= 200 && r2.status < 300){
            return { ok:true, provider:'HelloLeads', status:r2.status, response:t2 };
          }
          lastText = t2; lastStatus = r2.status;
        }
      }catch(e){
        attempts.push({ url, mode:'json', error:String(e?.message||e) });
        // Try form as fallback even if JSON request threw
        try{
          const r2 = await tryOnce(url, false);
          const t2 = await r2.text();
          attempts.push({ url, mode:'form', status:r2.status, body:t2.slice(0,200) });
          if (r2.status >= 200 && r2.status < 300){
            return { ok:true, provider:'HelloLeads', status:r2.status, response:t2 };
          }
          lastText = t2; lastStatus = r2.status;
        }catch(e2){
          attempts.push({ url, mode:'form', error:String(e2?.message||e2) });
        }
      }
    }
    return { ok:false, provider:'HelloLeads', status:lastStatus, response:lastText, attempts };
  }catch(e){
    return { ok:false, provider:'HelloLeads', error: String(e?.message||e) };
  }
}

export function hasHelloLeads(){
  const { apiKey, listKey } = readHelloLeadsEnv();
  return Boolean(apiKey && listKey);
}
