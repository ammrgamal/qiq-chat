// api/chat.js — Enhanced with OpenAI Assistant API integration
import algoliasearch from "algoliasearch";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../.storage');
const CONFIG_FILE = path.join(STORAGE_DIR, 'admin-config.json');
const AI_DIR = path.join(__dirname, '../ai');
const AI_INSTRUCTIONS_FILE = path.join(AI_DIR, 'ai-instructions.txt');
let AI_CACHE = { text: '', mtimeMs: 0 };

// OpenAI Assistant Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Read assistant id from env to avoid hard-coding account-specific IDs
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || process.env.OPENAI_ASSISTANT || '';

async function readAiInstructionsCached(){
  try{
    const st = await fs.stat(AI_INSTRUCTIONS_FILE);
    if (!AI_CACHE.mtimeMs || st.mtimeMs !== AI_CACHE.mtimeMs){
      const txt = await fs.readFile(AI_INSTRUCTIONS_FILE,'utf8');
      AI_CACHE = { text: txt, mtimeMs: st.mtimeMs };
    }
    return AI_CACHE.text || '';
  }catch{
    AI_CACHE = { text: '', mtimeMs: 0 };
    return '';
  }
}

async function readAdminConfig(){
  try{ const txt = await fs.readFile(CONFIG_FILE,'utf8'); return JSON.parse(txt); }catch{ return { instructions:'', bundles:[] }; }
}

async function searchAlgolia({ query, hitsPerPage = 5 }) {
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY; // Search API Key (public/search)
  const index = process.env.ALGOLIA_INDEX || "woocommerce_products";
  if (!appId || !apiKey) return [];
  const client = algoliasearch(appId, apiKey);
  const idx = client.initIndex(index);
  const res = await idx.search(query, { hitsPerPage: Math.min(50, hitsPerPage) });
  return (res?.hits || []).map((h) => ({
    name: h.name || h.title || h.Description || "",
    price: h.price ?? h.Price ?? h["List Price"] ?? "",
    image: h.image || h["Image URL"] || h.thumbnail || "",
    sku: h.sku || h.SKU || h.pn || h["Part Number"] || h.product_code || "",
    link: h.link || h.product_url || h.url || h.permalink || "",
  }));
}

