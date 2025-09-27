/**
 * HelloLeads Direct Test API
 * POST /api/hello-leads - Test HelloLeads integration directly
 */

import { createLead } from './_lib/helloleads.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only POST requests are accepted'
        });
    }

    try {
        const leadData = req.body;

        // Validate required fields
        if (!leadData.client || !leadData.client.name || !leadData.client.email) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'client.name and client.email are required'
            });
        }

        // Extract visitor IP and other server-side info
        const visitorInfo = {
            ip: req.headers['x-forwarded-for'] || 
                req.headers['x-real-ip'] || 
                req.connection?.remoteAddress || 
                req.socket?.remoteAddress || 
                'unknown',
            userAgent: req.headers['user-agent'] || '',
            referer: req.headers.referer || '',
            origin: req.headers.origin || '',
            timestamp: new Date().toISOString()
        };

        // Merge server-side visitor info with client-side data
        if (leadData.visitor) {
            leadData.visitor = {
                ...leadData.visitor,
                ...visitorInfo
            };
        } else {
            leadData.visitor = visitorInfo;
        }

        console.log('📞 Testing HelloLeads API with data:', {
            client: leadData.client.name,
            email: leadData.client.email,
            number: leadData.number || 'test',
            hasVisitor: !!leadData.visitor,
            source: leadData.source || 'api-test'
        });

        // Attempt to create lead in HelloLeads
        const helloLeadsResult = await createLead(leadData);

        console.log('✅ HelloLeads test result:', helloLeadsResult);

        res.status(200).json({
            ok: true,
            message: 'HelloLeads test completed',
            helloleads: helloLeadsResult,
            requestData: {
                clientName: leadData.client.name,
                clientEmail: leadData.client.email,
                quotationNumber: leadData.number,
                source: leadData.source,
                visitorTracked: !!leadData.visitor
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ HelloLeads test error:', error);

        res.status(500).json({
            ok: false,
            error: 'HelloLeads test failed',
            message: error.message,
            details: error.response?.data || null,
            timestamp: new Date().toISOString()
        });
    }
}
