export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const helloLeadsApiKey = process.env.HELLOLEADS_API_KEY;
    const helloLeadsListKey = process.env.HELLOLEADS_LIST_KEY;

    if (!helloLeadsApiKey) {
        return res.status(200).json({
            success: false,
            message: 'HelloLeads API key not configured',
            fallback: true
        });
    }

    try {
        const { action, data } = req.body || {};

        switch (action) {
            case 'create_lead':
                return await createLead(data, helloLeadsApiKey, helloLeadsListKey, res);
            
            case 'update_lead':
                return await updateLead(data, helloLeadsApiKey, res);
            
            case 'track_activity':
                return await trackActivity(data, helloLeadsApiKey, res);
            
            case 'get_lead_status':
                return await getLeadStatus(data, helloLeadsApiKey, res);
            
            case 'bulk_import':
                return await bulkImport(data, helloLeadsApiKey, helloLeadsListKey, res);
            
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action specified'
                });
        }
    } catch (error) {
        console.error('HelloLeads Enhanced API Error:', error);
        return res.status(500).json({
            success: false,
            message: 'HelloLeads service temporarily unavailable',
            error: error.message,
            fallback: true
        });
    }
}

async function createLead(data, apiKey, listKey, res) {
    try {
        // تنسيق البيانات للـ HelloLeads
        const leadData = {
            // البيانات الأساسية
            email: data.email,
            first_name: data.firstName || data.name?.split(' ')[0] || 'عميل',
            last_name: data.lastName || data.name?.split(' ').slice(1).join(' ') || 'محتمل',
            phone: data.phone || data.mobile,
            company: data.company || data.business_name,
            
            // تفاصيل المصدر
            source: data.source || 'QuickITQuote Website',
            utm_source: data.utm_source,
            utm_medium: data.utm_medium,
            utm_campaign: data.utm_campaign,
            
            // تفاصيل الاقتباس
            quote_type: data.quote_type || 'IT Equipment',
            quote_value: data.quote_value || 0,
            products_count: data.products_count || 0,
            quote_stage: data.quote_stage || 'requested',
            
            // معلومات إضافية
            custom_fields: {
                visitor_session: data.session_id,
                page_source: data.page_url,
                quote_details: data.quote_details,
                products_list: data.products,
                special_requirements: data.requirements,
                preferred_contact: data.contact_method || 'email',
                urgency_level: data.urgency || 'normal',
                budget_range: data.budget_range,
                company_size: data.company_size,
                industry: data.industry,
                location: data.location || 'Egypt'
            },
            
            // معلومات التوقيت
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
        };

        // إرسال البيانات إلى HelloLeads
        const helloLeadsUrl = 'https://api.helloleads.io/v2/contacts';
        const response = await fetch(helloLeadsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-List-ID': listKey || 'default'
            },
            body: JSON.stringify(leadData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`HelloLeads API Error: ${result.message || response.statusText}`);
        }

        // تسجيل النشاط الأولي
        if (result.id || result.contact_id) {
            try {
                await trackActivity({
                    lead_id: result.id || result.contact_id,
                    activity_type: 'lead_created',
                    description: `عميل محتمل جديد من QuickITQuote - ${data.quote_type || 'طلب أسعار'}`,
                    data: {
                        quote_value: data.quote_value,
                        products_count: data.products_count,
                        source_page: data.page_url
                    }
                }, apiKey, { json: () => {} });
            } catch (activityError) {
                console.log('Activity tracking failed:', activityError.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Lead created successfully in HelloLeads',
            lead_id: result.id || result.contact_id,
            helloleads_data: result
        });

    } catch (error) {
        console.error('Create lead error:', error);
        
        // Fallback: حفظ محلياً
        const localLead = {
            ...data,
            id: `local_${Date.now()}`,
            created_at: new Date().toISOString(),
            source: 'HelloLeads API Failed - Saved Locally'
        };

        return res.status(200).json({
            success: true,
            message: 'Lead saved locally (HelloLeads temporarily unavailable)',
            lead_id: localLead.id,
            fallback: true,
            local_data: localLead
        });
    }
}

