/**
 * Smart BOQ Chatbot State Management System
 * يدير حالات المحادثة ويمنع تكرار الردود
 */

class ChatStateManager {
    constructor() {
        this.storageKey = 'qiq_chat_state';
        this.state = this.loadState();
        this.conversationLog = [];
        this.lastReplyHash = '';
        this.init();
    }

    init() {
        // إعداد المراقبة للحفظ التلقائي
        this.saveStateDebounced = this.debounce(() => this.saveState(), 500);
        
        // تنظيف الحالة القديمة (أكثر من 24 ساعة)
        if (this.state.lastUpdated && Date.now() - this.state.lastUpdated > 24 * 60 * 60 * 1000) {
            this.resetState();
        }
        
        console.log('💬 Chat State Manager initialized:', this.state);
    }

    // تحميل الحالة من localStorage
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    phase: 'initial', // initial, needs_analysis, catalog_suggested, boq_ready, completed
                    userNeeds: {
                        solution: null,     // نوع الحل المطلوب
                        users: null,        // عدد المستخدمين
                        budget: null,       // الميزانية
                        timeline: null,     // المدة الزمنية
                        brand: null,        // براند مفضل
                        details: null       // تفاصيل إضافية
                    },
                    recommendations: [], // المنتجات المقترحة
                    askedQuestions: [],  // الأسئلة التي تم طرحها
                    catalogShown: false, // هل تم عرض الكتالوج
                    boqRequested: false, // هل تم طلب BOQ
                    sessionId: this.generateSessionId(),
                    lastUpdated: Date.now(),
                    ...parsed
                };
            }
        } catch (error) {
            console.warn('Failed to load chat state:', error);
        }

        return this.getDefaultState();
    }

    // الحالة الافتراضية
    getDefaultState() {
        return {
            phase: 'initial',
            userNeeds: {
                solution: null,
                users: null,
                budget: null,
                timeline: null,
                brand: null,
                details: null
            },
            recommendations: [],
            askedQuestions: [],
            catalogShown: false,
            boqRequested: false,
            sessionId: this.generateSessionId(),
            lastUpdated: Date.now()
        };
    }

    // حفظ الحالة
    saveState() {
        try {
            this.state.lastUpdated = Date.now();
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('Failed to save chat state:', error);
        }
    }

    // إعادة تعيين الحالة
    resetState() {
        this.state = this.getDefaultState();
        this.conversationLog = [];
        this.lastReplyHash = '';
        this.saveState();
        console.log('🔄 Chat state reset');
    }

    // تحديث الحالة
    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveStateDebounced();
        console.log('📝 State updated:', updates);
    }

    // تحديث احتياجات المستخدم
    updateUserNeeds(needs) {
        this.state.userNeeds = { ...this.state.userNeeds, ...needs };
        this.saveStateDebounced();
    }

    // إضافة سؤال تم طرحه
    addAskedQuestion(question) {
        if (!this.state.askedQuestions.includes(question)) {
            this.state.askedQuestions.push(question);
            this.saveStateDebounced();
        }
    }

    // فحص هل تم طرح السؤال من قبل
    hasAskedQuestion(question) {
        return this.state.askedQuestions.includes(question);
    }

    // إضافة رد للسجل مع hash لمنع التكرار
    addToLog(role, content, metadata = {}) {
        const entry = {
            role,
            content,
            timestamp: new Date().toISOString(),
            phase: this.state.phase,
            ...metadata
        };
        
        this.conversationLog.push(entry);
        
        // حفظ hash الرد الأخير لمنع التكرار
        if (role === 'assistant') {
            this.lastReplyHash = this.generateHash(content);
        }
        
        console.log('💭 Added to conversation log:', entry);
    }

    // فحص هل الرد مكرر
    isRepeatedReply(content) {
        const hash = this.generateHash(content);
        return hash === this.lastReplyHash;
    }

    // تحليل مدخلات المستخدم لاستخراج المعلومات
    analyzeUserInput(input) {
        const analysis = {
            hasNumbers: /\d+/g.test(input),
            hasBrands: this.extractBrands(input),
            hasSolutions: this.extractSolutions(input),
            hasUrgency: this.extractUrgency(input),
            hasBudget: this.extractBudget(input),
            intent: this.classifyIntent(input)
        };

        // تحديث احتياجات المستخدم بناءً على التحليل
        if (analysis.hasBrands.length > 0) {
            this.updateUserNeeds({ brand: analysis.hasBrands[0] });
        }

        if (analysis.hasSolutions.length > 0) {
            this.updateUserNeeds({ solution: analysis.hasSolutions[0] });
        }

        const userCount = input.match(/(\d+)\s*(مستخدم|user|جهاز|device)/i);
        if (userCount) {
            this.updateUserNeeds({ users: parseInt(userCount[1]) });
        }

        return analysis;
    }

    // استخراج البراندات المذكورة
    extractBrands(input) {
        const brandMap = {
            'kaspersky': 'Kaspersky',
            'microsoft': 'Microsoft',
            'vmware': 'VMware',
            'fortinet': 'Fortinet',
            'cisco': 'Cisco',
            'dell': 'Dell',
            'hp': 'HP',
            'adobe': 'Adobe',
            'autodesk': 'Autodesk',
            'commscope': 'CommScope',
            'ubiquiti': 'Ubiquiti'
        };

        const brands = [];
        const lowerInput = input.toLowerCase();
        
        Object.keys(brandMap).forEach(key => {
            if (lowerInput.includes(key)) {
                brands.push(brandMap[key]);
            }
        });

        return brands;
    }

    // استخراج الحلول المذكورة
    extractSolutions(input) {
        const solutionMap = {
            'antivirus|انتي فايروس|حماية': 'Security',
            'office|أوفيس|مكتبية': 'Productivity',
            'backup|نسخ احتياطي': 'Backup',
            'firewall|جدار حماية': 'Network Security',
            'wifi|واي فاي|شبكة لاسلكية': 'Wireless',
            'server|سيرفر|خادم': 'Infrastructure',
            'switch|سويتش': 'Networking',
            'camera|كاميرا|مراقبة': 'Surveillance',
            'edr|endpoint detection': 'EDR'
        };

        const solutions = [];
        const lowerInput = input.toLowerCase();

        Object.keys(solutionMap).forEach(pattern => {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(lowerInput)) {
                solutions.push(solutionMap[pattern]);
            }
        });

        return solutions;
    }

    // استخراج الاستعجال
    extractUrgency(input) {
        const urgentPatterns = /عاجل|urgent|سريع|quick|fast|فوري|immediate/i;
        return urgentPatterns.test(input) ? 'high' : 'normal';
    }

    // استخراج الميزانية
    extractBudget(input) {
        const budgetMatch = input.match(/(\d+(?:,\d{3})*)\s*(دولار|dollar|جنيه|egp|usd)/i);
        if (budgetMatch) {
            return {
                amount: parseInt(budgetMatch[1].replace(/,/g, '')),
                currency: budgetMatch[2].toLowerCase().includes('dol') || budgetMatch[2].toLowerCase().includes('usd') ? 'USD' : 'EGP'
            };
        }
        return null;
    }

    // تصنيف نية المستخدم
    classifyIntent(input) {
        const lowerInput = input.toLowerCase();

        if (/ابحث|search|عايز|أريد|need|want/.test(lowerInput)) {
            return 'search';
        } else if (/سعر|price|تكلفة|cost|كام/.test(lowerInput)) {
            return 'pricing';
        } else if (/مقارنة|compare|بدائل|alternatives/.test(lowerInput)) {
            return 'comparison';
        } else if (/معلومات|info|details|تفاصيل/.test(lowerInput)) {
            return 'information';
        } else if (/boq|عرض سعر|quotation/.test(lowerInput)) {
            return 'quotation';
        } else if (/نعم|yes|موافق|ok/.test(lowerInput)) {
            return 'confirmation';
        } else if (/لا|no|مش عايز/.test(lowerInput)) {
            return 'rejection';
        }

        return 'general';
    }

    // تحديد الخطوة التالية في المحادثة
    getNextAction() {
        const { phase, userNeeds } = this.state;

        switch (phase) {
            case 'initial':
                return {
                    action: 'collect_requirements',
                    priority: this.getMissingRequirement()
                };

            case 'needs_analysis':
                if (this.hasMinimumRequirements()) {
                    return { action: 'suggest_catalog' };
                }
                return {
                    action: 'collect_more_info',
                    missing: this.getMissingRequirements()
                };

            case 'catalog_suggested':
                return { action: 'show_products' };

            case 'boq_ready':
                return { action: 'generate_boq' };

            default:
                return { action: 'continue_conversation' };
        }
    }

    // فحص الحد الأدنى من المتطلبات
    hasMinimumRequirements() {
        const { solution, users } = this.state.userNeeds;
        return solution && users;
    }

    // الحصول على أول متطلب مفقود
    getMissingRequirement() {
        const { solution, users, timeline } = this.state.userNeeds;
        
        if (!solution) return 'solution';
        if (!users) return 'users';
        if (!timeline) return 'timeline';
        
        return null;
    }

    // الحصول على جميع المتطلبات المفقودة
    getMissingRequirements() {
        const missing = [];
        const { solution, users, timeline, budget } = this.state.userNeeds;

        if (!solution) missing.push('نوع الحل');
        if (!users) missing.push('عدد المستخدمين');
        if (!timeline) missing.push('المدة الزمنية');
        if (!budget) missing.push('الميزانية التقريبية');

        return missing;
    }

    // توليد ID الجلسة
    generateSessionId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // توليد hash للمحتوى
    generateHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // الحصول على ملخص الحالة
    getStateSummary() {
        return {
            phase: this.state.phase,
            completedRequirements: Object.entries(this.state.userNeeds)
                .filter(([key, value]) => value !== null)
                .map(([key]) => key),
            nextAction: this.getNextAction(),
            conversationLength: this.conversationLog.length
        };
    }
}

// تصدير للاستخدام العام
window.ChatStateManager = ChatStateManager;