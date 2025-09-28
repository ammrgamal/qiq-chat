/**
 * System Final Check & Launch Script
 * فحص نهائي ونص تشغيل النظام
 */

(function() {
    'use strict';
    
    let systemLaunched = false;
    const launchTimeout = 10000; // 10 seconds timeout
    
    // فحص النظام النهائي
    function performFinalSystemCheck() {
        console.log('🔍 Starting final system check...');
        
        const checks = {
            config: checkSystemConfig(),
            dependencies: checkCoreDependencies(),
            storage: checkStorageAvailability(),
            network: checkNetworkStatus(),
            browser: checkBrowserCompatibility(),
            ui: checkUIComponents(),
            functionality: checkCoreFunctionality()
        };
        
        const passed = Object.values(checks).every(check => check.status);
        
        if (passed) {
            console.log('✅ All system checks passed');
            launchSystem();
        } else {
            console.error('❌ System check failed:', checks);
            handleSystemFailure(checks);
        }
        
        return checks;
    }
    
    // فحص إعدادات النظام
    function checkSystemConfig() {
        try {
            if (!window.SystemConfig) {
                return { status: false, error: 'SystemConfig not loaded' };
            }
            
            if (!window.ConfigHelpers) {
                return { status: false, error: 'ConfigHelpers not loaded' };
            }
            
            // فحص الإعدادات الأساسية
            const requiredConfigs = [
                'version',
                'environment',
                'ui',
                'stateManager',
                'errorHandler',
                'analytics'
            ];
            
            for (const config of requiredConfigs) {
                if (!window.SystemConfig[config]) {
                    return { status: false, error: `Missing config: ${config}` };
                }
            }
            
            return { status: true };
        } catch (error) {
            return { status: false, error: error.message };
        }
    }
    
    // فحص التبعيات الأساسية
    function checkCoreDependencies() {
        const requiredClasses = [
            'AdvancedStateManager',
            'ErrorHandlerAndOptimizer', 
            'AdvancedFormValidator',
            'AdvancedAnalytics',
            'SystemInitializer'
        ];
        
        const missing = [];
        
        for (const className of requiredClasses) {
            if (!window[className]) {
                missing.push(className);
            }
        }
        
        if (missing.length > 0) {
            return { 
                status: false, 
                error: `Missing classes: ${missing.join(', ')}` 
            };
        }
        
        return { status: true };
    }
    
    // فحص توفر التخزين
    function checkStorageAvailability() {
        try {
            // فحص localStorage
            const testKey = 'qiq_storage_test';
            localStorage.setItem(testKey, 'test');
            localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            // فحص sessionStorage
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.getItem(testKey);
            sessionStorage.removeItem(testKey);
            
            return { status: true };
        } catch (error) {
            return { 
                status: false, 
                error: 'Storage not available: ' + error.message 
            };
        }
    }
    
    // فحص حالة الشبكة
    function checkNetworkStatus() {
        if ('onLine' in navigator) {
            if (!navigator.onLine) {
                return { 
                    status: true, // لا يُعتبر فشلاً، لكن نحتاج للوضع دون اتصال
                    warning: 'Device is offline',
                    offline: true 
                };
            }
        }
        
        return { status: true, offline: false };
    }
    
    // فحص توافق المتصفح
    function checkBrowserCompatibility() {
        const features = [
            'Promise',
            'fetch',
            'localStorage',
            'sessionStorage',
            'CustomEvent',
            'Proxy'
        ];
        
        const unsupported = [];
        
        for (const feature of features) {
            if (!(feature in window)) {
                unsupported.push(feature);
            }
        }
        
        // فحص إضافي لـ ES6 features
        try {
            eval('const test = () => {};');
            eval('const {a} = {};');
            eval('const [...rest] = [];');
        } catch (error) {
            unsupported.push('ES6 syntax');
        }
        
        if (unsupported.length > 0) {
            return { 
                status: false, 
                error: `Unsupported features: ${unsupported.join(', ')}` 
            };
        }
        
        return { status: true };
    }
    
    // فحص مكونات واجهة المستخدم
    function checkUIComponents() {
        const requiredElements = [
            'body',
            'head'
        ];
        
        const missing = [];
        
        for (const selector of requiredElements) {
            if (!document.querySelector(selector)) {
                missing.push(selector);
            }
        }
        
        if (missing.length > 0) {
            return { 
                status: false, 
                error: `Missing UI elements: ${missing.join(', ')}` 
            };
        }
        
        return { status: true };
    }
    
    // فحص الوظائف الأساسية
    function checkCoreFunctionality() {
        try {
            // فحص قدرة إنشاء العناصر
            const testDiv = document.createElement('div');
            testDiv.innerHTML = '<span>Test</span>';
            
            // فحص قدرة معالجة الأحداث
            const testEvent = new CustomEvent('test');
            
            // فحص JSON
            JSON.stringify({test: 'data'});
            JSON.parse('{"test": "data"}');
            
            // فحص Date
            new Date().toISOString();
            
            // فحص Math
            Math.random();
            
            return { status: true };
        } catch (error) {
            return { 
                status: false, 
                error: 'Core functionality failed: ' + error.message 
            };
        }
    }
    
    // تشغيل النظام
    function launchSystem() {
        if (systemLaunched) return;
        
        console.log('🚀 Launching QuickITQuote Enhanced System...');
        systemLaunched = true;
        
        try {
            // إنشاء إشارة البدء
            const launchEvent = new CustomEvent('systemLaunching', {
                detail: {
                    timestamp: new Date().toISOString(),
                    version: window.SystemConfig?.version || 'unknown'
                }
            });
            
            document.dispatchEvent(launchEvent);
            
            // إضافة معلومات النظام للعنصر الجذر
            document.documentElement.setAttribute('data-qiq-version', window.SystemConfig?.version || '2.0.0');
            document.documentElement.setAttribute('data-qiq-environment', window.SystemConfig?.environment || 'production');
            
            // إضافة CSS classes للحالة
            document.body.classList.add('qiq-system-ready');
            
            if (window.ConfigHelpers?.isDebug()) {
                document.body.classList.add('qiq-debug-mode');
            }
            
            // إعداد معلومات الشاشة العالمية
            setupGlobalScreenInfo();
            
            // إعداد مراقبة الأداء العامة
            setupGlobalPerformanceMonitoring();
            
            // إعداد معالجة الأخطاء العامة النهائية
            setupFinalErrorHandling();
            
            console.log('✅ System launched successfully');
            
        } catch (error) {
            console.error('❌ System launch failed:', error);
            handleSystemFailure({ launch: { status: false, error: error.message } });
        }
    }
    
    // إعداد معلومات الشاشة
    function setupGlobalScreenInfo() {
        window.qiqScreenInfo = {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            isMobile: window.innerWidth <= 768,
            isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
            isDesktop: window.innerWidth > 1024,
            orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
        };
        
        // تحديث عند تغيير الحجم
        window.addEventListener('resize', () => {
            window.qiqScreenInfo.width = window.innerWidth;
            window.qiqScreenInfo.height = window.innerHeight;
            window.qiqScreenInfo.isMobile = window.innerWidth <= 768;
            window.qiqScreenInfo.isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
            window.qiqScreenInfo.isDesktop = window.innerWidth > 1024;
            window.qiqScreenInfo.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        });
    }
    
    // إعداد مراقبة الأداء العامة
    function setupGlobalPerformanceMonitoring() {
        // مراقبة FPS (إذا كان متاحاً)
        if ('requestAnimationFrame' in window) {
            let lastTime = performance.now();
            let frameCount = 0;
            let avgFPS = 0;
            
            function measureFPS() {
                frameCount++;
                const currentTime = performance.now();
                const delta = currentTime - lastTime;
                
                if (delta >= 1000) { // كل ثانية
                    avgFPS = Math.round(frameCount * 1000 / delta);
                    frameCount = 0;
                    lastTime = currentTime;
                    
                    window.qiqPerformance = window.qiqPerformance || {};
                    window.qiqPerformance.fps = avgFPS;
                    
                    // تحذير إذا انخفض FPS كثيراً
                    if (avgFPS < 30) {
                        console.warn('⚠️ Low FPS detected:', avgFPS);
                    }
                }
                
                requestAnimationFrame(measureFPS);
            }
            
            requestAnimationFrame(measureFPS);
        }
    }
    
    // إعداد معالجة الأخطاء النهائية
    function setupFinalErrorHandling() {
        // معالج أخطاء أخير كاحتياط
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('🚨 Unhandled Error:', {
                message, source, lineno, colno, error
            });
            
            // محاولة إرسال للتحليلات إن أمكن
            if (window.analytics && typeof window.analytics.sendEvent === 'function') {
                window.analytics.sendEvent('system_error', {
                    message, source, lineno, colno,
                    stack: error?.stack,
                    timestamp: new Date().toISOString()
                });
            }
            
            return false; // إظهار الخطأ في console
        };
        
        // معالج Promise rejections النهائي
        window.onunhandledrejection = function(event) {
            console.error('🚨 Unhandled Promise Rejection:', event.reason);
            
            if (window.analytics && typeof window.analytics.sendEvent === 'function') {
                window.analytics.sendEvent('promise_rejection', {
                    reason: event.reason?.toString(),
                    stack: event.reason?.stack,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }
    
    // معالجة فشل النظام
    function handleSystemFailure(checks) {
        console.error('🚨 System initialization failed. Checks:', checks);
        
        // عرض رسالة للمستخدم
        showSystemFailureMessage(checks);
        
        // محاولة إعادة التحميل بعد 10 ثوانٍ
        setTimeout(() => {
            if (confirm('يبدو أن هناك مشكلة في تحميل النظام. هل تريد إعادة تحميل الصفحة؟')) {
                window.location.reload();
            }
        }, 10000);
    }
    
    // عرض رسالة فشل النظام
    function showSystemFailureMessage(checks) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'system-failure-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        `;
        
        const failedChecks = Object.entries(checks)
            .filter(([key, check]) => !check.status)
            .map(([key, check]) => `${key}: ${check.error}`)
            .join('<br>');
        
        errorDiv.innerHTML = `
            <div style="max-width: 500px;">
                <h2 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ خطأ في النظام</h2>
                <p style="margin-bottom: 20px;">
                    عذراً، حدث خطأ أثناء تحميل النظام. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.
                </p>
                ${window.ConfigHelpers?.isDebug() ? 
                    `<details style="text-align: left; margin: 20px 0;">
                        <summary>تفاصيل الخطأ (للمطورين)</summary>
                        <pre style="background: #1a1a1a; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px;">${failedChecks}</pre>
                    </details>` : ''
                }
                <button onclick="window.location.reload()" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    إعادة تحميل الصفحة
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    // تحديد متى نبدأ الفحص
    function scheduleSystemCheck() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performFinalSystemCheck);
        } else {
            // تأخير قصير للتأكد من تحميل جميع الـ scripts
            setTimeout(performFinalSystemCheck, 100);
        }
        
        // timeout احتياطي
        setTimeout(() => {
            if (!systemLaunched) {
                console.warn('⚠️ System launch timeout reached');
                handleSystemFailure({
                    timeout: { 
                        status: false, 
                        error: 'System launch timeout after ' + launchTimeout + 'ms' 
                    }
                });
            }
        }, launchTimeout);
    }
    
    // بدء العملية
    scheduleSystemCheck();
    
    // إتاحة الدوال للاستخدام العام (للتشخيص)
    window.qiqSystemCheck = {
        performCheck: performFinalSystemCheck,
        isLaunched: () => systemLaunched,
        relaunch: () => {
            systemLaunched = false;
            performFinalSystemCheck();
        }
    };
    
})();