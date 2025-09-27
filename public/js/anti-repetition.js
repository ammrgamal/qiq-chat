/**
 * Anti-Repetition System
 * نظام منع تكرار الردود في المحادثة
 */

class AntiRepetitionSystem {
    constructor() {
        this.conversationState = {
            topics: new Set(),
            askedQuestions: new Set(),
            suggestedProducts: new Set(),
            lastResponses: [],
            contextSwitchCount: 0
        };
        this.responseVariations = this.getResponseVariations();
    }

    // تنويعات الردود حسب السياق
    getResponseVariations() {
        return {
            greeting: [
                "أهلاً بك في QuickITQuote! كيف يمكنني مساعدتك اليوم؟",
                "مرحباً! سعيد لخدمتك. ما المنتجات التي تبحث عنها؟",
                "أهلاً وسهلاً! أنا هنا لأساعدك في العثور على أفضل الحلول التقنية.",
                "مرحباً بك! دعني أساعدك في اختيار المنتجات المناسبة لاحتياجاتك."
            ],
            
            needsCollection: [
                "لأساعدك بشكل أفضل، ما نوع الحل التقني الذي تحتاجه؟",
                "هل يمكنك توضيح المشروع أو النظام الذي تريد تطويره؟",
                "دعني أفهم احتياجاتك أكثر. ما الهدف من هذا النظام؟",
                "لاختيار الأنسب لك، ما حجم الشركة أو المشروع؟",
                "هل تبحث عن حل أمان، أم شبكات، أم خوادم؟"
            ],
            
            budgetInquiry: [
                "ما الميزانية المتوقعة لهذا المشروع؟",
                "هل لديك نطاق سعري محدد تفضل العمل ضمنه؟",
                "لأقترح عليك أنسب الخيارات، ما المبلغ التقريبي المتاح؟",
                "هل تريد حلول اقتصادية أم متميزة أم متوسطة؟"
            ],
            
            productSuggestion: [
                "بناءً على احتياجاتك، أقترح عليك هذه المنتجات:",
                "وجدت لك بعض الخيارات المناسبة:",
                "هذه أفضل الحلول المتاحة لمشروعك:",
                "إليك اقتراحاتي المختارة بعناية:"
            ],
            
            clarification: [
                "هل يمكنك توضيح هذه النقطة أكثر؟",
                "لم أتأكد تماماً من مقصدك، هل تعني...؟",
                "دعني أفهم هذا بشكل أوضح...",
                "أريد التأكد من فهمي الصحيح لطلبك..."
            ],
            
            alternatives: [
                "دعني أقترح عليك بديلاً آخر...",
                "ماذا لو جربنا منهجاً مختلفاً؟",
                "يمكننا أيضاً النظر في خيارات أخرى...",
                "هناك حلول بديلة قد تناسبك أكثر..."
            ],
            
            contextSwitch: [
                "دعني أغير الموضوع قليلاً، هل تريد استعراض الكتالوج مباشرة؟",
                "ماذا لو بدأنا من زاوية أخرى؟ ما أهم شيء تحتاجه في الوقت الحالي؟",
                "لنجرب طريقة مختلفة، هل تفضل رؤية أمثلة عملية؟",
                "أو يمكنني عرض بعض الحلول الشائعة إذا كان ذلك مفيداً؟"
            ]
        };
    }

    // تحليل الرد للبحث عن التكرار
    analyzeResponse(newResponse, conversationHistory) {
        const analysis = {
            isRepeated: this.detectRepetition(newResponse),
            responseType: this.classifyResponse(newResponse),
            contextNeedsSwitch: this.shouldSwitchContext(conversationHistory),
            suggestedVariation: null
        };

        if (analysis.isRepeated || analysis.contextNeedsSwitch) {
            analysis.suggestedVariation = this.generateVariation(analysis.responseType, conversationHistory);
        }

        return analysis;
    }

