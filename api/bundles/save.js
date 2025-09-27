/**
 * Bundles Save API
 * POST /api/bundles/save - Save generated bundles to Algolia
 */

import algoliasearch from 'algoliasearch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only POST requests are accepted'
        });
    }

    try {
        const { bundles } = req.body;

        if (!Array.isArray(bundles) || bundles.length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'bundles array is required and cannot be empty'
            });
        }

        // إعداد Algolia
        const appId = process.env.ALGOLIA_APP_ID || process.env.ALGOLIA_APPLICATION_ID;
        const apiKey = process.env.ALGOLIA_ADMIN_API_KEY; // Admin key للكتابة
        const bundlesIndex = process.env.ALGOLIA_BUNDLES_INDEX || 'qiq_bundles';

        if (!appId || !apiKey) {
            console.warn('❌ Algolia credentials not configured for bundles');
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Algolia not configured for bundle storage'
            });
        }

        const client = algoliasearch(appId, apiKey);
        const index = client.initIndex(bundlesIndex);

        // إعداد البيانات للحفظ
        const bundleRecords = bundles.map(bundle => ({
            objectID: bundle.id || `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: bundle.name,
            description: bundle.description,
            category: bundle.category,
            userRange: bundle.userRange,
            items: bundle.items,
            source: bundle.source || 'manual',
            confidence: bundle.confidence || 1.0,
            createdAt: bundle.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            // إضافة معلومات للبحث
            searchTerms: [
                bundle.name,
                bundle.description,
                bundle.category,
                ...bundle.items.map(item => item.name)
            ].join(' ').toLowerCase()
        }));

        console.log(`📦 Saving ${bundleRecords.length} bundles to Algolia index: ${bundlesIndex}`);

        // حفظ في Algolia
        const algoliaResult = await index.saveObjects(bundleRecords);

        console.log('✅ Bundles saved to Algolia successfully:', {
            objectIDs: algoliaResult.objectIDs.length,
            taskID: algoliaResult.taskID
        });

        res.status(200).json({
            success: true,
            message: 'Bundles saved successfully',
            saved: bundleRecords.length,
            algolia: {
                objectIDs: algoliaResult.objectIDs,
                taskID: algoliaResult.taskID,
                index: bundlesIndex
            },
            bundles: bundleRecords.map(b => ({
                id: b.objectID,
                name: b.name,
                category: b.category,
                itemCount: b.items.length
            }))
        });

    } catch (error) {
        console.error('❌ Bundle save error:', error);

        res.status(500).json({
            error: 'Bundle save failed',
            message: error.message,
            details: error.response?.data || null
        });
    }
}