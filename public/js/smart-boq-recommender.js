/**
 * Smart BOQ Recommender System
 * نظام التوصيات الذكية وإنشاء BOQ
 */

class SmartBOQRecommender {
    constructor() {
        this.solutions = this.getSolutionTemplates();
        this.fallbackResponses = this.getFallbackResponses();
        this.bundleRules = this.getBundleRules();
        this.brandMapping = this.getBrandMapping();
    }

    // قوالب الحلول المختلفة
    getSolutionTemplates() {
        return {
            'Security': {
                'kaspersky': {
                    patterns: ['kaspersky', 'endpoint', 'edr', 'antivirus'],
                    questions: [
                        'كم عدد الأجهزة التي تحتاج حماية؟',
                        'هل تحتاج Endpoint Detection أم Antivirus فقط؟',
                        'ما مدة الترخيص المطلوبة؟ (سنة، سنتين، ثلاث سنوات)'
                    ],
                    products: [
                        { type: 'endpoint', minUsers: 1, maxUsers: 50, recommended: 'Kaspersky Small Office Security' },
                        { type: 'endpoint', minUsers: 51, maxUsers: 500, recommended: 'Kaspersky Endpoint Security for Business' },
                        { type: 'edr', minUsers: 1, maxUsers: 1000, recommended: 'Kaspersky EDR Optimum' }
                    ],
                    bundleItems: (users) => [
                        { category: 'security', query: `kaspersky endpoint ${users} user`, essential: true },
                        { category: 'management', query: 'kaspersky security center', essential: users > 10 },
                        { category: 'backup', query: 'backup security licenses', essential: false }
                    ]
                }
            },
            'Productivity': {
                'microsoft': {
                    patterns: ['office', 'microsoft', '365', 'm365', 'outlook', 'teams'],
                    questions: [
                        'كم عدد المستخدمين؟',
                        'تحتاج Business Standard أم Business Premium؟',
                        'هل تحتاج Teams المدفوع أم المجاني كافي؟',
                        'ما حجم التخزين المطلوب لكل مستخدم؟'
                    ],
                    products: [
                        { type: 'basic', minUsers: 1, maxUsers: 300, recommended: 'Microsoft 365 Business Standard' },
                        { type: 'premium', minUsers: 1, maxUsers: 300, recommended: 'Microsoft 365 Business Premium' },
                        { type: 'enterprise', minUsers: 300, maxUsers: 99999, recommended: 'Microsoft 365 E3' }
                    ],
                    bundleItems: (users) => [
                        { category: 'productivity', query: `microsoft 365 business ${users} user`, essential: true },
                        { category: 'collaboration', query: 'microsoft teams premium', essential: users > 50 },
                        { category: 'security', query: 'microsoft defender business', essential: users > 25 }
                    ]
                }
            },
            'Infrastructure': {
                'vmware': {
                    patterns: ['vmware', 'vsphere', 'virtualization', 'vm'],
                    questions: [
                        'كم عدد الخوادم الفيزيائية؟',
                        'كم عدد المعالجات (CPUs) لكل خادم؟',
                        'هل تحتاج vCenter Server؟',
                        'Standard أم Enterprise Plus؟'
                    ],
                    products: [
                        { type: 'standard', minCPUs: 1, maxCPUs: 32, recommended: 'VMware vSphere Standard' },
                        { type: 'enterprise', minCPUs: 1, maxCPUs: 999, recommended: 'VMware vSphere Enterprise Plus' }
                    ],
                    bundleItems: (cpus) => [
                        { category: 'virtualization', query: `vmware vsphere ${cpus} cpu`, essential: true },
                        { category: 'management', query: 'vmware vcenter server', essential: cpus > 2 },
                        { category: 'backup', query: 'vmware backup solution', essential: true }
                    ]
                }
            },
            'Network Security': {
                'fortinet': {
                    patterns: ['firewall', 'fortinet', 'fortigate', 'utm'],
                    questions: [
                        'ما سرعة الإنترنت الحالية؟',
                        'كم عدد المستخدمين المتزامنين؟',
                        'هل تحتاج UTM كامل أم Firewall أساسي؟',
                        'تحتاج SD-WAN؟'
                    ],
                    products: [
                        { type: 'basic', minUsers: 1, maxUsers: 50, recommended: 'FortiGate 60F' },
                        { type: 'medium', minUsers: 51, maxUsers: 200, recommended: 'FortiGate 100F' },
                        { type: 'enterprise', minUsers: 201, maxUsers: 1000, recommended: 'FortiGate 300E' }
                    ],
                    bundleItems: (users) => [
                        { category: 'firewall', query: `fortigate ${users} user`, essential: true },
                        { category: 'licenses', query: 'fortinet utm bundle', essential: true },
                        { category: 'support', query: 'fortinet support license', essential: false }
                    ]
                }
            }
        };
    }

