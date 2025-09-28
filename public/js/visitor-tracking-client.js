/**
 * نظام تتبع الزوار المحسن لـ QuickITQuote
 * Enhanced Visitor Tracking System
 * 
 * يتضمن تتبع الجلسات، التفاعلات، والتحويلات مع التكامل مع HelloLeads
 */

// متغيرات عامة للتتبع
let visitorSession = null;
let sessionStartTime = Date.now();
let currentPageData = {
    url: window.location.href,
    title: document.title,
    startTime: Date.now(),
    interactions: []
};

/**
 * تهيئة نظام التتبع المحسن
 */
async function initializeVisitorTracking() {
    try {
        // إنشاء جلسة زائر جديدة
        await createVisitorSession();
        
        // تتبع عرض الصفحة
        await trackPageView();
        
        // إعداد تتبع التفاعلات
        setupInteractionTracking();
        
        // إعداد تتبع الخروج من الصفحة
        setupPageExitTracking();
        
        // تتبع دوري للنشاط
        setupPeriodicTracking();
        
        console.log('✅ Enhanced Visitor Tracking initialized');
        
    } catch (error) {
        console.error('❌ Visitor Tracking initialization failed:', error);
    }
}

/**
 * إنشاء جلسة زائر جديدة
 */
async function createVisitorSession() {
    try {
        const response = await fetch('/api/visitor-tracking-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'track_session',
                page_title: document.title,
                page_url: window.location.href
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            visitorSession = result.visitor_data;
            
            // حفظ معرف الجلسة في التخزين المحلي
            localStorage.setItem('qiq_session_id', visitorSession.session_id);
            
            // حفظ في الكوكيز للاستمرارية
            document.cookie = `qiq_visitor_id=${visitorSession.visitor_id}; path=/; max-age=2592000`; // 30 يوم
            
        } else {
            console.log('Session tracking fallback mode');
            visitorSession = createFallbackSession();
        }
        
    } catch (error) {
        console.error('Session creation error:', error);
        visitorSession = createFallbackSession();
    }
}

/**
 * تتبع عرض الصفحة
 */
async function trackPageView(pageType = null, pageTitle = null) {
    if (!visitorSession) return;
    
    try {
        await fetch('/api/visitor-tracking-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'track_page_view',
                data: {
                    session_id: visitorSession.session_id,
                    page_url: window.location.href,
                    page_title: pageTitle || document.title,
                    page_type: pageType || detectPageType(),
                    referrer: document.referrer,
                    timestamp: new Date().toISOString()
                }
            })
        });
        
    } catch (error) {
        console.error('Page view tracking error:', error);
    }
}

/**
 * إعداد تتبع التفاعلات
 */
function setupInteractionTracking() {
    // تتبع النقرات على الأزرار المهمة
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        // تحديد نوع التفاعل
        let interactionType = 'click';
        let elementInfo = getElementInfo(target);
        
        // التفاعلات المهمة فقط
        if (shouldTrackElement(target)) {
            trackInteraction(interactionType, elementInfo, target);
        }
    });
    
    // تتبع التمرير
    let scrollTimer;
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            if (scrollDepth > 0 && scrollDepth % 25 === 0) { // كل 25%
                trackInteraction('scroll', { depth: scrollDepth });
            }
        }, 250);
    });
    
    // تتبع التفاعل مع النماذج
    document.addEventListener('input', function(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            trackInteraction('form_input', {
                field: event.target.name || event.target.id,
                type: event.target.type
            });
        }
    });
    
    // تتبع التمرير المطول (engagement)
    let engagementTimer;
    let totalTimeOnPage = 0;
    
    function startEngagementTimer() {
        engagementTimer = setInterval(() => {
            totalTimeOnPage += 1;
            if (totalTimeOnPage % 30 === 0) { // كل 30 ثانية
                trackInteraction('engagement', { time_on_page: totalTimeOnPage });
            }
        }, 1000);
    }
    
    function stopEngagementTimer() {
        clearInterval(engagementTimer);
    }
    
    // بدء التتبع عند تحميل الصفحة
    startEngagementTimer();
    
    // إيقاف التتبع عند عدم النشاط
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopEngagementTimer();
        } else {
            startEngagementTimer();
        }
    });
}

/**
 * تتبع تفاعل محدد
 */
