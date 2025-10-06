// API endpoint for Algolia configuration
import dotenv from 'dotenv';
try{ dotenv.config(); }catch{}

export default async function handler(req, res){
  if (req.method !== 'GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  
  try{
    const appId = process.env.ALGOLIA_APP_ID;
  // Prefer a search-only/public key for client-side usage (never expose admin key)
  let searchKey = process.env.ALGOLIA_SEARCH_KEY || process.env.ALGOLIA_PUBLIC_API_KEY;
  const adminKey = process.env.ALGOLIA_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY; // DO NOT SEND TO CLIENTS (unless explicit override)
  const allowEmergency = /^(1|true|yes)$/i.test(String(process.env.ALLOW_ADMIN_KEY_AS_SEARCH || ''));
  if (!searchKey && allowEmergency && adminKey){
    // Emergency fallback (logs only server side). High risk: should be temporary.
    console.warn('[algolia-config] Using admin key as search key due to ALLOW_ADMIN_KEY_AS_SEARCH=1. Remove ASAP.');
    searchKey = adminKey;
  }
    const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    
    if (!appId || !searchKey) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Algolia not configured',
        message: 'Provide ALGOLIA_APP_ID and ALGOLIA_SEARCH_KEY (or ALGOLIA_PUBLIC_API_KEY). Set ALLOW_ADMIN_KEY_AS_SEARCH=1 only temporarily if you must fallback.'
      });
    }
    
    return res.status(200).json({
      ok: true,
      appId: appId,
      // Send ONLY the search-only key to the browser
      apiKey: searchKey,
      indexName: indexName
    });
    
  } catch (error) {
    console.error('Algolia config error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Server error' 
    });
  }
}