    // ردود احتياطية ذكية
    getFallbackResponses() {
        return {
            'unknown_product': [
                'لم أتمكن من العثور على هذا المنتج بالضبط، لكن لدينا بدائل مماثلة.',
                'المنتج غير متوفر حالياً، دعني أقترح عليك بديل مناسب.',
                'نضيف منتجات جديدة باستمرار. هذه أفضل البدائل المتاحة:'
            ],
            'need_more_info': [
                'احتاج تفاصيل أكثر لأعطيك اقتراح دقيق.',
                'عشان أساعدك أفضل، قول لي:',
                'خلني أفهم احتياجك بالتفصيل:'
            ],
            'clarification': [
                'عشان أتأكد إني فهمت صح:',
                'تأكيداً لفهمي:',
                'خلني أوضح الموضوع:'
            ],
            'budget_inquiry': [
                'الميزانية هتساعدني أقترح أنسب الحلول.',
                'لو تقدر تقول الميزانية التقريبية هيكون أفضل.',
                'في حلول لكل الميزانيات، إيه المدى السعري اللي يناسبك؟'
            ],
            'ready_for_catalog': [
                'تمام، فهمت احتياجك. هل تحب أشوف لك منتجات من الكتالوج؟',
                'خلاص جمعت المعلومات الأساسية. عايز أعرض عليك اقتراحات من الكتالوج؟',
                'ممتاز! جاهز أقترح عليك منتجات مناسبة من الكتالوج بتاعنا.'
            ],
            'catalog_to_boq': [
                'شوفت المنتجات؟ لو عاجبينك أقدر أحضّر لك BOQ كامل.',
                'الاقتراحات دي مناسبة؟ عايز أعمل لك عرض سعر تفصيلي؟',
                'تمام! جاهز أحضّر BOQ شامل بالأسعار والكميات؟'
            ]
        };
    }

    // قواعد تجميع المنتجات في bundles
    getBundleRules() {
        return {
            'small_office': {
                userRange: [1, 25],
                includeInstallation: true,
                includeSupport: true,
                discountPercent: 5,
                additionalItems: [
                    { type: 'networking', query: 'small office switch', qty: 1 },
                    { type: 'cables', query: 'cat6 cable patch', qty: 10 }
                ]
            },
            'medium_business': {
                userRange: [26, 100],
                includeInstallation: true,
                includeSupport: true,
                includeTraining: true,
                discountPercent: 10,
                additionalItems: [
                    { type: 'networking', query: 'managed switch 24 port', qty: 2 },
                    { type: 'infrastructure', query: 'rack cabinet', qty: 1 },
                    { type: 'cables', query: 'structured cabling', qty: 1 }
                ]
            },
            'enterprise': {
                userRange: [101, 9999],
                includeInstallation: true,
                includeSupport: true,
                includeTraining: true,
                includeManagement: true,
                discountPercent: 15,
                additionalItems: [
                    { type: 'networking', query: 'enterprise switch stack', qty: 1 },
                    { type: 'infrastructure', query: 'server rack 42u', qty: 2 },
                    { type: 'management', query: 'network management system', qty: 1 }
                ]
            }
        };
    }

    // خريطة البراندات والبدائل
    getBrandMapping() {
        return {
            'kaspersky': {
                alternatives: ['Bitdefender', 'ESET', 'Trend Micro'],
                strength: 'حماية قوية ضد التهديدات المتقدمة'
            },
            'microsoft': {
                alternatives: ['Google Workspace', 'Zoho', 'LibreOffice'],
                strength: 'تكامل مثالي مع البيئات المختلطة'
            },
            'vmware': {
                alternatives: ['Hyper-V', 'Citrix', 'Proxmox'],
                strength: 'الرائد في الافتراضية المتقدمة'
            },
            'cisco': {
                alternatives: ['Juniper', 'HP Aruba', 'Ubiquiti'],
                strength: 'معيار الصناعة للشبكات المؤسسية'
            },
            'fortinet': {
                alternatives: ['Palo Alto', 'Check Point', 'SonicWall'],
                strength: 'أمان شامل مع أداء عالي'
            }
        };
    }