async function trackInteraction(type, elementInfo, element = null) {
    if (!visitorSession) return;
    
    try {
        const interactionData = {
            session_id: visitorSession.session_id,
            type: type,
            element: elementInfo,
            value: element ? (element.textContent || element.value || element.alt) : null,
            page_url: window.location.href,
            timestamp: new Date().toISOString()
        };
        
        // حفظ محلياً أولاً
        currentPageData.interactions.push(interactionData);
        
        // إرسال للخادم
        await fetch('/api/visitor-tracking-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'track_interaction',
                data: interactionData
            })
        });
        
    } catch (error) {
        console.error('Interaction tracking error:', error);
    }
}

/**
 * تتبع التحويل (عند طلب الأسعار أو إضافة المنتجات)
 */
async function trackConversion(type, details = {}) {
    if (!visitorSession) return;
    
    try {
        const conversionData = {
            session_id: visitorSession.session_id,
            type: type, // 'quote_request', 'product_add', 'contact_form'
            value: details.value || 0,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        await fetch('/api/visitor-tracking-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'track_conversion',
                data: conversionData
            })
        });
        
        // إشعار نجاح التحويل
        console.log(`✅ Conversion tracked: ${type}`, details);
        
    } catch (error) {
        console.error('Conversion tracking error:', error);
    }
}

/**
 * إعداد تتبع الخروج من الصفحة
 */
function setupPageExitTracking() {
    window.addEventListener('beforeunload', function() {
        const timeOnPage = Date.now() - currentPageData.startTime;
        
        // إرسال بيانات الجلسة النهائية
        if (navigator.sendBeacon && visitorSession) {
            const finalData = JSON.stringify({
                action: 'track_page_view',
                data: {
                    session_id: visitorSession.session_id,
                    page_url: window.location.href,
                    time_on_page: Math.round(timeOnPage / 1000),
                    interactions_count: currentPageData.interactions.length,
                    exit_timestamp: new Date().toISOString()
                }
            });
            
            navigator.sendBeacon('/api/visitor-tracking-enhanced', finalData);
        }
    });
}

/**
 * إعداد التتبع الدوري
 */
function setupPeriodicTracking() {
    // إرسال دوري كل 5 دقائق للجلسات النشطة
    setInterval(async () => {
        if (visitorSession && !document.hidden) {
            try {
                await fetch('/api/visitor-tracking-enhanced', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'track_page_view',
                        data: {
                            session_id: visitorSession.session_id,
                            page_url: window.location.href,
                            time_on_page: Math.round((Date.now() - currentPageData.startTime) / 1000),
                            status: 'active'
                        }
                    })
                });
            } catch (error) {
                console.error('Periodic tracking error:', error);
            }
        }
    }, 300000); // 5 دقائق
}

// ========== وظائف مساعدة ==========

function createFallbackSession() {
    return {
        session_id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        visitor_id: `fallback_visitor_${Date.now()}`,
        timestamp: new Date().toISOString()
    };
}

function detectPageType() {
    const path = window.location.pathname;
    if (path.includes('products-list')) return 'catalog';
    if (path.includes('quote')) return 'quote';
    if (path.includes('index') || path === '/') return 'chat';
    if (path.includes('account')) return 'account';
    return 'other';
}

function getElementInfo(element) {
    if (!element) return {};
    
    return {
        tag: element.tagName?.toLowerCase(),
        id: element.id,
        class: element.className,
        text: element.textContent?.substring(0, 100), // أول 100 حرف
        href: element.href,
        type: element.type,
        name: element.name
    };
}

function shouldTrackElement(element) {
    if (!element) return false;
    
    // تتبع الأزرار المهمة فقط
    const importantSelectors = [
        'button',
        '.btn',
        '.add-to-quote',
        '.quote-wizard',
        '.add-product',
        '.remove-product',
        '.compare-btn',
        '.qiq-chat-button',
        'a[href*="quote"]',
        'a[href*="products"]',
        'input[type="submit"]',
        '.modal-trigger'
    ];
    
    return importantSelectors.some(selector => {
        try {
            return element.matches(selector) || element.closest(selector);
        } catch (e) {
            return false;
        }
    });
}

// تصدير الوظائف للاستخدام الخارجي
if (typeof window !== 'undefined') {
    window.initializeVisitorTracking = initializeVisitorTracking;
    window.trackPageView = trackPageView;
    window.trackInteraction = trackInteraction;
    window.trackConversion = trackConversion;
}

// تصدير للـ Node.js إذا لزم الأمر
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeVisitorTracking,
        trackPageView,
        trackInteraction,
        trackConversion
    };
}