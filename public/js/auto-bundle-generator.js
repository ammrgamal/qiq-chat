/**
 * Auto Bundle Generator System
 * نظام توليد التجميعات التلقائي من المصادر العالمية
 */

class AutoBundleGenerator {
    constructor() {
        this.sources = this.getDataSources();
        this.bundlePatterns = this.getBundlePatterns();
        this.aiPrompts = this.getAIPrompts();
        this.isProcessing = false;
        this.generatedBundles = [];
    }

    // مصادر البيانات العالمية
    getDataSources() {
        return {
            reddit: {
                subreddits: [
                    'sysadmin',
                    'ITManagers', 
                    'networking',
                    'cybersecurity',
                    'msp',
                    'smallbusiness',
                    'ITCareerQuestions'
                ],
                searchTerms: [
                    'best IT setup for small business',
                    'recommended network hardware stack',
                    'small office security bundle',
                    'SMB IT infrastructure',
                    'business network equipment recommendations'
                ]
            },
            stackoverflow: {
                tags: [
                    'networking',
                    'security',
                    'infrastructure', 
                    'enterprise-software',
                    'system-administration'
                ],
                keywords: [
                    'network setup recommendation',
                    'security stack implementation',
                    'infrastructure best practices'
                ]
            },
            techCommunities: [
                'spiceworks',
                'techrepublic',
                'serverfault',
                'superuser'
            ],
            documentation: [
                'cisco.com/c/en/us/solutions',
                'docs.microsoft.com',
                'support.kaspersky.com',
                'fortinet.com/resources'
            ]
        };
    }

    // أنماط التجميعات الشائعة
    getBundlePatterns() {
        return {
            'small_office_network': {
                keywords: ['small office', '10-50 users', 'basic network'],
                commonItems: [
                    { type: 'switch', query: 'managed switch 24 port', essential: true },
                    { type: 'firewall', query: 'small business firewall', essential: true },
                    { type: 'access_point', query: 'wifi access point indoor', essential: true },
                    { type: 'cables', query: 'cat6 ethernet cables', essential: true },
                    { type: 'rack', query: 'network cabinet small', essential: false }
                ]
            },
            'security_stack': {
                keywords: ['endpoint security', 'antivirus', 'EDR', 'protection'],
                commonItems: [
                    { type: 'endpoint', query: 'endpoint protection platform', essential: true },
                    { type: 'email_security', query: 'email security gateway', essential: true },
                    { type: 'backup', query: 'backup solution business', essential: true },
                    { type: 'firewall', query: 'next generation firewall', essential: false }
                ]
            },
            'microsoft_productivity': {
                keywords: ['office 365', 'microsoft 365', 'productivity suite'],
                commonItems: [
                    { type: 'office', query: 'microsoft 365 business', essential: true },
                    { type: 'email', query: 'exchange online', essential: true },
                    { type: 'collaboration', query: 'microsoft teams', essential: true },
                    { type: 'security', query: 'microsoft defender business', essential: false }
                ]
            },
            'virtualization_stack': {
                keywords: ['vmware', 'virtualization', 'virtual machine'],
                commonItems: [
                    { type: 'hypervisor', query: 'vmware vsphere', essential: true },
                    { type: 'management', query: 'vcenter server', essential: true },
                    { type: 'backup', query: 'vm backup solution', essential: true },
                    { type: 'storage', query: 'san storage vmware', essential: false }
                ]
            }
        };
    }

    // طلبات الذكاء الاصطناعي
    getAIPrompts() {
        return {
            analysis: `
                Analyze the following IT discussion and extract common product combinations:
                - Look for frequently mentioned product pairs/groups
                - Identify recommended configurations
                - Note specific use cases and user counts
                - Extract brand preferences and alternatives
                Return structured data about common IT bundles.
            `,
            bundleCreation: `
                Based on this analysis, create IT product bundles that include:
                - Main product category and use case
                - Recommended products with part numbers if available
                - Typical quantities for different business sizes
                - Alternative products/brands
                - Pricing tiers (budget/standard/premium)
                Format as JSON with clear structure.
            `
        };
    }