// Enhanced chat handler with OpenAI Assistant integration
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, thread_id, user_context } = req.body || {};
    
    // Handle direct OpenAI Assistant calls
    if (req.body.message && typeof req.body.message === 'string') {
      return await handleOpenAIAssistantChat(req.body, res);
    }
    
    // Legacy support for old message format
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "messages required" });
    }

    const FAST_MODE = /^(1|true|yes)$/i.test(String(process.env.FAST_MODE || process.env.AUTO_APPROVE || ""));
    const adminCfg = await readAdminConfig();
    const aiFile = await readAiInstructionsCached();
    
    // Try OpenAI Assistant first if available and assistant id configured
    if (OPENAI_API_KEY && ASSISTANT_ID && !FAST_MODE) {
      try {
        const lastMessage = messages[messages.length - 1]?.content || '';
        const assistantResponse = await callOpenAIAssistant(lastMessage, {
          thread_id,
          user_context,
          search_context: await getSearchContext(lastMessage)
        });
        
        if (assistantResponse.success) {
          return res.status(200).json({
            reply: assistantResponse.response,
            hits: assistantResponse.products || [],
            thread_id: assistantResponse.thread_id,
            tokens_used: assistantResponse.tokens_used
          });
        }
      } catch (error) {
        console.error('OpenAI Assistant error, falling back:', error);
      }
    }

  // Fallback to fast mode or legacy behavior
    const lastRaw = String(messages[messages.length - 1]?.content || '');
    const last = lastRaw.toLowerCase();
    const base = [
      'تمام — خلّيني أفهم احتياجك خطوة بخطوة:',
      '1) نوع الحل؟ (EDR/AV, Firewall, Wi‑Fi, O365, Backup, CCTV...)',
      '2) الكمية/السعة/عدد المستخدمين؟',
      '3) المدة أو الاشتراك (سنوي/شهري)؟',
      '4) تفضّل بدائل اقتصادية وممتازة؟',
      '',
      'EN: I will collect a few details to tailor a BOQ. What solution, how many users/devices, term, and do you want budget and premium options?'
    ].join('\n')
    + (adminCfg.instructions? ('\n\n[إرشادات المدير]\n'+adminCfg.instructions) : '')
    + (aiFile ? ('\n\n[System notes]\n' + aiFile.slice(0, 500)) : '');
    
    let reply = base;
    if (/(kaspersky|edr|endpoint)/i.test(last)) reply = 'Kaspersky/EDR — كم جهاز ومدة الترخيص (1Y/2Y)? هل في سيرفرات/VMs تحتاج حماية؟\nEN: For Kaspersky/EDR, how many endpoints and for how long? Any servers/VMs?';
    else if (/(office|microsoft|o365|m365)/i.test(last)) reply = 'Microsoft 365 — كم مستخدم؟ تحتاج Business Standard ولا E3/E5؟ مساحة البريد/التخزين؟\nEN: M365 — users count? Plan (Business Standard vs E3/E5)? Mail/storage needs?';
    else if (/(vmware|vsphere)/i.test(last)) reply = 'VMware — كم سيرفر؟ عدد المعالجات/الأنوية؟ تحتاج vCenter؟ المستوى (Standard/Enterprise)?\nEN: VMware — number of hosts, CPUs/cores, need vCenter, license tier?';
    else if (/(firewall|fortinet|palo|cisco|checkpoint)/i.test(last)) reply = 'Firewall — سرعة الانترنت/Throughput؟ عدد المستخدمين؟ تفضّل UTM/SD‑WAN؟\nEN: Firewall — Internet speed/throughput, users count, UTM/SD‑WAN preferred?';
    else if (/(wifi|access point|ap)/i.test(last)) reply = 'Wi‑Fi — المساحة التقريبية/عدد القاعات؟ السرعات المتوقعة؟ Indoor/Outdoor؟\nEN: Wi‑Fi — area coverage, expected speeds, indoor/outdoor?';
    
    // Search for products when intent is detected (Arabic/English) or query looks like PN/brand
    let hits = [];
    if (looksLikeProductQuery(lastRaw) || /(ابحث|search|هات منتجات|products)/i.test(last)) {
      try {
        const q = lastRaw.replace(/(ابحث|search|هات منتجات|products)/ig, '').trim() || lastRaw;
        hits = await searchAlgolia({ query: q || 'kaspersky', hitsPerPage: 6 });
      } catch {}
    }
    
    return res.status(200).json({ reply, hits });

  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// OpenAI Assistant integration functions
async function handleOpenAIAssistantChat(requestBody, res) {
  const { message, thread_id, user_context } = requestBody;
  
  try {
    const assistantResponse = await callOpenAIAssistant(message, {
      thread_id,
      user_context,
      search_context: await getSearchContext(message)
    });
    
    return res.status(200).json({
      reply: assistantResponse.response,
      hits: assistantResponse.products || [],
      thread_id: assistantResponse.thread_id,
      tokens_used: assistantResponse.tokens_used,
      success: assistantResponse.success
    });
    
  } catch (error) {
    console.error('OpenAI Assistant chat error:', error);
    return res.status(200).json({
      reply: getFallbackResponse(message),
      hits: [],
      success: false,
      fallback: true
    });
  }
}

