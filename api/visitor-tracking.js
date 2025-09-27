// api/visitor-tracking.js - Endpoint for collecting visitor tracking data
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const trackingData = req.body || {};
    
    // Extract visitor IP and additional server-side info
    const visitorInfo = extractServerSideVisitorInfo(req);
    
    // Enhance tracking data with server-side information
    const enhancedData = {
      ...trackingData,
      serverInfo: visitorInfo,
      receivedAt: new Date().toISOString()
    };
    
    // Log tracking data for debugging (remove in production)
    console.log('📊 Visitor Tracking Data Received:', {
      sessionId: trackingData.sessionId,
      duration: trackingData.duration,
      pageviews: trackingData.pageviews,
      eventsCount: trackingData.events?.length || 0,
      utm: trackingData.utm,
      ip: visitorInfo.ipAddress
    });
    
    // Here you could store the tracking data in a database
    // For now, we'll just acknowledge receipt
    
    // You could also send this data to analytics services like:
    // - Google Analytics
    // - Facebook Pixel
    // - Custom analytics database
    
    return res.status(200).json({ 
      ok: true, 
      message: 'Tracking data received',
      sessionId: trackingData.sessionId 
    });
    
  } catch (error) {
    console.error('Visitor tracking error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to process tracking data' 
    });
  }
}

function extractServerSideVisitorInfo(req) {
  const headers = req.headers || {};
  const forwardedFor = headers['x-forwarded-for'] || '';
  const realIp = headers['x-real-ip'] || '';
  const cfConnectingIp = headers['cf-connecting-ip'] || '';
  
  // Extract IP address (prioritize CloudFlare/proxy headers)
  let ipAddress = cfConnectingIp || realIp || forwardedFor.split(',')[0]?.trim() || 
                  req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  
  return {
    ipAddress: ipAddress,
    userAgent: headers['user-agent'] || '',
    referer: headers['referer'] || headers['referrer'] || '',
    acceptLanguage: headers['accept-language'] || '',
    acceptEncoding: headers['accept-encoding'] || '',
    host: headers['host'] || '',
    origin: headers['origin'] || '',
    timestamp: new Date().toISOString()
  };
}