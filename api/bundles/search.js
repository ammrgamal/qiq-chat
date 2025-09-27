/**
 * Bundles Search API
 * GET /api/bundles/search - Search generated bundles
 */

import algoliasearch from 'algoliasearch';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only GET requests are accepted'
        });
    }

    try {
        const { query = '', category = '', userCount = 0, limit = 10 } = req.query;

        // إعداد Algolia
        const appId = process.env.ALGOLIA_APP_ID || process.env.ALGOLIA_APPLICATION_ID;
        const apiKey = process.env.ALGOLIA_API_KEY; // Search key
        const bundlesIndex = process.env.ALGOLIA_BUNDLES_INDEX || 'qiq_bundles';

        if (!appId || !apiKey) {
            console.warn('❌ Algolia credentials not configured');
            return res.status(200).json({
                bundles: [],
                message: 'Bundle search not available - Algolia not configured'
            });
        }

        const client = algoliasearch(appId, apiKey);
        const index = client.initIndex(bundlesIndex);

        // إعداد فلاتر البحث
        const filters = [];
        
        if (category && category !== 'all') {
            filters.push(`category:"${category}"`);
        }
        
        if (userCount > 0) {
            // البحث عن التجميعات التي تدعم عدد المستخدمين المحدد
            filters.push(`userRange.0 <= ${userCount} AND userRange.1 >= ${userCount}`);
        }

        // تنفيذ البحث
        const searchOptions = {
            hitsPerPage: Math.min(parseInt(limit) || 10, 50),
            filters: filters.join(' AND '),
            attributesToRetrieve: [
                'objectID',
                'name',
                'description',
                'category',
                'userRange',
                'items',
                'source',
                'confidence',
                'createdAt',
                'status'
            ]
        };

        console.log(`🔍 Searching bundles with query: "${query}", filters: ${filters.join(' AND ')}`);

        const searchResult = await index.search(query, searchOptions);
        
        // معالجة النتائج
        const bundles = searchResult.hits
            .filter(bundle => bundle.status === 'active')
            .map(bundle => ({
                id: bundle.objectID,
                name: bundle.name,
                description: bundle.description,
                category: bundle.category,
                userRange: bundle.userRange,
                itemCount: bundle.items?.length || 0,
                items: bundle.items?.slice(0, 5), // أول 5 عناصر فقط
                source: bundle.source,
                confidence: bundle.confidence,
                createdAt: bundle.createdAt,
                relevanceScore: bundle._score || 0
            }))
            .sort((a, b) => {
                // ترتيب حسب الثقة ثم النقاط
                if (a.confidence !== b.confidence) {
                    return b.confidence - a.confidence;
                }
                return b.relevanceScore - a.relevanceScore;
            });

        console.log(`✅ Found ${bundles.length} bundles matching criteria`);

        res.status(200).json({
            success: true,
            query: query || '*',
            filters: {
                category: category || 'all',
                userCount: parseInt(userCount) || 0
            },
            total: searchResult.nbHits,
            bundles,
            categories: await getBundleCategories(index),
            message: bundles.length > 0 ? 
                `Found ${bundles.length} matching bundles` : 
                'No bundles match your criteria'
        });

    } catch (error) {
        console.error('❌ Bundle search error:', error);

        res.status(500).json({
            error: 'Bundle search failed',
            message: error.message,
            bundles: [],
            fallback: getFallbackBundles()
        });
    }
}

// الحصول على فئات التجميعات المتاحة
async function getBundleCategories(index) {
    try {
        const facetResult = await index.search('', {
            facets: ['category'],
            hitsPerPage: 0
        });
        
        return Object.keys(facetResult.facets?.category || {});
    } catch (error) {
        console.warn('Failed to get bundle categories:', error);
        return ['networking', 'security', 'productivity', 'infrastructure'];
    }
}

// تجميعات احتياطية في حالة فشل Algolia
function getFallbackBundles() {
    return [
        {
            id: 'fallback_small_office',
            name: 'حزمة المكتب الصغير',
            description: 'حل شبكة متكامل للمكاتب الصغيرة (5-50 موظف)',
            category: 'networking',
            userRange: [5, 50],
            itemCount: 4,
            items: [
                { name: 'سويتش إدارة 24 منفذ', essential: true },
                { name: 'جدار حماية للأعمال', essential: true },
                { name: 'نقطة وصول WiFi', essential: true },
                { name: 'كابلات شبكة Cat6', essential: false }
            ],
            source: 'fallback',
            confidence: 0.7
        },
        {
            id: 'fallback_security',
            name: 'حزمة الأمان الشاملة',
            description: 'حماية متكاملة للشركات من جميع التهديدات',
            category: 'security',
            userRange: [10, 200],
            itemCount: 3,
            items: [
                { name: 'حماية نقاط النهاية', essential: true },
                { name: 'أمان البريد الإلكتروني', essential: true },
                { name: 'حلول النسخ الاحتياطي', essential: false }
            ],
            source: 'fallback',
            confidence: 0.7
        }
    ];
}