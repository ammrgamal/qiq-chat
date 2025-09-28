/**
 * Analytics & User Behavior Tracker
 * نظام التحليلات ومراقبة سلوك المستخدمين
 */

class AdvancedAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.pageViews = [];
        this.userInteractions = [];
        this.performanceMetrics = {};
        this.isTracking = true;
        this.batchSize = 10;
        this.batchTimeout = 30000; // 30 seconds
        this.init();
    }

    // تهيئة النظام
    init() {
        this.setupEventListeners();
        this.trackPageLoad();
        this.startPerformanceMonitoring();
        this.setupBatchSending();
        this.trackUserEngagement();
        console.log('📊 Advanced Analytics initialized with session:', this.sessionId);
    }

    // توليد معرف الجلسة
    generateSessionId() {
        return 'qiq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // إعداد مستمعي الأحداث
    setupEventListeners() {
        // تتبع النقرات
        document.addEventListener('click', (e) => {
            this.trackClick(e);
        });

        // تتبع إرسال النماذج
        document.addEventListener('submit', (e) => {
            this.trackFormSubmission(e);
        });

        // تتبع التمرير
        let scrollTimeout;
        document.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackScroll();
            }, 250);
        });

        // تتبع تغيير الحجم
        window.addEventListener('resize', () => {
            this.trackResize();
        });

        // تتبع فقدان التركيز
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.trackPageLeave();
            } else {
                this.trackPageReturn();
            }
        });

        // تتبع الأخطاء
        window.addEventListener('error', (e) => {
            this.trackError('javascript', e.error, {
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });

        // تتبع الـ Promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.trackError('promise_rejection', e.reason);
        });
    }

    // تتبع تحميل الصفحة
    trackPageLoad() {
        const pageData = {
            url: window.location.href,
            title: document.title,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            connection: this.getConnectionInfo(),
            loadTime: performance.now()
        };

        this.pageViews.push(pageData);
        this.sendEvent('page_view', pageData);
    }

    // تتبع النقرات
    trackClick(event) {
        const element = event.target;
        const clickData = {
            elementType: element.tagName.toLowerCase(),
            elementId: element.id || null,
            elementClass: element.className || null,
            elementText: element.textContent?.trim().substring(0, 100) || null,
            coordinates: { x: event.clientX, y: event.clientY },
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        // تتبع خاص للأزرار المهمة
        if (element.closest('.btn, button') || element.tagName === 'BUTTON') {
            clickData.buttonType = this.getButtonType(element);
            clickData.isCtaButton = this.isCtaButton(element);
        }

        // تتبع النقر على الروابط
        if (element.closest('a') || element.tagName === 'A') {
            const link = element.closest('a') || element;
            clickData.linkUrl = link.href;
            clickData.linkTarget = link.target;
            clickData.isExternalLink = this.isExternalLink(link.href);
        }

        this.userInteractions.push(clickData);
        this.sendEvent('click', clickData);
    }

    // تحديد نوع الزر
    getButtonType(element) {
        const text = element.textContent?.toLowerCase() || '';
        const classList = element.className?.toLowerCase() || '';
        
        if (text.includes('شراء') || text.includes('buy') || classList.includes('buy')) return 'purchase';
        if (text.includes('إضافة') || text.includes('add') || classList.includes('add')) return 'add_to_cart';
        if (text.includes('مقارنة') || text.includes('compare')) return 'compare';
        if (text.includes('تفاصيل') || text.includes('details')) return 'view_details';
        if (text.includes('بحث') || text.includes('search')) return 'search';
        if (text.includes('تسجيل') || text.includes('register')) return 'register';
        if (text.includes('تسجيل دخول') || text.includes('login')) return 'login';
        
        return 'other';
    }

    // تحديد إذا كان زر CTA
    isCtaButton(element) {
        const ctaKeywords = ['شراء', 'إضافة', 'اطلب', 'احصل', 'buy', 'add', 'get', 'order'];
        const text = element.textContent?.toLowerCase() || '';
        const classList = element.className?.toLowerCase() || '';
        
        return ctaKeywords.some(keyword => 
            text.includes(keyword) || classList.includes(keyword)
        );
    }

    // تحديد الروابط الخارجية
    isExternalLink(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname !== window.location.hostname;
        } catch {
            return false;
        }
    }

    // تتبع إرسال النماذج
    trackFormSubmission(event) {
        const form = event.target;
        const formData = {
            formId: form.id || null,
            formClass: form.className || null,
            formAction: form.action || null,
            formMethod: form.method || 'get',
            fieldCount: form.elements.length,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        // تتبع أنواع الحقول
        const fieldTypes = {};
        Array.from(form.elements).forEach(element => {
            const type = element.type || element.tagName.toLowerCase();
            fieldTypes[type] = (fieldTypes[type] || 0) + 1;
        });
        formData.fieldTypes = fieldTypes;

        this.sendEvent('form_submission', formData);
    }

    // تتبع التمرير
    trackScroll() {
        const scrollData = {
            scrollTop: window.pageYOffset || document.documentElement.scrollTop,
            scrollLeft: window.pageXOffset || document.documentElement.scrollLeft,
            scrollPercentage: Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100),
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        // إرسال فقط عند نقاط معينة من التمرير
        if (scrollData.scrollPercentage % 25 === 0 && scrollData.scrollPercentage > 0) {
            this.sendEvent('scroll_milestone', {
                percentage: scrollData.scrollPercentage,
                timestamp: scrollData.timestamp
            });
        }
    }

    // تتبع تغيير الحجم
    trackResize() {
        const resizeData = {
            newSize: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString()
        };

        this.sendEvent('viewport_resize', resizeData);
    }

    // تتبع ترك الصفحة
    trackPageLeave() {
        const leaveData = {
            timeOnPage: Date.now() - performance.timing.navigationStart,
            timestamp: new Date().toISOString()
        };

        this.sendEvent('page_leave', leaveData);
    }

    // تتبع العودة للصفحة
    trackPageReturn() {
        this.sendEvent('page_return', {
            timestamp: new Date().toISOString()
        });
    }

    // تتبع الأخطاء
    trackError(type, error, details = {}) {
        const errorData = {
            type,
            message: error?.message || error?.toString() || 'Unknown error',
            stack: error?.stack || null,
            details,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.sendEvent('error', errorData);
    }

    // بدء مراقبة الأداء
    startPerformanceMonitoring() {
        // مراقبة Navigation Timing
        if (performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = performance.timing;
                    const navigationTiming = {
                        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
                        tcpConnection: timing.connectEnd - timing.connectStart,
                        serverResponse: timing.responseEnd - timing.requestStart,
                        domParsing: timing.domContentLoadedEventStart - timing.responseEnd,
                        resourceLoading: timing.loadEventStart - timing.domContentLoadedEventStart,
                        totalLoadTime: timing.loadEventEnd - timing.navigationStart
                    };

                    this.performanceMetrics.navigation = navigationTiming;
                    this.sendEvent('performance_timing', navigationTiming);
                }, 0);
            });
        }

        // مراقبة الموارد
        if (performance.getEntriesByType) {
            setTimeout(() => {
                const resourceEntries = performance.getEntriesByType('resource');
                const slowResources = resourceEntries.filter(resource => resource.duration > 1000);
                
                if (slowResources.length > 0) {
                    this.sendEvent('slow_resources', {
                        count: slowResources.length,
                        resources: slowResources.map(r => ({
                            name: r.name,
                            duration: r.duration,
                            size: r.transferSize
                        }))
                    });
                }
            }, 2000);
        }

        // مراقبة الذاكرة
        if (performance.memory) {
            setInterval(() => {
                const memoryInfo = {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };

                this.performanceMetrics.memory = memoryInfo;

                // تحذير إذا تم استخدام أكثر من 80% من الذاكرة
                if (memoryInfo.used / memoryInfo.limit > 0.8) {
                    this.sendEvent('high_memory_usage', memoryInfo);
                }
            }, 30000);
        }
    }

    // تتبع مشاركة المستخدم
    trackUserEngagement() {
        let engagementScore = 0;
        let interactionCount = 0;
        const startTime = Date.now();

        const calculateEngagement = () => {
            const timeOnSite = Date.now() - startTime;
            const scrollDepth = Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            engagementScore = Math.min(100, 
                (timeOnSite / 60000) * 20 +  // Time score (20 points per minute)
                (scrollDepth / 100) * 30 +    // Scroll score (30 points for full scroll)
                Math.min(interactionCount * 10, 50)  // Interaction score (10 points per interaction, max 50)
            );

            return {
                score: Math.round(engagementScore),
                timeOnSite: Math.round(timeOnSite / 1000),
                scrollDepth,
                interactionCount
            };
        };

        // تتبع التفاعلات
        ['click', 'scroll', 'keypress', 'mousemove'].forEach(eventType => {
            let throttleTimeout;
            document.addEventListener(eventType, () => {
                if (!throttleTimeout) {
                    interactionCount++;
                    throttleTimeout = setTimeout(() => {
                        throttleTimeout = null;
                    }, 1000);
                }
            });
        });

        // إرسال نتيجة المشاركة كل دقيقة
        setInterval(() => {
            const engagement = calculateEngagement();
            this.sendEvent('user_engagement', engagement);
        }, 60000);

        // إرسال نتيجة نهائية عند ترك الصفحة
        window.addEventListener('beforeunload', () => {
            const finalEngagement = calculateEngagement();
            this.sendEvent('final_engagement', finalEngagement);
        });
    }

    // إرسال حدث
    sendEvent(eventType, data) {
        if (!this.isTracking) return;

        const event = {
            sessionId: this.sessionId,
            eventType,
            data,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.events.push(event);

        // إرسال فوري للأحداث المهمة
        const immediateEvents = ['error', 'form_submission', 'page_leave'];
        if (immediateEvents.includes(eventType)) {
            this.sendBatch([event]);
        }
    }

    // إعداد الإرسال المجمع
    setupBatchSending() {
        // إرسال دوري
        setInterval(() => {
            this.sendBatchedEvents();
        }, this.batchTimeout);

        // إرسال عند ترك الصفحة
        window.addEventListener('beforeunload', () => {
            this.sendBatchedEvents();
        });

        // إرسال عند امتلاء الدفعة
        const checkBatchSize = () => {
            if (this.events.length >= this.batchSize) {
                this.sendBatchedEvents();
            }
        };

        setInterval(checkBatchSize, 5000);
    }

    // إرسال الأحداث المجمعة
    sendBatchedEvents() {
        if (this.events.length === 0) return;

        const eventsToSend = [...this.events];
        this.events = [];

        this.sendBatch(eventsToSend);
    }

    // إرسال دفعة من الأحداث
    sendBatch(events) {
        const payload = {
            sessionId: this.sessionId,
            events,
            metadata: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                connection: this.getConnectionInfo(),
                performance: this.performanceMetrics
            }
        };

        // محاولة الإرسال للخادم
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics', JSON.stringify(payload));
        } else {
            fetch('/api/analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {
                // حفظ محلياً في حالة الفشل
                this.saveLocallyForRetry(events);
            });
        }

        // حفظ في LocalStorage كنسخة احتياطية
        this.saveAnalyticsBackup(payload);
    }

    // حفظ للإعادة المحاولة
    saveLocallyForRetry(events) {
        try {
            const stored = JSON.parse(localStorage.getItem('qiq_analytics_retry') || '[]');
            stored.push(...events);
            
            // الاحتفاظ بآخر 1000 حدث فقط
            if (stored.length > 1000) {
                stored.splice(0, stored.length - 1000);
            }
            
            localStorage.setItem('qiq_analytics_retry', JSON.stringify(stored));
        } catch (e) {
            console.warn('Could not save analytics for retry:', e);
        }
    }

    // حفظ نسخة احتياطية
    saveAnalyticsBackup(payload) {
        try {
            const backup = JSON.parse(localStorage.getItem('qiq_analytics_backup') || '[]');
            backup.push({
                timestamp: new Date().toISOString(),
                payload
            });
            
            // الاحتفاظ بآخر 50 دفعة فقط
            if (backup.length > 50) {
                backup.splice(0, backup.length - 50);
            }
            
            localStorage.setItem('qiq_analytics_backup', JSON.stringify(backup));
        } catch (e) {
            console.warn('Could not save analytics backup:', e);
        }
    }

    // معلومات الاتصال
    getConnectionInfo() {
        if ('connection' in navigator) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return null;
    }

    // الحصول على تقرير شامل
    getAnalyticsReport() {
        return {
            sessionId: this.sessionId,
            pageViews: this.pageViews.length,
            userInteractions: this.userInteractions.length,
            events: this.events.length,
            performanceMetrics: this.performanceMetrics,
            sessionDuration: Date.now() - (this.pageViews[0]?.timestamp ? new Date(this.pageViews[0].timestamp).getTime() : Date.now()),
            topInteractions: this.getTopInteractions(),
            errorCount: this.events.filter(e => e.eventType === 'error').length
        };
    }

    // أهم التفاعلات
    getTopInteractions() {
        const interactions = {};
        this.userInteractions.forEach(interaction => {
            const key = `${interaction.elementType}-${interaction.buttonType || 'other'}`;
            interactions[key] = (interactions[key] || 0) + 1;
        });

        return Object.entries(interactions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({ type, count }));
    }

    // تمكين/تعطيل التتبع
    setTracking(enabled) {
        this.isTracking = enabled;
        console.log(`Analytics tracking ${enabled ? 'enabled' : 'disabled'}`);
    }

    // مسح البيانات
    clearData() {
        this.events = [];
        this.pageViews = [];
        this.userInteractions = [];
        localStorage.removeItem('qiq_analytics_retry');
        localStorage.removeItem('qiq_analytics_backup');
        console.log('Analytics data cleared');
    }
}

// تصدير للاستخدام العام
window.AdvancedAnalytics = AdvancedAnalytics;

// تهيئة تلقائية مع احترام خصوصية المستخدم
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من موافقة المستخدم (يمكن تخصيصه حسب الحاجة)
    const hasConsent = localStorage.getItem('qiq_analytics_consent') !== 'false';
    
    if (hasConsent) {
        window.analytics = new AdvancedAnalytics();
        
        // عرض تقرير في Console للمطورين
        setTimeout(() => {
            console.log('📈 Analytics Report:', window.analytics.getAnalyticsReport());
        }, 5000);
    }
});