    // كشف التكرار المتقدم
    detectRepetition(newResponse) {
        // تنظيف النص للمقارنة
        const cleanResponse = this.normalizeText(newResponse);
        
        // فحص التشابه مع آخر 3 ردود
        for (const pastResponse of this.conversationState.lastResponses.slice(-3)) {
            const similarity = this.calculateSimilarity(cleanResponse, this.normalizeText(pastResponse));
            if (similarity > 0.7) {
                return true;
            }
        }

        return false;
    }

    // تطبيع النص للمقارنة
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\u0600-\u06FF\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // حساب التشابه بين نصين
    calculateSimilarity(text1, text2) {
        const words1 = text1.split(' ');
        const words2 = text2.split(' ');
        
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = Math.max(words1.length, words2.length);
        
        return commonWords.length / totalWords;
    }

    // تصنيف نوع الرد
    classifyResponse(response) {
        const text = response.toLowerCase();
        
        if (text.includes('مرحب') || text.includes('أهل')) return 'greeting';
        if (text.includes('ميزانية') || text.includes('سعر')) return 'budgetInquiry';
        if (text.includes('توضيح') || text.includes('أفهم')) return 'clarification';
        if (text.includes('أقترح') || text.includes('وجدت')) return 'productSuggestion';
        if (text.includes('تحتاج') || text.includes('نوع')) return 'needsCollection';
        
        return 'general';
    }

    // تحديد إذا كان السياق يحتاج تغيير
    shouldSwitchContext(conversationHistory) {
        const recentMessages = conversationHistory.slice(-6);
        const botMessages = recentMessages.filter(msg => msg.type === 'bot');
        
        // إذا كان البوت سأل نفس النوع من الأسئلة 3 مرات
        const questionTypes = botMessages.map(msg => this.classifyResponse(msg.content));
        const lastType = questionTypes[questionTypes.length - 1];
        const sameTypeCount = questionTypes.filter(type => type === lastType).length;
        
        return sameTypeCount >= 3;
    }

    // توليد تنويع للرد
    generateVariation(responseType, conversationHistory) {
        const variations = this.responseVariations[responseType] || this.responseVariations.alternatives;
        
        // اختيار تنويع لم يُستخدم مؤخراً
        const usedVariations = this.conversationState.lastResponses.slice(-5);
        const availableVariations = variations.filter(variation => 
            !usedVariations.some(used => this.calculateSimilarity(variation, used) > 0.5)
        );

        if (availableVariations.length === 0) {
            // إذا استُخدمت كل التنويعات، قم بتبديل السياق
            this.conversationState.contextSwitchCount++;
            return this.generateContextSwitch();
        }

        const selectedVariation = availableVariations[Math.floor(Math.random() * availableVariations.length)];
        return selectedVariation;
    }

    // توليد تغيير في السياق
    generateContextSwitch() {
        const contextSwitches = this.responseVariations.contextSwitch;
        const randomSwitch = contextSwitches[Math.floor(Math.random() * contextSwitches.length)];
        
        this.conversationState.contextSwitchCount++;
        return randomSwitch;
    }

    // تسجيل رد جديد
    recordResponse(response) {
        this.conversationState.lastResponses.push(response);
        
        // الاحتفاظ بآخر 10 ردود فقط
        if (this.conversationState.lastResponses.length > 10) {
            this.conversationState.lastResponses.shift();
        }
    }

    // إعادة تعيين الحالة
    reset() {
        this.conversationState = {
            topics: new Set(),
            askedQuestions: new Set(),
            suggestedProducts: new Set(),
            lastResponses: [],
            contextSwitchCount: 0
        };
    }

    // الحصول على إحصائيات
    getStats() {
        return {
            totalResponses: this.conversationState.lastResponses.length,
            contextSwitches: this.conversationState.contextSwitchCount,
            topicsDiscussed: this.conversationState.topics.size,
            questionsAsked: this.conversationState.askedQuestions.size
        };
    }
}

// تصدير للاستخدام العام
window.AntiRepetitionSystem = AntiRepetitionSystem;

// تهيئة النظام
document.addEventListener('DOMContentLoaded', function() {
    window.antiRepetition = new AntiRepetitionSystem();
    console.log('🔄 Anti-Repetition System initialized');
});