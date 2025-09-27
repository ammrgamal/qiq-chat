/**
 * System Initializer & Integration Manager
 * منسق النظام ومدير التكامل
 */

class SystemInitializer {
    constructor() {
        this.systems = new Map();
        this.initializationOrder = [];
        this.isInitialized = false;
        this.dependencies = new Map();
        this.status = 'pending';
        this.init();
    }

    // تهيئة النظام
    async init() {
        console.log('🚀 System Initializer starting...');
        
        this.defineInitializationOrder();
        this.setupGlobalErrorHandling();
        
        try {
            await this.initializeSystems();
            await this.integrateSystemsData();
            await this.validateSystemsHealth();
            
            this.status = 'ready';
            this.isInitialized = true;
            
            this.broadcastSystemReady();
            console.log('✅ All systems initialized successfully');
            
        } catch (error) {
            this.status = 'error';
            console.error('❌ System initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    // تعريف ترتيب التهيئة
    defineInitializationOrder() {
        this.initializationOrder = [
            'stateManager',
            'errorHandler', 
            'formValidator',
            'enhancedUI',
            'analytics',
            'chatSystem',
            'searchSystem'
        ];

        // تعريف التبعيات
        this.dependencies.set('enhancedUI', ['stateManager']);
        this.dependencies.set('analytics', ['stateManager', 'errorHandler']);
        this.dependencies.set('chatSystem', ['stateManager', 'formValidator']);
        this.dependencies.set('searchSystem', ['stateManager']);
    }

    // تهيئة الأنظمة بالترتيب
    async initializeSystems() {
        for (const systemName of this.initializationOrder) {
            try {
                await this.initializeSystem(systemName);
                console.log(`✓ ${systemName} initialized`);
            } catch (error) {
                console.error(`✗ Failed to initialize ${systemName}:`, error);
                // استمرار التهيئة حتى لو فشل نظام واحد
            }
        }
    }

    // تهيئة نظام واحد
    async initializeSystem(systemName) {
        // التحقق من التبعيات
        const dependencies = this.dependencies.get(systemName) || [];
        for (const dep of dependencies) {
            if (!this.systems.has(dep)) {
                throw new Error(`Missing dependency: ${dep} for ${systemName}`);
            }
        }

        let system = null;

        switch (systemName) {
            case 'stateManager':
                system = window.stateManager || new AdvancedStateManager();
                break;
                
            case 'errorHandler':
                system = window.errorHandler || new ErrorHandlerAndOptimizer();
                break;
                
            case 'formValidator':
                system = window.formValidator || new AdvancedFormValidator();
                break;
                
            case 'enhancedUI':
                system = window.enhancedUI || new EnhancedUIComponents();
                break;
                
            case 'analytics':
                system = window.analytics || new AdvancedAnalytics();
                break;
                
            case 'chatSystem':
                system = this.initializeChatSystem();
                break;
                
            case 'searchSystem':
                system = this.initializeSearchSystem();
                break;
        }

        if (system) {
            this.systems.set(systemName, system);
            window[systemName] = system; // إتاحة عالمية
        }
    }

    // تهيئة نظام الدردشة
    initializeChatSystem() {
        const chatSystem = {
            stateManager: this.getSystem('stateManager'),
            antiRepetition: window.antiRepetitionSystem,
            smartBoq: window.smartBoqRecommender,
            chatStateManager: window.chatStateManager,
            
            initialize: () => {
                // ربط الأنظمة معاً
                if (window.chatStateManager && window.antiRepetitionSystem) {
                    window.chatStateManager.setAntiRepetitionSystem(window.antiRepetitionSystem);
                }
                
                // إعداد state للدردشة
                this.getSystem('stateManager').setState('chat', {
                    isActive: false,
                    messages: [],
                    currentContext: null,
                    repetitionCount: 0
                }, { persist: true });
                
                console.log('Chat system integrated');
            }
        };
        
        chatSystem.initialize();
        return chatSystem;
    }

    // تهيئة نظام البحث
    initializeSearchSystem() {
        const searchSystem = {
            stateManager: this.getSystem('stateManager'),
            
            initialize: () => {
                // إعداد state للبحث
                this.getSystem('stateManager').setState('search', {
                    query: '',
                    results: [],
                    filters: {},
                    isLoading: false,
                    totalResults: 0
                }, { persist: false });
                
                // ربط أحداث البحث
                this.bindSearchEvents();
                console.log('Search system integrated');
            },
            
            performSearch: async (query, filters = {}) => {
                const state = this.getSystem('stateManager');
                state.setState('search', {
                    ...state.getState('search'),
                    isLoading: true,
                    query
                });
                
                try {
                    // استدعاء دالة البحث الموجودة
                    if (window.performSearch) {
                        const results = await window.performSearch(query, filters);
                        
                        state.setState('search', {
                            ...state.getState('search'),
                            results,
                            isLoading: false,
                            totalResults: results?.length || 0
                        });
                        
                        return results;
                    }
                } catch (error) {
                    state.setState('search', {
                        ...state.getState('search'),
                        isLoading: false,
                        error: error.message
                    });
                    
                    throw error;
                }
            }
        };
        
        searchSystem.initialize();
        return searchSystem;
    }

    // ربط أحداث البحث
    bindSearchEvents() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchSystem = this.getSystem('searchSystem');
                    if (searchSystem && e.target.value.trim()) {
                        searchSystem.performSearch(e.target.value.trim());
                    }
                }, 300);
            });
        }
    }

    // تكامل بيانات الأنظمة
    async integrateSystemsData() {
        const stateManager = this.getSystem('stateManager');
        
        if (stateManager) {
            // مشاركة البيانات بين الأنظمة
            stateManager.subscribe('search.query', (query) => {
                const analytics = this.getSystem('analytics');
                if (analytics) {
                    analytics.sendEvent('search_query', { query });
                }
            });
            
            stateManager.subscribe('chat.messages', (messages) => {
                const analytics = this.getSystem('analytics');
                if (analytics && messages?.length) {
                    analytics.sendEvent('chat_interaction', { messageCount: messages.length });
                }
            });
            
            // مراقبة الأخطاء
            const errorHandler = this.getSystem('errorHandler');
            if (errorHandler) {
                stateManager.subscribe('*', (newState, oldState) => {
                    if (newState?.error) {
                        errorHandler.logError('State Error', newState.error);
                    }
                });
            }
        }
    }

    // التحقق من صحة الأنظمة
    async validateSystemsHealth() {
        const healthChecks = [];
        
        for (const [name, system] of this.systems.entries()) {
            healthChecks.push(this.checkSystemHealth(name, system));
        }
        
        const results = await Promise.allSettled(healthChecks);
        const healthReport = {};
        
        results.forEach((result, index) => {
            const systemName = this.initializationOrder[index];
            healthReport[systemName] = result.status === 'fulfilled' ? result.value : false;
        });
        
        console.log('🏥 System Health Report:', healthReport);
        
        // حفظ في state manager
        const stateManager = this.getSystem('stateManager');
        if (stateManager) {
            stateManager.setState('systemHealth', healthReport);
        }
    }

    // فحص صحة نظام واحد
    async checkSystemHealth(name, system) {
        try {
            switch (name) {
                case 'stateManager':
                    return system && typeof system.getState === 'function';
                    
                case 'errorHandler':
                    return system && typeof system.logError === 'function';
                    
                case 'formValidator':
                    return system && typeof system.validateForm === 'function';
                    
                case 'enhancedUI':
                    return system && typeof system.init === 'function';
                    
                case 'analytics':
                    return system && typeof system.sendEvent === 'function';
                    
                case 'chatSystem':
                    return system && system.stateManager;
                    
                case 'searchSystem':
                    return system && typeof system.performSearch === 'function';
                    
                default:
                    return !!system;
            }
        } catch (error) {
            console.warn(`Health check failed for ${name}:`, error);
            return false;
        }
    }

    // إعداد معالجة الأخطاء العامة
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            const errorHandler = this.getSystem('errorHandler');
            if (errorHandler) {
                errorHandler.logError('Global Error', event.error);
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            const errorHandler = this.getSystem('errorHandler');
            if (errorHandler) {
                errorHandler.logError('Unhandled Promise Rejection', event.reason);
            }
        });
    }

    // معالجة أخطاء التهيئة
    handleInitializationError(error) {
        // عرض رسالة للمستخدم
        this.showSystemErrorMessage();
        
        // محاولة إعادة التهيئة
        setTimeout(() => {
            this.attemptRecovery();
        }, 5000);
    }

    // عرض رسالة خطأ النظام
    showSystemErrorMessage() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'system-error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
        `;
        
        errorDiv.innerHTML = `
            <strong>تحذير النظام</strong><br>
            حدث خطأ في تهيئة بعض المكونات. يتم المحاولة مرة أخرى...
            <button onclick="this.parentNode.remove()" style="float:left; background:none; border:none; color:#c33; cursor:pointer;">×</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // إزالة تلقائية بعد 10 ثوانٍ
        setTimeout(() => {
            if (document.getElementById('system-error-message')) {
                errorDiv.remove();
            }
        }, 10000);
    }

    // محاولة الاستعادة
    attemptRecovery() {
        console.log('🔄 Attempting system recovery...');
        
        // إعادة تهيئة الأنظمة الأساسية فقط
        const essentialSystems = ['stateManager', 'errorHandler'];
        
        essentialSystems.forEach(async (systemName) => {
            if (!this.systems.has(systemName)) {
                try {
                    await this.initializeSystem(systemName);
                    console.log(`✓ Recovered ${systemName}`);
                } catch (error) {
                    console.error(`✗ Failed to recover ${systemName}:`, error);
                }
            }
        });
    }

    // بث إشارة جاهزية النظام
    broadcastSystemReady() {
        // إنشاء حدث مخصص
        const systemReadyEvent = new CustomEvent('systemReady', {
            detail: {
                systems: Array.from(this.systems.keys()),
                timestamp: Date.now(),
                version: '1.0.0'
            }
        });
        
        document.dispatchEvent(systemReadyEvent);
        
        // تعيين متغير عام
        window.isSystemReady = true;
        
        // إشعار في state manager
        const stateManager = this.getSystem('stateManager');
        if (stateManager) {
            stateManager.setState('system', {
                status: 'ready',
                initializedAt: new Date().toISOString(),
                systems: Array.from(this.systems.keys())
            });
        }
    }

    // الحصول على نظام
    getSystem(name) {
        return this.systems.get(name);
    }

    // التحقق من جاهزية النظام
    isSystemReady() {
        return this.isInitialized && this.status === 'ready';
    }

    // إعادة تشغيل النظام
    async restart() {
        console.log('🔄 Restarting system...');
        
        this.systems.clear();
        this.isInitialized = false;
        this.status = 'restarting';
        
        await this.init();
    }

    // إحصائيات النظام
    getSystemStats() {
        return {
            status: this.status,
            initialized: this.isInitialized,
            systemCount: this.systems.size,
            systems: Array.from(this.systems.keys()),
            uptime: this.isInitialized ? Date.now() - this.initTime : 0
        };
    }

    // تصدير حالة النظام للتشخيص
    exportSystemState() {
        const systemState = {};
        
        this.systems.forEach((system, name) => {
            try {
                if (name === 'stateManager') {
                    systemState[name] = system.exportState();
                } else if (system.getStatus) {
                    systemState[name] = system.getStatus();
                } else {
                    systemState[name] = 'initialized';
                }
            } catch (error) {
                systemState[name] = `error: ${error.message}`;
            }
        });
        
        return {
            meta: this.getSystemStats(),
            systems: systemState,
            exportedAt: new Date().toISOString()
        };
    }
}

// تصدير للاستخدام العام
window.SystemInitializer = SystemInitializer;

// تهيئة تلقائية
document.addEventListener('DOMContentLoaded', async function() {
    try {
        window.systemInitializer = new SystemInitializer();
        
        // تسجيل مستمع لحدث جاهزية النظام
        document.addEventListener('systemReady', (event) => {
            console.log('🎉 System is ready!', event.detail);
            
            // يمكن إضافة أي منطق إضافي هنا عند جاهزية النظام
            if (window.onSystemReady) {
                window.onSystemReady(event.detail);
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize SystemInitializer:', error);
    }
});