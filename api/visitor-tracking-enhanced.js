export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { action, data } = req.body || {};
        
        switch (action) {
            case 'track_session':
                return await handleSessionTracking(req, res);
            
            case 'track_page_view':
                return await handlePageView(data, res);
            
            case 'track_interaction':
                return await handleInteraction(data, res);
            
            case 'track_conversion':
                return await handleConversion(data, res);
            
            default:
                return await handleGeneralTracking(req, res);
        }
    } catch (error) {
        console.error('Visitor Tracking Error:', error);
        return res.status(200).json({
            success: true,
            message: 'Tracking data logged locally',
            error: error.message
        });
    }
}

async function handleSessionTracking(req, res) {
    const visitorData = {
        // معرف الجلسة الفريد
        session_id: `qiq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        visitor_id: generateVisitorId(req),
        
        // بيانات الطلب
        timestamp: new Date().toISOString(),
        ip_address: getClientIP(req),
        user_agent: req.headers['user-agent'],
        referer: req.headers.referer || 'direct',
        
        // معاملات UTM
        utm_data: extractUTMFromReferer(req.headers.referer),
        
        // معلومات الجهاز
        device_info: parseUserAgent(req.headers['user-agent']),
        
        // معلومات الموقع (تقديرية من IP)
        location: await getLocationFromIP(getClientIP(req)),
        
        // معلومات إضافية
        first_visit: !req.headers.cookie?.includes('qiq_visitor_id'),
        page_title: req.body?.page_title || 'QuickITQuote',
        page_url: req.body?.page_url || req.headers.referer
    };

    // حفظ في HelloLeads إذا كان متاحاً
    const helloLeadsKey = process.env.HELLOLEADS_API_KEY;
    if (helloLeadsKey) {
        try {
            await sendToHelloLeads('visitor_session', visitorData, helloLeadsKey);
        } catch (error) {
            console.log('HelloLeads tracking failed:', error.message);
        }
    }

    return res.status(200).json({
        success: true,
        visitor_data: visitorData,
        tracking_id: visitorData.session_id
    });
}

async function handlePageView(data, res) {
    const pageViewData = {
        session_id: data.session_id,
        page_url: data.page_url,
        page_title: data.page_title,
        timestamp: new Date().toISOString(),
        time_on_page: data.time_on_page || 0,
        scroll_depth: data.scroll_depth || 0,
        referrer: data.referrer
    };

    // تحديث HelloLeads
    const helloLeadsKey = process.env.HELLOLEADS_API_KEY;
    if (helloLeadsKey) {
        try {
            await sendToHelloLeads('page_view', pageViewData, helloLeadsKey);
        } catch (error) {
            console.log('HelloLeads page view failed:', error.message);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Page view tracked'
    });
}

async function handleInteraction(data, res) {
    const interactionData = {
        session_id: data.session_id,
        interaction_type: data.type, // 'click', 'hover', 'scroll', 'form_fill'
        element: data.element,
        value: data.value,
        timestamp: new Date().toISOString(),
        page_url: data.page_url
    };

    // إرسال للـ HelloLeads
    const helloLeadsKey = process.env.HELLOLEADS_API_KEY;
    if (helloLeadsKey) {
        try {
            await sendToHelloLeads('interaction', interactionData, helloLeadsKey);
        } catch (error) {
            console.log('HelloLeads interaction failed:', error.message);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Interaction tracked'
    });
}

async function handleConversion(data, res) {
    const conversionData = {
        session_id: data.session_id,
        conversion_type: data.type, // 'quote_request', 'product_add', 'contact_form'
        value: data.value,
        conversion_data: data.details,
        timestamp: new Date().toISOString()
    };

    // إرسال كـ lead إلى HelloLeads
    const helloLeadsKey = process.env.HELLOLEADS_API_KEY;
    const listKey = process.env.HELLOLEADS_LIST_KEY;
    
    if (helloLeadsKey && listKey) {
        try {
            await sendConversionToHelloLeads(conversionData, helloLeadsKey, listKey);
        } catch (error) {
            console.log('HelloLeads conversion failed:', error.message);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Conversion tracked'
    });
}

// وظائف مساعدة
function generateVisitorId(req) {
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || '';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    
    return `qiq_visitor_${timestamp}_${random}`;
}

function getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           '127.0.0.1';
}

function extractUTMFromReferer(referer) {
    if (!referer) return {};
    
    try {
        const url = new URL(referer);
        return {
            utm_source: url.searchParams.get('utm_source'),
            utm_medium: url.searchParams.get('utm_medium'),
            utm_campaign: url.searchParams.get('utm_campaign'),
            utm_term: url.searchParams.get('utm_term'),
            utm_content: url.searchParams.get('utm_content')
        };
    } catch (error) {
        return {};
    }
}

function parseUserAgent(userAgent) {
    if (!userAgent) return {};
    
    return {
        is_mobile: /Mobi|Android/i.test(userAgent),
        is_tablet: /Tablet|iPad/i.test(userAgent),
        is_desktop: !/Mobi|Android|Tablet|iPad/i.test(userAgent),
        browser: getBrowserFromUA(userAgent),
        os: getOSFromUA(userAgent)
    };
}

function getBrowserFromUA(ua) {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
}

function getOSFromUA(ua) {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'MacOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
}

async function getLocationFromIP(ip) {
    try {
        if (ip === '127.0.0.1' || ip === '::1') {
            return { country: 'EG', city: 'Cairo', region: 'Cairo' };
        }
        
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,timezone`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.countryCode,
                country_name: data.country,
                region: data.regionName,
                city: data.city,
                timezone: data.timezone
            };
        }
    } catch (error) {
        console.error('Geolocation error:', error);
    }
    
    return { country: 'EG', city: 'Cairo', region: 'Cairo' };
}

async function sendToHelloLeads(eventType, data, apiKey) {
    const response = await fetch('https://api.helloleads.io/v1/events', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            event_type: eventType,
            event_data: data,
            timestamp: new Date().toISOString()
        })
    });

    if (!response.ok) {
        throw new Error(`HelloLeads API Error: ${response.status}`);
    }

    return await response.json();
}

async function sendConversionToHelloLeads(conversionData, apiKey, listKey) {
    const leadData = {
        email: conversionData.conversion_data?.email || `visitor_${Date.now()}@temp.com`,
        name: conversionData.conversion_data?.name || 'زائر مجهول',
        conversion_type: conversionData.conversion_type,
        conversion_value: conversionData.value,
        session_id: conversionData.session_id,
        timestamp: conversionData.timestamp
    };

    const response = await fetch('https://api.helloleads.io/v1/leads', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-List-Key': listKey
        },
        body: JSON.stringify(leadData)
    });

    if (!response.ok) {
        throw new Error(`HelloLeads Lead API Error: ${response.status}`);
    }

    return await response.json();
}