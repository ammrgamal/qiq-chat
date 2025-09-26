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
    const apiKey = process.env.ALGOLIA_API_KEY;
    const indexName = process.env.ALGOLIA_INDEX || 'woocommerce_products';
    
    if (!appId || !apiKey) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Algolia not configured',
        message: 'ALGOLIA_APP_ID and ALGOLIA_API_KEY environment variables are required'
      });
    }
    
    return res.status(200).json({
      ok: true,
      appId: appId,
      apiKey: apiKey, // Note: In production, use search-only API key
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