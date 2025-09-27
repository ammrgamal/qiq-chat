/**
 * Health Check API - Monitor service status
 * GET /health
 */
export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Check environment variables
        const env = {
            hasHelloLeads: !!(process.env.HELLOLEADS_API_KEY && process.env.HELLOLEADS_LIST_KEY),
            hasOpenAI: !!process.env.OPENAI_API_KEY,
            hasResend: !!process.env.RESEND_API_KEY,
            hasGemini: !!process.env.GEMINI_API_KEY,
            hasAlgolia: !!(process.env.ALGOLIA_APPLICATION_ID && process.env.ALGOLIA_API_KEY)
        };

        // Basic system info
        const systemInfo = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version,
            platform: process.platform
        };

        // Service status
        const services = {
            helloleads: {
                enabled: env.hasHelloLeads,
                apiUrl: 'https://app.hello-leads.com/api/leads/',
                status: env.hasHelloLeads ? 'configured' : 'missing_keys'
            },
            openai: {
                enabled: env.hasOpenAI,
                status: env.hasOpenAI ? 'configured' : 'missing_key'
            },
            resend: {
                enabled: env.hasResend,
                status: env.hasResend ? 'configured' : 'missing_key'
            },
            gemini: {
                enabled: env.hasGemini,
                status: env.hasGemini ? 'configured' : 'missing_key'
            },
            algolia: {
                enabled: env.hasAlgolia,
                status: env.hasAlgolia ? 'configured' : 'missing_keys'
            }
        };

        res.status(200).json({
            ok: true,
            env,
            system: systemInfo,
            services,
            message: 'QuickITQuote API is healthy'
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            ok: false,
            error: 'Health check failed',
            message: error.message
        });
    }
}