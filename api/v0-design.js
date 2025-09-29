export default async function handler(req, res) {
    // تعيين CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, type = 'component' } = req.body;

        // V0 API Configuration
        const v0ApiKey = process.env.V0_API_KEY;
        
        if (!v0ApiKey) {
            console.log('⚠️ V0 API Key not configured, using fallback design');
            return res.status(200).json({
                success: true,
                component: generateFallbackComponent(prompt, type),
                source: 'fallback',
                message: 'V0 غير مُهيأ — استخدم V0_API_KEY و V0_API_ENDPOINT أو V0_API_BASE_URL'
            });
        }

        // استدعاء V0 API الحقيقي
        const response = await fetch('https://v0.dev/api/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${v0ApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                type: type,
                framework: 'tailwind',
                theme: {
                    brand: 'QuickITQuote',
                    colors: {
                        primary: '#3b82f6',
                        secondary: '#FFD700',
                        accent: '#10b981'
                    },
                    rtl: true
                }
            })
        });

        if (!response.ok) {
            throw new Error(`V0 API Error: ${response.status}`);
        }

        const data = await response.json();
        
        return res.status(200).json({
            success: true,
            component: convertV0ToHTML(data),
            source: 'v0'
        });

    } catch (error) {
        console.error('V0 Design API Error:', error);
        
        // إرجاع تصميم احتياطي
        return res.status(200).json({
            success: true,
            component: generateFallbackComponent(req.body.prompt, req.body.type),
            source: 'fallback',
            error: error.message
        });
    }
}

function generateFallbackComponent(prompt, type) {
    const fallbackComponents = {
        'product-card': {
            html: `
                <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200">
                    <div class="p-6">
                        <div class="flex items-start gap-4 mb-4">
                            <img src="/api/placeholder/80/80" alt="Product" class="w-20 h-20 rounded-lg object-cover bg-gray-100" />
                            <div class="flex-1 min-w-0">
                                <h3 class="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">Product Name</h3>
                                <p class="text-gray-600 text-sm line-clamp-2">Product description here...</p>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-2xl font-bold text-blue-600">EGP 0</span>
                            <div class="flex gap-2">
                                <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">New</span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                                إضافة للعرض
                            </button>
                            <button class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors">
                                مقارنة
                            </button>
                        </div>
                    </div>
                </div>
            `,
            css: `
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `
        },
        'comparison-modal': {
            html: `
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div class="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                        <div class="p-6 border-b border-gray-200">
                            <div class="flex items-center justify-between">
                                <h2 class="text-2xl font-bold text-gray-900">مقارنة المنتجات</h2>
                                <button class="text-gray-400 hover:text-gray-600 p-2">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="p-6 overflow-auto max-h-[calc(90vh-120px)]">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="bg-gray-50">
                                        <th class="text-right p-4 font-semibold border border-gray-200">المواصفات</th>
                                        <th class="text-center p-4 font-semibold border border-gray-200">المنتج الأول</th>
                                        <th class="text-center p-4 font-semibold border border-gray-200">المنتج الثاني</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="p-4 font-medium border border-gray-200 bg-gray-50">الاسم</td>
                                        <td class="p-4 text-center border border-gray-200">-</td>
                                        <td class="p-4 text-center border border-gray-200">-</td>
                                    </tr>
                                    <tr>
                                        <td class="p-4 font-medium border border-gray-200 bg-gray-50">السعر</td>
                                        <td class="p-4 text-center border border-gray-200">-</td>
                                        <td class="p-4 text-center border border-gray-200">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `,
            css: `
                .comparison-modal table {
                    border-collapse: separate;
                    border-spacing: 0;
                }
            `
        },
        'enhanced-chat': {
            html: `
                <div class="fixed bottom-6 left-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50">
                    <div class="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-semibold">مساعد QuickITQuote</h3>
                                    <p class="text-sm text-blue-100">متصل</p>
                                </div>
                            </div>
                            <button class="text-white/80 hover:text-white">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="flex-1 p-4 overflow-y-auto space-y-4" id="chat-messages">
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <p class="text-sm text-gray-700">مرحباً! كيف يمكنني مساعدتك اليوم؟</p>
                        </div>
                    </div>
                    <div class="p-4 border-t border-gray-200">
                        <div class="flex gap-2">
                            <input type="text" placeholder="اكتب رسالتك..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `,
            css: `
                .chat-animation {
                    animation: slideUp 0.3s ease-out;
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `
        }
    };

    return fallbackComponents[type] || fallbackComponents['product-card'];
}

function convertV0ToHTML(v0Data) {
    // تحويل React component من V0 إلى HTML
    return {
        html: v0Data.html || v0Data.component,
        css: v0Data.css || '',
        js: v0Data.js || ''
    };
}