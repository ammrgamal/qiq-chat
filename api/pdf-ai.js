// api/pdf-ai.js — Generates titles/headings and product details using OpenAI or Gemini (with graceful fallback)
import dotenv from 'dotenv';
try { dotenv.config(); } catch {}

export default async function handler(req, res){
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try{
  const { client={}, project={}, items=[], currency='USD', imageUrls=[], pdfUrls=[], webUrls=[], translate=null } = req.body || {};
    const safeItems = Array.isArray(items) ? items.slice(0, 30) : [];
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.Gemini_API || process.env.GEMINI_API || process.env.GOOGLE_API_KEY;
  const enableGpt5 = String(process.env.ENABLE_GPT5_ALL || "").toLowerCase() === "true";
  // Effective auto-approve: env OR admin override from config file
  let autoApprove = String(process.env.AUTO_APPROVE || "").toLowerCase() === 'true' || String(process.env.AUTO_APPROVE || '') === '1';
  let allowedDomains = [];
  try{
    const fs = (await import('fs/promises')).default;
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../.storage');
    const CONFIG_FILE = path.join(STORAGE_DIR, 'admin-config.json');
    try{
      const t = await fs.readFile(CONFIG_FILE,'utf8');
      const j = JSON.parse(t);
      if (j?.ai?.autoApproveOverride) autoApprove = true;
      if (Array.isArray(j?.ai?.allowedDomains)) allowedDomains = j.ai.allowedDomains.map(String);
    }catch{}
  }catch{}
    const chatModel = enableGpt5 ? (process.env.OPENAI_GPT5_MODEL || "gpt-5") : (process.env.OPENAI_MODEL || "gpt-4o-mini");
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // Helper for English-only fallback
    const englishOnly = (s) => String(s||'').replace(/[^A-Za-z0-9\s\.,;:!\?@#%&\-_\(\)\[\]\/\+\'\"]/g, ' ').replace(/[\s\u00A0]+/g,' ').trim();

    // Fast path: translation request
    if (translate) {
      try{
        // Normalize translate input to an object map {key: text}
        let map = {};
        if (Array.isArray(translate)) {
          translate.forEach((v, i)=>{ map[String(i)] = String(v||''); });
        } else if (typeof translate === 'object') {
          Object.keys(translate).forEach(k=>{ map[String(k)] = String(translate[k]||''); });
        }
        const keys = Object.keys(map);
        if (!keys.length) return res.status(200).json({ ok:true, translations: {} });

        const system = [
          'You translate each provided value to clear, professional English suitable for a business quotation PDF.',
          'Preserve numbers, units, punctuation, and product codes. Avoid adding extra words; translate only.',
          'Return strictly valid JSON: an object mapping the SAME KEYS to their English translations.'
        ].join('\n');
        const user = { translate: map };

        // Prefer OpenAI for text translation; fallback to Gemini; then to local englishOnly.
        if (openaiKey) {
          try{
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
              method:'POST',
              headers:{ 'authorization': `Bearer ${openaiKey}`, 'content-type':'application/json' },
              body: JSON.stringify({
                model: chatModel,
                temperature: 0.2,
                messages:[ {role:'system', content: system}, {role:'user', content: JSON.stringify(user)} ],
                response_format: { type:'json_object' }
              })
            });
            if (r.ok){
              const j = await r.json();
              const content = j?.choices?.[0]?.message?.content || '{}';
              let data = null; try{ data = JSON.parse(content); }catch{}
              if (data && typeof data === 'object') {
                return res.status(200).json({ ok:true, translations: data, provider:'openai-translate' });
              }
            }
          }catch{}
        }

        if (geminiKey) {
          try{
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
              method:'POST', headers:{ 'content-type':'application/json' },
              body: JSON.stringify({
                contents: [{ role:'user', parts:[ { text: system }, { text: 'Input:' }, { text: JSON.stringify(user) } ] }],
                generationConfig: { temperature: 0.2, responseMimeType:'application/json' }
              })
            });
            if (r.ok){
              const j = await r.json();
              const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              let data = null; try{ data = JSON.parse(text); }catch{}
              if (data && typeof data === 'object') {
                return res.status(200).json({ ok:true, translations: data, provider:'gemini-translate' });
              }
            }
          }catch{}
        }

        // Local fallback: strip non-Latin
        const fallbackMap = {}; keys.forEach(k=> fallbackMap[k] = englishOnly(map[k]));
        return res.status(200).json({ ok:true, translations: fallbackMap, provider:'local-fallback' });
      }catch(e){
        // On any error, fallback to englishOnly
        try{
          let map = {};
          if (Array.isArray(translate)) translate.forEach((v,i)=> map[String(i)] = String(v||''));
          else if (typeof translate === 'object') Object.keys(translate).forEach(k=> map[k] = String(translate[k]||''));
          const keys = Object.keys(map);
          const fallbackMap = {}; keys.forEach(k=> fallbackMap[k] = englishOnly(map[k]));
          return res.status(200).json({ ok:true, translations: fallbackMap, provider:'exception-fallback' });
        }catch{
          return res.status(200).json({ ok:true, translations: {}, provider:'exception-fallback' });
        }
      }
    }

    const fallback = () => ({
      coverTitle: `عرض سعر | Quotation`,
      coverSubtitle: project?.name ? `المشروع: ${project.name} • Project: ${project.name}` : '',
      headings: {
        letter: 'خطاب الغلاف | Cover Letter',
        boq: 'جدول الكميات | Bill of Quantities',
        terms: 'الشروط والأحكام | Terms & Conditions',
        productDetails: 'تفاصيل المنتجات | Product Details'
      },
      letter: {
        ar: `شكرًا لطلبكم عرض السعر لمشروع "${project?.name || ''}". نرفق لكم جدول الكميات والأسعار والشروط القياسية. لأي استفسار، يسعدنا التواصل.`.trim(),
        en: `Thank you for considering our quotation for "${project?.name || 'your project'}". Please find the BOQ, pricing, and standard terms enclosed. Happy to clarify anything.`
      },
      products: safeItems.map(it=>({
        pn: it.pn || '',
        title: `${(it.description||'Item')} ${it.pn?('('+it.pn+')'):''}`.trim(),
        bullets: [
          (it.brand ? `• Brand: ${it.brand}` : null),
          (it.description ? `• ${it.description}` : null)
        ].filter(Boolean)
      }))
    });

    // Helper: fetch URL into base64 for Gemini inlineData
    let infoNotes = [];
    function isAllowed(url){
      try{
        if (!allowedDomains || !allowedDomains.length) return true; // allow all if none specified
        const u = new URL(url);
        return allowedDomains.some(dom => u.hostname.endsWith(dom));
      }catch{ return false; }
    }
    async function fetchAsInlineData(url){
      try{
        if (!autoApprove){ infoNotes.push('Remote fetch disabled (AUTO_APPROVE=0, no override)'); return null; }
        if (!isAllowed(url)){ infoNotes.push('Blocked by allowedDomains'); return null; }
        const r = await fetch(url);
        if (!r.ok) return null;
        const ct = r.headers.get('content-type') || '';
        const buf = await r.arrayBuffer();
        // Cap 8MB to be safe
        if (buf.byteLength > 8*1024*1024) return null;
        const b64 = Buffer.from(buf).toString('base64');
        const mimeType = ct.split(';')[0] || 'application/octet-stream';
        return { inlineData: { mimeType, data: b64 } };
      }catch{ return null; }
    }

    // Decide provider: If there are media/links and Gemini key exists, try Gemini first; else OpenAI
    const hasMediaOrLinks = (Array.isArray(imageUrls)&&imageUrls.length) || (Array.isArray(pdfUrls)&&pdfUrls.length) || (Array.isArray(webUrls)&&webUrls.length);
    const preferGemini = hasMediaOrLinks && !!geminiKey;

    const systemPrompt = [
      'You are a bilingual (Arabic first, then English) presales assistant for building quotation PDFs.',
      'Produce concise, professional titles and headings for the cover and sections, and short product notes.',
      'Keep Arabic first, then English where relevant. Avoid marketing fluff. Keep bullets short.',
      'Return strictly valid JSON matching the response schema.'
    ].join('\n');

    const userPrompt = {
      client: { name: client?.name||'', contact: client?.contact||'' },
      project: { name: project?.name||'', site: project?.site||'', execution_date: project?.execution_date||'' },
      currency,
      items: safeItems.map(it=>({ description: it.description||'', pn: it.pn||'', brand: it.brand||'' }))
    };

    const schema = {
      type: 'object',
      properties: {
        coverTitle: { type: 'string' },
        coverSubtitle: { type: 'string' },
        headings: {
          type: 'object',
          properties: {
            letter: { type: 'string' },
            boq: { type: 'string' },
            terms: { type: 'string' },
            productDetails: { type: 'string' }
          },
          required: ['letter','boq','terms','productDetails']
        },
        letter: {
          type: 'object',
          properties: { ar: {type:'string'}, en: {type:'string'} },
          required: ['ar','en']
        },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pn: { type: 'string' },
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } }
            },
            required: ['title','bullets']
          }
        }
      },
      required: ['coverTitle','headings','letter','products']
    };

    // Try Gemini when it makes sense
    if (preferGemini) {
      try{
        const parts = [ { text: [
          'You are a bilingual (Arabic first, then English) presales assistant for building quotation PDFs.',
          'Produce concise, professional titles and headings for the cover and sections, and short product notes.',
          'Keep Arabic first, then English. Avoid marketing fluff. Keep bullets short.',
          'Return strictly valid JSON matching the response schema.'
        ].join('\n') }, { text: 'User Input:' }, { text: JSON.stringify(userPrompt) } ];

        // Attach media
        const urls = [...(imageUrls||[]), ...(pdfUrls||[])].slice(0, 5);
        for (const u of urls){ const p = await fetchAsInlineData(u); if (p) parts.push(p); }
        // Include web URLs as plain text references (Gemini may not fetch, but can consider context)
        if (Array.isArray(webUrls) && webUrls.length) parts.push({ text: 'Web references: ' + webUrls.join(', ') });

        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
          method:'POST', headers:{ 'content-type':'application/json' },
          body: JSON.stringify({
            contents: [{ role:'user', parts }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
          })
        });
        if (r.ok){
          const j = await r.json();
          const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          let data = null; try{ data = JSON.parse(text); }catch{}
          if (data) return res.status(200).json({ ok:true, data, provider:'gemini', note: infoNotes.join('; ') || undefined });
        }
      }catch(e){ /* fall through to OpenAI */ }
    }

    // OpenAI path (default for pure text or as fallback)
    if (!openaiKey) {
      return res.status(200).json({ ok: true, data: fallback(), note: 'AI keys not set; using defaults' });
    }
    try{
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${openaiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          temperature: 0.4,
          messages: [
            { role:'system', content: systemPrompt },
            { role:'user', content: 'Generate titles/headings and a short cover letter and bullets for products based on this input (Arabic first, then English where suitable). Return strictly valid JSON.' },
            { role:'user', content: JSON.stringify(userPrompt) }
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'qiq_pdf_ai', schema, strict: true } }
        })
      });
      if (r.ok){
        const j = await r.json();
        const content = j?.choices?.[0]?.message?.content || '';
        let data = null; try { data = JSON.parse(content); } catch {}
        if (data) return res.status(200).json({ ok: true, data, provider:'openai', note: infoNotes.join('; ') || undefined });
      }
      return res.status(200).json({ ok:true, data: fallback(), note: (infoNotes.join('; ') + '; OpenAI failed').trim() });
    }catch{
      return res.status(200).json({ ok:true, data: fallback(), note: (infoNotes.join('; ') + '; exception fallback').trim() });
    }
  }catch(e){
    console.warn('pdf-ai error', e);
    return res.status(200).json({ ok:true, data: { coverTitle: 'عرض سعر | Quotation', headings: { letter:'خطاب الغلاف | Cover Letter', boq:'جدول الكميات | Bill of Quantities', terms:'الشروط والأحكام | Terms & Conditions', productDetails:'تفاصيل المنتجات | Product Details' }, letter: { ar:'', en:'' }, products: [] }, note:'exception fallback' });
  }
}