    // تحليل المصادر العالمية
    async analyzeSources() {
        if (this.isProcessing) {
            console.log('🔄 Bundle generation already in progress...');
            return;
        }

        this.isProcessing = true;
        console.log('🚀 Starting AI-powered bundle generation from global sources...');

        try {
            // محاولة استخدام OpenAI لتحليل البيانات
            const analysisResults = await this.performAIAnalysis();
            
            if (analysisResults && analysisResults.length > 0) {
                // معالجة النتائج وإنشاء التجميعات
                const bundles = await this.processBundlesFromAnalysis(analysisResults);
                
                // حفظ التجميعات في Algolia
                if (bundles.length > 0) {
                    await this.saveBundlesToAlgolia(bundles);
                    this.generatedBundles = bundles;
                    
                    console.log(`✅ Generated ${bundles.length} new bundles from AI analysis`);
                    return bundles;
                }
            }

            // Fallback: إنشاء تجميعات بناءً على الأنماط المحددة مسبقاً
            const fallbackBundles = await this.generateFallbackBundles();
            this.generatedBundles = fallbackBundles;
            
            console.log(`📦 Generated ${fallbackBundles.length} bundles using pattern matching`);
            return fallbackBundles;
            
        } catch (error) {
            console.error('❌ Bundle generation error:', error);
            return await this.generateFallbackBundles();
        } finally {
            this.isProcessing = false;
        }
    }