    // تحليل الاحتياجات وإنشاء استراتيجية الحوار
    analyzeChatIntent(userInput, currentState) {
        const analysis = {
            confidence: 0,
            intent: 'unknown',
            extractedInfo: {},
            suggestedAction: 'ask_more',
            nextQuestions: [],
            searchQueries: []
        };

        const input = userInput.toLowerCase();
        
        // البحث عن الأنماط في النص
        for (const [solutionType, solutionData] of Object.entries(this.solutions)) {
            for (const [brand, brandData] of Object.entries(solutionData)) {
                if (brandData.patterns.some(pattern => input.includes(pattern))) {
                    analysis.confidence = 0.8;
                    analysis.intent = 'product_inquiry';
                    analysis.extractedInfo = {
                        solution: solutionType,
                        brand: brand,
                        questions: brandData.questions
                    };
                    
                    // إنشاء استعلامات البحث
                    const users = this.extractUserCount(input);
                    if (users) {
                        analysis.searchQueries = brandData.bundleItems(users)
                            .filter(item => item.essential)
                            .map(item => item.query);
                    } else {
                        analysis.searchQueries = [brandData.patterns[0]];
                    }
                    
                    break;
                }
            }
        }

        // تحديد الأسئلة التالية بناءً على المعلومات المفقودة
        if (analysis.extractedInfo.questions) {
            analysis.nextQuestions = this.selectNextQuestions(
                analysis.extractedInfo.questions, 
                currentState.askedQuestions
            );
        }

        return analysis;
    }

    // استخراج عدد المستخدمين من النص
    extractUserCount(text) {
        const patterns = [
            /(\d+)\s*مستخدم/i,
            /(\d+)\s*user/i,
            /(\d+)\s*جهاز/i,
            /(\d+)\s*device/i,
            /(\d+)\s*موظف/i,
            /(\d+)\s*employee/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseInt(match[1]);
            }
        }

