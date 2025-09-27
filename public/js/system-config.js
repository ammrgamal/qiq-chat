/**
 * System Configuration
 * إعدادات النظام الشاملة
 */

const SystemConfig = {
    // إعدادات عامة
    version: '2.0.0',
    environment: 'production', // development, staging, production
    debug: false,
    
    // إعدادات واجهة المستخدم
    ui: {
        theme: {
            default: 'light', // light, dark, auto
            allowToggle: true,
            persistUserChoice: true
        },
        
        animations: {
            enabled: true,
            duration: 300, // milliseconds
            easing: 'ease-in-out'
        },
        
        modal: {
            backdrop: true,
            keyboard: true,
            focus: true,
            autoFocus: true
        },
        
        comparison: {
            maxItems: 6,
            showDifferencesOnly: false,
            highlightDifferences: true
        },
        
        loading: {
            showSkeletons: true,
            minDisplayTime: 500, // minimum time to show loading
            timeout: 30000 // maximum loading time
        }
    },
    
    // إعدادات إدارة الحالة
    stateManager: {
        maxHistory: 50,
        autosaveInterval: 30000, // 30 seconds
        
        cache: {
            defaultExpiration: 300000, // 5 minutes
            maxSize: 100, // maximum number of cached items
            cleanupInterval: 60000 // 1 minute
        },
        
        persistence: {
            storageKey: 'qiq_state',
            compress: true,
            encrypt: false // يمكن تفعيله للبيانات الحساسة
        }
    },
    
    // إعدادات معالجة الأخطاء
    errorHandler: {
        logLevel: 'error', // debug, info, warn, error
        reportToServer: true,
        
        retryAttempts: {
            network: 3,
            script: 2,
            image: 1
        },
        
        fallbacks: {
            enableImageFallback: true,
            enableScriptFallback: true,
            enableStyleFallback: true
        },
        
        performance: {
            monitorMemory: true,
            memoryThreshold: 0.8, // 80% of available memory
            monitorNetworkTiming: true
        }
    },
    
    // إعدادات التحقق من النماذج
    formValidator: {
        validateOnInput: true,
        validateOnBlur: true,
        
        errorMessages: {
            language: 'ar',
            showIcons: true,
            position: 'below' // below, above, inline
        },
        
        formatting: {
            phone: {
                enabled: true,
                format: '####-###-###'
            },
            
            numbers: {
                thousandsSeparator: ',',
                decimalSeparator: '.'
            }
        },
        
        accessibility: {
            announceErrors: true,
            focusOnError: true
        }
    },
    
    // إعدادات التحليلات
    analytics: {
        enabled: true,
        consent: {
            required: true,
            storageKey: 'qiq_analytics_consent',
            expiryDays: 365
        },
        
        tracking: {
            pageViews: true,
            clicks: true,
            formSubmissions: true,
            scrollDepth: true,
            timeOnPage: true,
            userEngagement: true,
            errors: true,
            performance: true
        },
        
        batch: {
            size: 10,
            timeout: 30000, // 30 seconds
            useBeacon: true // use navigator.sendBeacon when available
        },
        
        endpoints: {
            events: '/api/analytics',
            errors: '/api/errors'
        },
        
        privacy: {
            anonymizeIP: true,
            respectDoNotTrack: true,
            localStorageLimit: 1000 // maximum events to store locally
        }
    },
    
    // إعدادات البحث
    search: {
        minQueryLength: 2,
        debounceDelay: 300, // milliseconds
        maxResults: 50,
        
        autocomplete: {
            enabled: true,
            minQueryLength: 3,
            maxSuggestions: 8
        },
        
        filters: {
            persistent: true,
            defaultFilters: {}
        },
        
        cache: {
            enabled: true,
            expiration: 600000, // 10 minutes
            maxQueries: 100
        }
    },
    
    // إعدادات الدردشة
    chat: {
        maxMessages: 100,
        typingIndicatorTimeout: 3000,
        
        antiRepetition: {
            enabled: true,
            similarityThreshold: 0.8,
            maxSimilarResponses: 2,
            contextSwitchThreshold: 3
        },
        
        smartBOQ: {
            enabled: true,
            maxRecommendations: 5,
            confidenceThreshold: 0.6
        },
        
        persistence: {
            saveHistory: true,
            maxHistoryDays: 30
        }
    },
    
    // إعدادات الأمان
    security: {
        csrf: {
            enabled: true,
            tokenName: '_csrf_token'
        },
        
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 900000 // 15 minutes
        },
        
        sanitization: {
            enabled: true,
            allowedTags: ['b', 'i', 'u', 'strong', 'em'],
            maxLength: 10000
        }
    },
    
    // إعدادات الأداء
    performance: {
        lazyLoading: {
            enabled: true,
            threshold: '10px',
            images: true,
            components: true
        },
        
        preloading: {
            enabled: true,
            criticalResources: [
                '/css/styles.css',
                '/js/system-initializer.js'
            ]
        },
        
        compression: {
            enabled: true,
            level: 6 // gzip compression level
        },
        
        caching: {
            staticAssets: 86400, // 24 hours
            apiResponses: 300, // 5 minutes
            userPreferences: 2592000 // 30 days
        }
    },
    
    // إعدادات التحديثات
    updates: {
        checkInterval: 3600000, // 1 hour
        autoUpdate: false,
        notifyUser: true,
        
        channels: {
            stable: true,
            beta: false,
            alpha: false
        }
    },
    
    // إعدادات إمكانية الوصول
    accessibility: {
        enabled: true,
        
        keyboard: {
            navigation: true,
            shortcuts: true,
            trapFocus: true
        },
        
        screenReader: {
            announcements: true,
            liveRegions: true,
            landmarks: true
        },
        
        visual: {
            highContrast: false,
            reducedMotion: 'respect-user-preference',
            fontSize: 'medium' // small, medium, large
        }
    },
    
    // إعدادات التطوير
    development: {
        logging: {
            level: 'debug',
            console: true,
            file: false
        },
        
        debugging: {
            showPerformanceMetrics: true,
            showStateChanges: true,
            showNetworkRequests: true
        },
        
        hotReload: {
            enabled: false,
            watchFiles: [
                '*.js',
                '*.css',
                '*.html'
            ]
        }
    },
    
    // إعدادات الاختبار
    testing: {
        enabled: false,
        
        mockData: {
            users: true,
            products: true,
            analytics: false
        },
        
        automation: {
            selectors: {
                useDataTestIds: true,
                prefix: 'test-'
            }
        }
    },
    
    // إعدادات التكامل
    integrations: {
        algolia: {
            enabled: true,
            indexName: 'products',
            facets: ['category', 'brand', 'price_range']
        },
        
        email: {
            enabled: true,
            provider: 'smtp',
            templates: {
                quote: 'quote_request',
                welcome: 'user_welcome'
            }
        },
        
        crm: {
            enabled: false,
            provider: 'hubspot',
            syncInterval: 3600000 // 1 hour
        }
    }
};