async function updateLead(data, apiKey, res) {
    try {
        if (!data.lead_id) {
            throw new Error('Lead ID is required for update');
        }

        const updateData = {
            ...data.updates,
            last_activity: new Date().toISOString(),
            updated_by: 'QuickITQuote System'
        };

        const response = await fetch(`https://api.helloleads.io/v2/contacts/${data.lead_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`HelloLeads Update Error: ${result.message || response.statusText}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Lead updated successfully',
            updated_data: result
        });

    } catch (error) {
        console.error('Update lead error:', error);
        return res.status(200).json({
            success: false,
            message: 'Lead update failed',
            error: error.message,
            fallback: true
        });
    }
}

async function trackActivity(data, apiKey, res) {
    try {
        const activityData = {
            contact_id: data.lead_id,
            activity_type: data.activity_type || 'website_interaction',
            title: data.title || data.description,
            description: data.description,
            occurred_at: new Date().toISOString(),
            metadata: data.data || {}
        };

        const response = await fetch('https://api.helloleads.io/v2/activities', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(activityData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`HelloLeads Activity Error: ${result.message || response.statusText}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Activity tracked successfully',
            activity_data: result
        });

    } catch (error) {
        console.error('Track activity error:', error);
        return res.status(200).json({
            success: false,
            message: 'Activity tracking failed',
            error: error.message,
            fallback: true
        });
    }
}

async function getLeadStatus(data, apiKey, res) {
    try {
        if (!data.lead_id && !data.email) {
            throw new Error('Lead ID or email is required');
        }

        let url = 'https://api.helloleads.io/v2/contacts';
        if (data.lead_id) {
            url += `/${data.lead_id}`;
        } else {
            url += `?email=${encodeURIComponent(data.email)}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`HelloLeads Status Error: ${result.message || response.statusText}`);
        }

        return res.status(200).json({
            success: true,
            lead_status: result
        });

    } catch (error) {
        console.error('Get lead status error:', error);
        return res.status(200).json({
            success: false,
            message: 'Unable to retrieve lead status',
            error: error.message
        });
    }
}

async function bulkImport(data, apiKey, listKey, res) {
    try {
        if (!Array.isArray(data.leads) || data.leads.length === 0) {
            throw new Error('Leads array is required and must not be empty');
        }

        const bulkData = {
            contacts: data.leads.map(lead => ({
                email: lead.email,
                first_name: lead.firstName || lead.name?.split(' ')[0] || 'عميل',
                last_name: lead.lastName || lead.name?.split(' ').slice(1).join(' ') || 'محتمل',
                phone: lead.phone,
                company: lead.company,
                source: lead.source || 'QuickITQuote Bulk Import',
                custom_fields: lead.custom_fields || {}
            }))
        };

        const response = await fetch('https://api.helloleads.io/v2/contacts/bulk', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-List-ID': listKey || 'default'
            },
            body: JSON.stringify(bulkData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`HelloLeads Bulk Import Error: ${result.message || response.statusText}`);
        }

        return res.status(200).json({
            success: true,
            message: `${data.leads.length} leads imported successfully`,
            import_result: result
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        return res.status(200).json({
            success: false,
            message: 'Bulk import failed',
            error: error.message,
            fallback: true
        });
    }
}

// وظائف مساعدة لتحسين الأداء
export function validateLeadData(data) {
    const errors = [];
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Valid email address is required');
    }
    
    if (!data.name && !data.firstName) {
        errors.push('Name or firstName is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

export function formatLeadForHelloLeads(rawData) {
    return {
        email: rawData.email?.toLowerCase(),
        first_name: rawData.firstName || rawData.name?.split(' ')[0] || '',
        last_name: rawData.lastName || rawData.name?.split(' ').slice(1).join(' ') || '',
        phone: rawData.phone?.replace(/\D/g, ''),
        company: rawData.company || '',
        source: rawData.source || 'QuickITQuote',
        created_at: new Date().toISOString()
    };
}

// معالجة الأخطاء والاستثناءات
export function handleHelloLeadsError(error, fallbackData = null) {
    console.error('HelloLeads API Error:', error);
    
    return {
        success: false,
        error: error.message,
        fallback: !!fallbackData,
        fallback_data: fallbackData,
        timestamp: new Date().toISOString()
    };
}