async function callOpenAIAssistant(message, context = {}) {
  if (!OPENAI_API_KEY || !ASSISTANT_ID) {
    throw new Error('OpenAI configuration missing');
  }
  
  try {
    let threadId = context.thread_id;
    
    // Create thread if needed
    if (!threadId) {
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      const thread = await threadResponse.json();
      threadId = thread.id;
    }
    
    // Add context to message if available
    let enhancedMessage = message;
    if (context.user_context || context.search_context) {
      const contextInfo = [];
      if (context.user_context?.page) contextInfo.push(`الصفحة: ${context.user_context.page}`);
      if (context.search_context?.length > 0) {
        contextInfo.push(`منتجات متاحة: ${context.search_context.slice(0, 3).map(p => p.name).join(', ')}`);
      }
      if (contextInfo.length > 0) {
        enhancedMessage = `${message}\n\nسياق إضافي: ${contextInfo.join(' | ')}`;
      }
    }
    
    // Add message to thread
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: enhancedMessage
      })
    });
    
    // Run assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
        additional_instructions: `
          أنت مساعد مبيعات ذكي لشركة QuickITQuote. 
          قدم ردود مفيدة وشخصية باللغة العربية.
          إذا سأل عن منتجات، اقترح البحث في الكتالوج.
          إذا طلب أسعار، وجهه لصفحة العروض.
        `
      })
    });
    
    const run = await runResponse.json();
    
    // Wait for completion
    const completedRun = await waitForRunCompletion(threadId, run.id);
    
    // Get messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const messages = await messagesResponse.json();
    const assistantMessage = messages.data?.find(msg => msg.role === 'assistant');
    const response = assistantMessage?.content?.[0]?.text?.value || 'عذراً، لم أتمكن من معالجة طلبك.';
    
    return {
      success: true,
      response: response,
      thread_id: threadId,
      tokens_used: completedRun.usage?.total_tokens,
      products: context.search_context || []
    };
    
  } catch (error) {
    console.error('OpenAI Assistant call error:', error);
    throw error;
  }
}

async function waitForRunCompletion(threadId, runId, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const run = await response.json();
    
    if (run.status === 'completed') {
      return run;
    } else if (run.status === 'failed') {
      throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Assistant run timed out');
}

async function getSearchContext(message) {
  try {
    const shouldSearch = /(منتج|product|search|ابحث|server|خادم|laptop|حاسوب)/i.test(message);
    if (!shouldSearch) return [];
    
    const searchResults = await searchAlgolia({ 
      query: message, 
      hitsPerPage: 5 
    });
    
    return searchResults;
  } catch (error) {
    console.error('Search context error:', error);
    return [];
  }
}

function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('سعر') || lowerMessage.includes('price')) {
    return 'يمكنني مساعدتك في الحصول على أفضل الأسعار. يرجى تحديد المنتجات المطلوبة وسأعد لك عرض سعر مخصص.';
  }
  
  if (lowerMessage.includes('منتج') || lowerMessage.includes('product')) {
    return 'لدينا مجموعة واسعة من منتجات IT. يمكنك تصفح الكتالوج أو أخبرني عما تبحث عنه تحديداً.';
  }
  
  return 'أهلاً بك! كيف يمكنني مساعدتك في العثور على أفضل حلول IT لاحتياجاتك؟';
}

// Heuristics to detect product-like queries (brands, SKUs, presence of digits and dashes, etc.)
function looksLikeProductQuery(text = ''){
  const t = String(text || '').trim();
  if (!t) return false;
  // Common IT brands/keywords
  const brands = /(kaspersky|microsoft|hp|dell|lenovo|cisco|juniper|fortinet|palo|hpe|aruba|ubiquiti|tplink|mikrotik|vmware|esxi|synology|qnap|intel|amd|nvidia|epson|canon|brother|yealink|grandstream)/i;
  if (brands.test(t)) return true;
  // Looks like a part number (mix of letters+digits with dash or slash)
  if (/[A-Za-z]{2,}[-_\/][A-Za-z0-9]{2,}/.test(t)) return true;
  // Short tokens often used as PNs (e.g., EDR, E5, i7-1255U)
  if (/\b([A-Za-z]{2,3}\d{1,4}|i[3579]-\d{3,5}[A-Za-z]?)\b/.test(t)) return true;
  // Arabic request for specific model
  if (/(موديل|طراز|رقم جزء|بارت نمبر)/i.test(t)) return true;
  return false;
}