// دوال الإعدادات المساعدة
const ConfigHelpers = {
    // الحصول على إعداد بمسار متداخل
    get: (path, defaultValue = null) => {
        const keys = path.split('.');
        let current = SystemConfig;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    },
    
    // تعيين إعداد
    set: (path, value) => {
        const keys = path.split('.');
        let current = SystemConfig;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    },
    
    // دمج إعدادات جديدة
    merge: (newConfig) => {
        return deepMerge(SystemConfig, newConfig);
    },
    
    // التحقق من البيئة
    isProduction: () => SystemConfig.environment === 'production',
    isDevelopment: () => SystemConfig.environment === 'development',
    isDebug: () => SystemConfig.debug || SystemConfig.environment === 'development',
    
    // الحصول على إعدادات البيئة
    getEnvironmentConfig: () => {
        const env = SystemConfig.environment;
        
        if (env === 'development') {
            return {
                debug: true,
                'analytics.enabled': false,
                'errorHandler.reportToServer': false,
                'development.logging.level': 'debug'
            };
        } else if (env === 'staging') {
            return {
                debug: false,
                'analytics.enabled': true,
                'errorHandler.reportToServer': true,
                'development.logging.level': 'warn'
            };
        } else {
            return {
                debug: false,
                'analytics.enabled': true,
                'errorHandler.reportToServer': true,
                'development.logging.level': 'error'
            };
        }
    },
    
    // تحميل إعدادات من التخزين المحلي
    loadUserPreferences: () => {
        try {
            const saved = localStorage.getItem('qiq_user_preferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // تطبيق التفضيلات الآمنة فقط
                const allowedPreferences = [
                    'ui.theme.default',
                    'ui.animations.enabled',
                    'accessibility.visual.fontSize',
                    'accessibility.visual.highContrast'
                ];
                
                allowedPreferences.forEach(pref => {
                    if (preferences[pref] !== undefined) {
                        ConfigHelpers.set(pref, preferences[pref]);
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load user preferences:', error);
        }
    },
    
    // حفظ تفضيلات المستخدم
    saveUserPreferences: () => {
        try {
            const preferences = {
                'ui.theme.default': ConfigHelpers.get('ui.theme.default'),
                'ui.animations.enabled': ConfigHelpers.get('ui.animations.enabled'),
                'accessibility.visual.fontSize': ConfigHelpers.get('accessibility.visual.fontSize'),
                'accessibility.visual.highContrast': ConfigHelpers.get('accessibility.visual.highContrast')
            };
            
            localStorage.setItem('qiq_user_preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Failed to save user preferences:', error);
        }
    }
};

// دالة دمج عميق
function deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            output[key] = source[key];
        }
    }
    
    return output;
}

// تصدير الإعدادات
window.SystemConfig = SystemConfig;
window.ConfigHelpers = ConfigHelpers;

// تحميل الإعدادات عند التهيئة
document.addEventListener('DOMContentLoaded', () => {
    // تطبيق إعدادات البيئة
    const envConfig = ConfigHelpers.getEnvironmentConfig();
    Object.keys(envConfig).forEach(key => {
        ConfigHelpers.set(key, envConfig[key]);
    });
    
    // تحميل تفضيلات المستخدم
    ConfigHelpers.loadUserPreferences();
    
    console.log('⚙️ System configuration loaded for environment:', SystemConfig.environment);
});

// حفظ الإعدادات عند الإغلاق
window.addEventListener('beforeunload', () => {
    ConfigHelpers.saveUserPreferences();
});