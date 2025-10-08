// arabicSynonyms.js - Arabic/English synonym generation & normalization
// Phase 1 lightweight implementation (no external libs) with optional AI translation
import aiService from '../aiService.js';
import logger from '../logger.js';
import { productHash } from '../utils/hash.js';

const CACHE = new Map(); // key => { synonyms, ts }
const MAX_CACHE = 500;

const ARABIC_RANGE = /[\u0600-\u06FF]/;
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g; // vowels & marks

const ARABIC_INDIC_DIGITS = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
};

const TRANSLIT_MAP = {
  'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
  'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w','ي':'y',
  'ة':'h','ء':'', 'ؤ':'o','ئ':'e'
};

function detectArabic(text='') { return ARABIC_RANGE.test(text); }
function stripTashkeel(t=''){ return t.replace(TASHKEEL,''); }
function arabicIndicToLatin(t=''){ return t.replace(/[٠-٩]/g, d=>ARABIC_INDIC_DIGITS[d]||d); }
function unifyLetters(t=''){
  return t
    .replace(/[أإآ]/g,'ا')
    .replace(/ة/g,'ه')
    .replace(/ى/g,'ي');
}
function normalizeArabic(t='') { return arabicIndicToLatin(unifyLetters(stripTashkeel(t))); }
function transliterateArabic(t=''){
  return [...t].map(ch=>TRANSLIT_MAP[ch]!==undefined?TRANSLIT_MAP[ch]:ch).join('')
    .replace(/[^a-z0-9 ]/gi,' ') // remove leftovers
    .replace(/\s+/g,' ') // collapse
    .trim();
}

function dedupe(list){
  const seen = new Set();
  const out = [];
  for (const item of list){
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(item);
  }
  return out;
}

async function maybeTranslate(arTokens){
  if (!arTokens.length) return [];
  // Attempt AI translation if keys exist
  try {
    const joined = arTokens.slice(0,8).join(', ');
    const res = await aiService.translateTerms?.(arTokens);
    if (res && Array.isArray(res.translations)) return res.translations.filter(Boolean);
    // Fallback naive: return capitalized transliteration for each
    return arTokens.map(t=>{
      const translit = transliterateArabic(normalizeArabic(t));
      return translit ? translit.charAt(0).toUpperCase()+translit.slice(1) : translit;
    });
  } catch (e){ logger.warn('[arabicSynonyms] translation failed, fallback', e.message); return arTokens.map(t=>transliterateArabic(normalizeArabic(t))); }
}

export async function generateArabicSynonyms(product){
  const baseFields = [product.name, product.description, product.manufacturer, product.category];
  const arabicTokens = [];
  baseFields.filter(Boolean).forEach(f=>{
    const words = String(f).split(/\s+/).slice(0,40);
    for (const w of words){ if (detectArabic(w)) arabicTokens.push(w); }
  });
  if (!arabicTokens.length) return { synonyms:[], meta:{ arabic:false } };

  const hash = productHash({ name: product.name, manufacturer: product.manufacturer, ar: arabicTokens.slice(0,10) });
  const cacheKey = 'syn:'+hash+':'+(process.env.ENRICH_VERSION||'v1');
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey);
  // Normalize & transliterate
  const normalized = arabicTokens.map(normalizeArabic);
  const translits = normalized.map(transliterateArabic).filter(Boolean);
  const translations = await maybeTranslate(normalized);

  // English base seeds from manufacturer + name tokens
  const englishSeeds = [];
  const nameTokens = (product.name||'').split(/\s+/).filter(t=>/^[a-zA-Z0-9]/.test(t));
  englishSeeds.push(...nameTokens.slice(0,6));
  if (product.manufacturer) englishSeeds.push(product.manufacturer);

  const combined = dedupe([
    ...arabicTokens,
    ...normalized,
    ...translits,
    ...translations,
    ...englishSeeds
  ]).slice(0,20);

  const result = { synonyms: combined, meta:{ arabic:true, counts:{ original:arabicTokens.length, translits:translits.length, translations:translations.length }, hash } };
  CACHE.set(cacheKey, result);
  if (CACHE.size > MAX_CACHE){
    // naive eviction: delete first inserted
    const firstKey = CACHE.keys().next().value; CACHE.delete(firstKey);
  }
  return result;
}

export function mergeSynonyms(existing=[], extra=[]){
  return dedupe([...(existing||[]), ...(extra||[])]).slice(0,20);
}

export default {
  detectArabic,
  normalizeArabic,
  transliterateArabic,
  generateArabicSynonyms,
  mergeSynonyms
};