        return null;
    }

    // اختيار الأسئلة التالية
    selectNextQuestions(availableQuestions, askedQuestions) {
        return availableQuestions
            .filter(q => !askedQuestions.includes(q))
            .slice(0, 2); // أقصى سؤالين
    }

    // إنشاء رد ذكي بناءً على التحليل
    generateSmartReply(analysis, currentState) {
        let reply = '';
        
        switch (analysis.intent) {
            case 'product_inquiry':
                reply = this.generateProductInquiryReply(analysis, currentState);
                break;
                
            case 'confirmation':
                reply = this.generateConfirmationReply(currentState);
                break;
                
            case 'budget_inquiry':
                reply = this.generateBudgetReply(currentState);
                break;
                
            default:
                reply = this.generateGenericReply(analysis, currentState);
        }

        return {
            reply,
            searchQueries: analysis.searchQueries,
            suggestedPhase: this.suggestNextPhase(analysis, currentState),
            followUpQuestions: analysis.nextQuestions
        };
    }

    // رد على استفسارات المنتجات
    generateProductInquiryReply(analysis, currentState) {
        const { brand, solution } = analysis.extractedInfo;
        const brandInfo = this.brandMapping[brand];
        
        let reply = `ممتاز! ${brand} خيار ممتاز للـ${solution}. `;
        
        if (brandInfo) {
            reply += `${brandInfo.strength}.\n\n`;
        }

        // إضافة الأسئلة التوضيحية
        if (analysis.nextQuestions.length > 0) {
            reply += 'عشان أقدر أساعدك أفضل، احتاج أعرف:\n';
            analysis.nextQuestions.forEach((q, i) => {
                reply += `${i + 1}. ${q}\n`;
            });
        }

        return reply;
    }

    // رد التأكيد
    generateConfirmationReply(currentState) {
        switch (currentState.phase) {
            case 'needs_analysis':
                return this.getRandomFallback('ready_for_catalog');
            case 'catalog_suggested':
                return this.getRandomFallback('catalog_to_boq');
            default:
                return 'شكراً لتأكيدك. دعني أكمل معك...';
        }
    }

    // رد الميزانية
    generateBudgetReply(currentState) {
        return this.getRandomFallback('budget_inquiry');
    }

    // الرد العام
    generateGenericReply(analysis, currentState) {
        if (currentState.phase === 'initial') {
            return `أهلاً بك! 👋\n\nأنا هنا لمساعدتك في إيجاد أفضل الحلول التقنية.\n\nاحكي لي عن:\n• نوع الحل المطلوب\n• عدد المستخدمين\n• الميزانية التقريبية\n\nأو ابدأ بكتابة اسم المنتج مباشرة.`;
        }
        
        return this.getRandomFallback('need_more_info');
    }

    // اقتراح المرحلة التالية
    suggestNextPhase(analysis, currentState) {
        if (analysis.confidence > 0.7 && analysis.extractedInfo.solution) {
            return 'needs_analysis';
        }
        
        if (currentState.userNeeds.solution && currentState.userNeeds.users) {
            return 'catalog_suggested';
        }
        
        return currentState.phase;
    }

    // الحصول على رد احتياطي عشوائي
    getRandomFallback(type) {
        const responses = this.fallbackResponses[type];
        if (!responses || responses.length === 0) {
            return 'كيف يمكنني مساعدتك؟';
        }
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // إنشاء BOQ مبدئي
    async generatePreliminaryBOQ(userNeeds, searchResults) {
        const bundle = this.selectBundleRules(userNeeds.users);
        const boq = {
            title: `BOQ مبدئي - ${userNeeds.solution || 'حل تقني'}`,
            items: [],
            totalEstimate: 0,
            notes: []
        };

        // إضافة المنتجات الأساسية من نتائج البحث
        if (searchResults && searchResults.length > 0) {
            searchResults.slice(0, 5).forEach(product => {
                const price = parseFloat(product.price) || 0;
                boq.items.push({
                    name: product.name,
                    sku: product.sku,
                    price: price,
                    qty: this.calculateQuantity(product, userNeeds),
                    total: price * this.calculateQuantity(product, userNeeds),
                    source: 'catalog'
                });
            });
        }

        // إضافة عناصر إضافية من قواعد التجميع
        if (bundle && bundle.additionalItems) {
            bundle.additionalItems.forEach(item => {
                boq.items.push({
                    name: `${item.type} - ${item.query}`,
                    sku: 'BUNDLE-' + item.type.toUpperCase(),
                    price: 0, // سيتم تحديد السعر لاحقاً
                    qty: item.qty,
                    total: 0,
                    source: 'bundle'
                });
            });
        }

        // حساب الإجمالي
        boq.totalEstimate = boq.items.reduce((sum, item) => sum + item.total, 0);

        // إضافة خصم إذا كان متاحاً
        if (bundle && bundle.discountPercent > 0) {
            const discount = boq.totalEstimate * (bundle.discountPercent / 100);
            boq.totalEstimate -= discount;
            boq.notes.push(`خصم ${bundle.discountPercent}% للحزمة المتكاملة`);
        }

        return boq;
    }

    // اختيار قواعد التجميع بناءً على عدد المستخدمين
    selectBundleRules(userCount) {
        if (!userCount) return null;

        for (const [bundleName, rules] of Object.entries(this.bundleRules)) {
            if (userCount >= rules.userRange[0] && userCount <= rules.userRange[1]) {
                return rules;
            }
        }

        return this.bundleRules.enterprise; // افتراضي للأعداد الكبيرة
    }

    // حساب الكمية المطلوبة
    calculateQuantity(product, userNeeds) {
        const users = userNeeds.users || 1;
        const productName = product.name.toLowerCase();

        // قواعد حساب الكميات
        if (productName.includes('user') || productName.includes('endpoint')) {
            return users;
        } else if (productName.includes('server') || productName.includes('license')) {
            return Math.ceil(users / 50); // خادم واحد لكل 50 مستخدم
        } else if (productName.includes('switch')) {
            return Math.ceil(users / 24); // سويتش واحد لكل 24 منفذ
        } else if (productName.includes('firewall')) {
            return 1; // جدار حماية واحد عادة
        }

        return 1; // افتراضي
    }

    // تقييم جودة المحادثة
    assessConversationQuality(conversationLog) {
        const totalMessages = conversationLog.length;
        const userMessages = conversationLog.filter(msg => msg.role === 'user').length;
        const botMessages = conversationLog.filter(msg => msg.role === 'assistant').length;
        
        const qualityScore = {
            engagement: userMessages > 3 ? 1 : userMessages / 3,
            information_gathering: this.calculateInfoGatheringScore(conversationLog),
            progression: this.calculateProgressionScore(conversationLog),
            overall: 0
        };
        
        qualityScore.overall = (
            qualityScore.engagement * 0.3 +
            qualityScore.information_gathering * 0.4 +
            qualityScore.progression * 0.3
        );
        
        return qualityScore;
    }

    // حساب نقاط جمع المعلومات
    calculateInfoGatheringScore(conversationLog) {
        const infoKeywords = ['عدد', 'مستخدم', 'ميزانية', 'نوع', 'براند', 'حل'];
        let infoScore = 0;
        
        conversationLog.forEach(msg => {
            if (msg.role === 'user') {
                const msgLower = msg.content.toLowerCase();
                infoKeywords.forEach(keyword => {
                    if (msgLower.includes(keyword)) {
                        infoScore += 0.1;
                    }
                });
            }
        });
        
        return Math.min(infoScore, 1);
    }

    // حساب نقاط التقدم في المحادثة
    calculateProgressionScore(conversationLog) {
        const phases = ['initial', 'needs_analysis', 'catalog_suggested', 'boq_ready'];
        const uniquePhases = [...new Set(conversationLog.map(msg => msg.phase))];
        
        return uniquePhases.length / phases.length;
    }

    // البحث في التجميعات المتوفرة
    async searchBundles(query, userCount) {
        try {
            const params = new URLSearchParams({
                query: query || '',
                userCount: userCount || 0,
                limit: 5
            });

            const response = await fetch(`/api/bundles/search?${params}`);
            if (response.ok) {
                const data = await response.json();
                return data.bundles || [];
            }
        } catch (error) {
            console.warn('Bundle search failed:', error);
        }
        
        return [];
    }

    // إنشاء BOQ من تجميعة
    async createBOQFromBundle(bundle, userNeeds) {
        const boq = {
            title: `BOQ من ${bundle.name}`,
            bundleId: bundle.id,
            items: [],
            totalEstimate: 0,
            notes: [`مبني على: ${bundle.description}`]
        };

        // البحث عن المنتجات لكل عنصر في التجميعة
        for (const bundleItem of bundle.items) {
            if (!bundleItem.searchQuery) continue;

            try {
                const products = await this.searchProducts(bundleItem.searchQuery);
                if (products.length > 0) {
                    const product = products[0]; // أخذ أفضل نتيجة
                    const price = parseFloat(product.price) || 0;
                    const qty = this.calculateQuantityForBundle(bundleItem, userNeeds);

                    boq.items.push({
                        name: product.name,
                        sku: product.sku,
                        price: price,
                        qty: qty,
                        total: price * qty,
                        source: 'bundle',
                        bundleItem: bundleItem.name,
                        essential: bundleItem.essential
                    });
                }
            } catch (error) {
                console.warn(`Failed to search for: ${bundleItem.searchQuery}`);
            }
        }

        // حساب الإجمالي
        boq.totalEstimate = boq.items.reduce((sum, item) => sum + item.total, 0);

        // تطبيق خصم للتجميعة
        if (boq.items.length >= 3) {
            const bundleDiscount = boq.totalEstimate * 0.05; // خصم 5%
            boq.totalEstimate -= bundleDiscount;
            boq.notes.push('خصم 5% لشراء التجميعة كاملة');
        }

        return boq;
    }

    // حساب الكمية للتجميعة
    calculateQuantityForBundle(bundleItem, userNeeds) {
        const users = userNeeds.users || 1;
        const itemName = bundleItem.name.toLowerCase();

        if (itemName.includes('user') || itemName.includes('license') || itemName.includes('endpoint')) {
            return users;
        } else if (itemName.includes('switch') || itemName.includes('سويتش')) {
            return Math.ceil(users / 24); // سويتش واحد لكل 24 منفذ
        } else if (itemName.includes('access point') || itemName.includes('wifi')) {
            return Math.ceil(users / 30); // نقطة وصول واحدة لكل 30 مستخدم
        } else if (itemName.includes('firewall') || itemName.includes('جدار')) {
            return 1; // جدار حماية واحد
        } else if (itemName.includes('server') || itemName.includes('خادم')) {
            return Math.ceil(users / 50); // خادم واحد لكل 50 مستخدم
        }

        return 1; // افتراضي
    }

    // البحث المحسن في المنتجات
    async searchProducts(query) {
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, hitsPerPage: 3 })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.hits || [];
            }
        } catch (error) {
            console.warn('Product search failed for:', query);
        }
        
        return [];
    }
}

// تصدير للاستخدام العام
window.SmartBOQRecommender = SmartBOQRecommender;