    // تحليل بالذكاء الاصطناعي
    async performAIAnalysis() {
        const openaiKey = process.env.OPENAI_API_KEY || localStorage.getItem('openai_key');
        if (!openaiKey) {
            console.log('ℹ️ OpenAI key not available, using pattern-based generation');
            return null;
        }

        try {
            // جمع عينات من البيانات الوهمية (في التطبيق الحقيقي ستأتي من APIs)
            const sampleData = this.getSampleDiscussions();
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature: 0.3,
                    messages: [
                        {
                            role: 'system',
                            content: this.aiPrompts.analysis
                        },
                        {
                            role: 'user',
                            content: `Analyze these IT discussions and extract common product bundles:\n\n${sampleData.join('\n---\n')}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const analysis = data.choices[0]?.message?.content;
            
            if (analysis) {
                return this.parseAIAnalysis(analysis);
            }

        } catch (error) {
            console.warn('AI analysis failed:', error);
            return null;
        }
    }

    // بيانات عينة للتحليل (في التطبيق الحقيقي ستأتي من APIs)
    getSampleDiscussions() {
        return [
            "For a 50-user office, we typically recommend: 1x 48-port managed switch (Cisco SG350-48), 1x firewall (FortiGate 60F), 2x WiFi access points (Ubiquiti UAP-AC-Pro), and structured cabling. This setup handles most SMB needs.",
            
            "Best security stack for small business: Kaspersky Endpoint Security (50 licenses), Microsoft 365 with Defender, backup solution like Acronis, and a good firewall. Don't forget email security!",
            
            "VMware setup for branch office: vSphere Essentials (3 hosts), vCenter, SAN storage, and backup. Usually need 2-3 VMs per 25 users. Veeam for backup is essential.",
            
            "Office network refresh: replaced old equipment with Meraki switches, FortiGate firewall, UniFi access points. Cable management and UPS are often overlooked but crucial.",
            
            "Productivity bundle: Microsoft 365 E3, Teams Phone System, SharePoint, and Power Platform. For creative teams, add Adobe Creative Cloud. Backup with OneDrive + third-party solution."
        ];
    }

    // تحليل نتائج الذكاء الاصطناعي
    parseAIAnalysis(analysisText) {
        try {
            // محاولة استخراج JSON إذا كان موجود
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // تحليل النص إذا لم يكن JSON
            const bundles = [];
            const lines = analysisText.split('\n');
            
            let currentBundle = null;
            lines.forEach(line => {
                if (line.includes('Bundle:') || line.includes('Configuration:')) {
                    if (currentBundle) bundles.push(currentBundle);
                    currentBundle = {
                        name: line.replace(/Bundle:|Configuration:/g, '').trim(),
                        items: [],
                        useCase: '',
                        userRange: [1, 100]
                    };
                } else if (currentBundle && line.trim()) {
                    if (line.includes('users') || line.includes('Users')) {
                        const userMatch = line.match(/(\d+)[-–](\d+)\s*users?/i);
                        if (userMatch) {
                            currentBundle.userRange = [parseInt(userMatch[1]), parseInt(userMatch[2])];
                        }
                    } else if (line.includes('-') || line.includes('•')) {
                        const product = line.replace(/[-•]\s*/, '').trim();
                        if (product) {
                            currentBundle.items.push({
                                name: product,
                                essential: true
                            });
                        }
                    }
                }
            });

            if (currentBundle) bundles.push(currentBundle);
            return bundles;

        } catch (error) {
            console.warn('Failed to parse AI analysis:', error);
            return [];
        }
    }

    // معالجة التجميعات من التحليل
    async processBundlesFromAnalysis(analysisResults) {
        const bundles = [];
        
        for (const result of analysisResults) {
            if (!result.name || !result.items) continue;
            
            const bundle = {
                id: this.generateBundleId(result.name),
                name: result.name,
                description: result.useCase || `حزمة ${result.name} متكاملة`,
                category: this.categorizeBundle(result.name),
                userRange: result.userRange || [1, 100],
                items: [],
                createdAt: new Date().toISOString(),
                source: 'ai_analysis',
                confidence: 0.8
            };

            // البحث عن المنتجات المطابقة في الكتالوج
            for (const item of result.items) {
                const searchQuery = this.extractSearchQuery(item.name);
                const products = await this.searchProducts(searchQuery);
                
                if (products.length > 0) {
                    bundle.items.push({
                        name: item.name,
                        searchQuery: searchQuery,
                        suggestions: products.slice(0, 3),
                        essential: item.essential !== false
                    });
                }
            }

            if (bundle.items.length > 0) {
                bundles.push(bundle);
            }
        }

        return bundles;
    }

    // إنشاء تجميعات احتياطية بناءً على الأنماط
    async generateFallbackBundles() {
        const bundles = [];
        
        for (const [patternName, pattern] of Object.entries(this.bundlePatterns)) {
            const bundle = {
                id: this.generateBundleId(patternName),
                name: this.humanizeBundleName(patternName),
                description: `حزمة ${this.humanizeBundleName(patternName)} للشركات الصغيرة والمتوسطة`,
                category: this.categorizeBundle(patternName),
                userRange: this.estimateUserRange(patternName),
                items: [],
                createdAt: new Date().toISOString(),
                source: 'pattern_matching',
                confidence: 0.6
            };

            // البحث عن المنتجات لكل عنصر في النمط
            for (const item of pattern.commonItems) {
                const products = await this.searchProducts(item.query);
                
                if (products.length > 0) {
                    bundle.items.push({
                        name: this.humanizeItemName(item.type),
                        searchQuery: item.query,
                        suggestions: products.slice(0, 3),
                        essential: item.essential
                    });
                }
            }

            if (bundle.items.length > 0) {
                bundles.push(bundle);
            }
        }

        return bundles;
    }

    // البحث في المنتجات (محاكاة)
    async searchProducts(query) {
        // في التطبيق الحقيقي، سيستدعي /api/search
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, hitsPerPage: 5 })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.hits || [];
            }
        } catch (error) {
            console.warn('Search failed for:', query);
        }
        
        return [];
    }

    // حفظ التجميعات في Algolia
    async saveBundlesToAlgolia(bundles) {
        try {
            // إرسال التجميعات للخادم لحفظها في Algolia
            const response = await fetch('/api/bundles/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bundles })
            });

            if (response.ok) {
                console.log('✅ Bundles saved to Algolia successfully');
            }
        } catch (error) {
            console.warn('Failed to save bundles to Algolia:', error);
        }
    }

    // مساعدات إضافية
    generateBundleId(name) {
        return 'bundle_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    }

    humanizeBundleName(patternName) {
        const names = {
            'small_office_network': 'شبكة المكتب الصغير',
            'security_stack': 'حزمة الأمان الشاملة',
            'microsoft_productivity': 'حزمة الإنتاجية من مايكروسوفت',
            'virtualization_stack': 'حزمة الأنظمة الوهمية'
        };
        
        return names[patternName] || patternName.replace(/_/g, ' ');
    }

    categorizeBundle(name) {
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('network') || lowerName.includes('switch')) return 'networking';
        if (lowerName.includes('security') || lowerName.includes('firewall')) return 'security';
        if (lowerName.includes('office') || lowerName.includes('productivity')) return 'productivity';
        if (lowerName.includes('virtual') || lowerName.includes('vmware')) return 'infrastructure';
        
        return 'general';
    }

    estimateUserRange(patternName) {
        const ranges = {
            'small_office_network': [5, 50],
            'security_stack': [10, 200],
            'microsoft_productivity': [1, 300],
            'virtualization_stack': [20, 500]
        };
        
        return ranges[patternName] || [1, 100];
    }

    humanizeItemName(type) {
        const names = {
            'switch': 'سويتش شبكة',
            'firewall': 'جدار حماية',
            'access_point': 'نقطة وصول WiFi',
            'cables': 'كابلات شبكة',
            'rack': 'رف شبكة'
        };
        
        return names[type] || type;
    }

    extractSearchQuery(productName) {
        // تحويل أسماء المنتجات إلى استعلامات بحث مناسبة
        const lower = productName.toLowerCase();
        
        if (lower.includes('switch')) return 'managed switch';
        if (lower.includes('firewall')) return 'business firewall';
        if (lower.includes('access point') || lower.includes('wifi')) return 'wifi access point';
        if (lower.includes('cable')) return 'ethernet cable';
        if (lower.includes('kaspersky')) return 'kaspersky endpoint';
        if (lower.includes('microsoft') || lower.includes('office')) return 'microsoft 365';
        if (lower.includes('vmware')) return 'vmware vsphere';
        
        return productName;
    }

    // واجهة عامة للحصول على التجميعات
    getGeneratedBundles() {
        return this.generatedBundles;
    }

    // تشغيل الجيل التلقائي
    async startAutoGeneration() {
        console.log('🎯 Starting automatic bundle generation...');
        const bundles = await this.analyzeSources();
        
        if (bundles.length > 0) {
            // إشعار المستخدم بالتجميعات الجديدة
            if (window.QiqToast) {
                window.QiqToast.success(`تم إنشاء ${bundles.length} حزمة جديدة من التحليل الذكي!`);
            }
            
            // حفظ في localStorage للوصول السريع
            localStorage.setItem('qiq_generated_bundles', JSON.stringify(bundles));
        }
        
        return bundles;
    }
}

// تصدير للاستخدام العام
window.AutoBundleGenerator = AutoBundleGenerator;

// تشغيل تلقائي عند تحميل الصفحة (اختياري)
document.addEventListener('DOMContentLoaded', function() {
    // تشغيل الجيل التلقائي بعد فترة من تحميل الصفحة
    setTimeout(async () => {
        if (window.location.pathname.includes('admin') && localStorage.getItem('qiq_auto_bundle_enabled') === 'true') {
            const generator = new AutoBundleGenerator();
            await generator.startAutoGeneration();
        }
    }, 5000);
});