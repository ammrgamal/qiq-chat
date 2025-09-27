/**
 * Advanced State Manager
 * نظام إدارة الحالة المتقدم
 */

class AdvancedStateManager {
    constructor() {
        this.state = {};
        this.listeners = new Map();
        this.middleware = [];
        this.history = [];
        this.maxHistory = 50;
        this.cache = new Map();
        this.cacheExpiration = new Map();
        this.persistentKeys = new Set();
        this.init();
    }

    // تهيئة النظام
    init() {
        this.loadPersistentState();
        this.setupStateProxy();
        this.setupAutoSave();
        this.setupCacheCleanup();
        console.log('🗃️ Advanced State Manager initialized');
    }

    // تحميل الحالة المحفوظة
    loadPersistentState() {
        try {
            const saved = localStorage.getItem('qiq_state');
            if (saved) {
                const parsedState = JSON.parse(saved);
                Object.keys(parsedState).forEach(key => {
                    this.state[key] = parsedState[key];
                    this.persistentKeys.add(key);
                });
            }
        } catch (error) {
            console.warn('Failed to load persistent state:', error);
        }
    }

    // إعداد Proxy للحالة (للتحديث التلقائي)
    setupStateProxy() {
        this.state = new Proxy(this.state, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;
                
                // إضافة للتاريخ
                this.addToHistory(property, oldValue, value);
                
                // إشعار المستمعين
                this.notifyListeners(property, value, oldValue);
                
                // حفظ إذا كان مطلوباً
                if (this.persistentKeys.has(property)) {
                    this.savePersistentState();
                }
                
                return true;
            }
        });
    }

    // تعيين قيمة في الحالة
    setState(key, value, options = {}) {
        const { 
            persist = false, 
            silent = false, 
            merge = false,
            validate = null 
        } = options;

        // التحقق من الصحة
        if (validate && !validate(value)) {
            console.warn(`Validation failed for state key: ${key}`);
            return false;
        }

        // دمج البيانات إذا طُلب
        if (merge && typeof this.state[key] === 'object' && typeof value === 'object') {
            value = { ...this.state[key], ...value };
        }

        // تعيين الحفظ الدائم
        if (persist) {
            this.persistentKeys.add(key);
        }

        // تعيين القيمة
        if (silent) {
            this.state[key] = value;
        } else {
            this.state[key] = value; // سيتم تشغيل Proxy
        }

        return true;
    }

    // الحصول على قيمة من الحالة
    getState(key, defaultValue = null) {
        return key in this.state ? this.state[key] : defaultValue;
    }

    // حذف مفتاح من الحالة
    deleteState(key) {
        if (key in this.state) {
            const oldValue = this.state[key];
            delete this.state[key];
            this.persistentKeys.delete(key);
            this.notifyListeners(key, undefined, oldValue);
            this.savePersistentState();
        }
    }

    // مسح الحالة
    clearState() {
        const keys = Object.keys(this.state);
        keys.forEach(key => {
            delete this.state[key];
        });
        this.persistentKeys.clear();
        this.cache.clear();
        this.cacheExpiration.clear();
        localStorage.removeItem('qiq_state');
        this.notifyListeners('*', {}, this.state);
    }

    // الاشتراك في تغييرات الحالة
    subscribe(key, callback, options = {}) {
        const { 
            immediate = false, 
            once = false,
            condition = null 
        } = options;

        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }

        const listener = {
            callback,
            once,
            condition,
            id: Math.random().toString(36).substr(2, 9)
        };

        this.listeners.get(key).push(listener);

        // استدعاء فوري إذا طُلب
        if (immediate && key in this.state) {
            callback(this.state[key], undefined);
        }

        // إرجاع دالة إلغاء الاشتراك
        return () => this.unsubscribe(key, listener.id);
    }

    // إلغاء الاشتراك
    unsubscribe(key, listenerId) {
        if (this.listeners.has(key)) {
            const listeners = this.listeners.get(key);
            const index = listeners.findIndex(l => l.id === listenerId);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // إشعار المستمعين
    notifyListeners(key, newValue, oldValue) {
        // إشعار المستمعين المحددين
        if (this.listeners.has(key)) {
            const listeners = [...this.listeners.get(key)];
            listeners.forEach(listener => {
                try {
                    // التحقق من الشرط
                    if (listener.condition && !listener.condition(newValue, oldValue)) {
                        return;
                    }

                    listener.callback(newValue, oldValue);

                    // إزالة المستمع إذا كان لمرة واحدة
                    if (listener.once) {
                        this.unsubscribe(key, listener.id);
                    }
                } catch (error) {
                    console.error('Error in state listener:', error);
                }
            });
        }

        // إشعار المستمعين العامين
        if (this.listeners.has('*')) {
            const globalListeners = [...this.listeners.get('*')];
            globalListeners.forEach(listener => {
                try {
                    listener.callback({ [key]: newValue }, { [key]: oldValue });
                } catch (error) {
                    console.error('Error in global state listener:', error);
                }
            });
        }
    }

    // إضافة إلى التاريخ
    addToHistory(key, oldValue, newValue) {
        this.history.push({
            key,
            oldValue,
            newValue,
            timestamp: Date.now()
        });

        // الحد الأقصى للتاريخ
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    // التراجع عن آخر تغيير
    undo() {
        if (this.history.length === 0) return false;

        const lastChange = this.history.pop();
        this.setState(lastChange.key, lastChange.oldValue, { silent: true });
        
        return lastChange;
    }

    // الحصول على تاريخ التغييرات
    getHistory(key = null) {
        if (key) {
            return this.history.filter(h => h.key === key);
        }
        return [...this.history];
    }

    // حفظ الحالة الدائمة
    savePersistentState() {
        try {
            const persistentState = {};
            this.persistentKeys.forEach(key => {
                if (key in this.state) {
                    persistentState[key] = this.state[key];
                }
            });
            
            localStorage.setItem('qiq_state', JSON.stringify(persistentState));
        } catch (error) {
            console.error('Failed to save persistent state:', error);
        }
    }

    // إعداد الحفظ التلقائي
    setupAutoSave() {
        setInterval(() => {
            if (this.persistentKeys.size > 0) {
                this.savePersistentState();
            }
        }, 30000); // كل 30 ثانية
    }

    // إدارة التخزين المؤقت
    cache(key, value, expiration = 300000) { // 5 دقائق افتراضي
        this.cache.set(key, value);
        this.cacheExpiration.set(key, Date.now() + expiration);
    }

    // الحصول من التخزين المؤقت
    getCache(key) {
        if (this.cache.has(key)) {
            const expiration = this.cacheExpiration.get(key);
            if (Date.now() < expiration) {
                return this.cache.get(key);
            } else {
                // انتهت الصلاحية
                this.cache.delete(key);
                this.cacheExpiration.delete(key);
            }
        }
        return null;
    }

    // مسح التخزين المؤقت
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
            this.cacheExpiration.delete(key);
        } else {
            this.cache.clear();
            this.cacheExpiration.clear();
        }
    }

    // إعداد تنظيف التخزين المؤقت
    setupCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, expiration] of this.cacheExpiration.entries()) {
                if (now >= expiration) {
                    this.cache.delete(key);
                    this.cacheExpiration.delete(key);
                }
            }
        }, 60000); // كل دقيقة
    }

    // إضافة middleware
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }

    // تطبيق middleware
    applyMiddleware(action, key, value) {
        let result = { key, value };
        
        for (const middleware of this.middleware) {
            try {
                result = middleware(action, result.key, result.value) || result;
            } catch (error) {
                console.error('Middleware error:', error);
            }
        }
        
        return result;
    }

    // دالة مساعدة للعمل مع كائنات الحالة المعقدة
    updateNestedState(path, value, options = {}) {
        const keys = path.split('.');
        const rootKey = keys[0];
        
        let current = this.getState(rootKey, {});
        const root = current;
        
        // التنقل للمسار المطلوب
        for (let i = 1; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // تعيين القيمة
        current[keys[keys.length - 1]] = value;
        
        // تحديث الحالة الجذرية
        this.setState(rootKey, root, options);
    }

    // الحصول على قيمة متداخلة
    getNestedState(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    // دمج حالة جديدة
    mergeState(newState, options = {}) {
        Object.keys(newState).forEach(key => {
            this.setState(key, newState[key], { ...options, merge: true });
        });
    }

    // مقارنة حالات
    compareState(otherState) {
        const differences = {};
        const allKeys = new Set([
            ...Object.keys(this.state),
            ...Object.keys(otherState)
        ]);
        
        allKeys.forEach(key => {
            if (this.state[key] !== otherState[key]) {
                differences[key] = {
                    current: this.state[key],
                    other: otherState[key]
                };
            }
        });
        
        return differences;
    }

    // تصدير الحالة
    exportState(keys = null) {
        if (keys) {
            const exported = {};
            keys.forEach(key => {
                if (key in this.state) {
                    exported[key] = this.state[key];
                }
            });
            return exported;
        }
        
        return { ...this.state };
    }

    // استيراد الحالة
    importState(importedState, options = {}) {
        const { replace = false, validate = null } = options;
        
        if (replace) {
            this.clearState();
        }
        
        Object.keys(importedState).forEach(key => {
            if (!validate || validate(key, importedState[key])) {
                this.setState(key, importedState[key]);
            }
        });
    }

    // الحصول على إحصائيات الحالة
    getStateStats() {
        return {
            totalKeys: Object.keys(this.state).length,
            persistentKeys: this.persistentKeys.size,
            cacheSize: this.cache.size,
            historyLength: this.history.length,
            listenersCount: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
            memoryUsage: JSON.stringify(this.state).length
        };
    }

    // مراقبة التغييرات (للتطوير)
    watch() {
        this.subscribe('*', (newState, oldState) => {
            console.log('🔄 State changed:', { newState, oldState });
        });
    }

    // إنشاء محدد للحالة
    createSelector(selector) {
        return () => selector(this.state);
    }

    // تجميد الحالة (للحماية من التعديل)
    freeze() {
        Object.freeze(this.state);
        return this;
    }
}

// دوال مساعدة للاستخدام الشائع
class StateHelpers {
    static createAsyncStateUpdater(stateManager, key) {
        return {
            loading: () => stateManager.setState(`${key}_loading`, true),
            success: (data) => {
                stateManager.setState(`${key}_loading`, false);
                stateManager.setState(`${key}_error`, null);
                stateManager.setState(key, data);
            },
            error: (error) => {
                stateManager.setState(`${key}_loading`, false);
                stateManager.setState(`${key}_error`, error);
            }
        };
    }

    static createFormStateManager(stateManager, formKey) {
        return {
            updateField: (fieldName, value) => {
                stateManager.updateNestedState(`${formKey}.${fieldName}`, value);
            },
            
            getField: (fieldName) => {
                return stateManager.getNestedState(`${formKey}.${fieldName}`);
            },
            
            setErrors: (errors) => {
                stateManager.setState(`${formKey}_errors`, errors);
            },
            
            clearErrors: () => {
                stateManager.setState(`${formKey}_errors`, {});
            },
            
            reset: () => {
                stateManager.deleteState(formKey);
                stateManager.deleteState(`${formKey}_errors`);
            }
        };
    }
}

// تصدير للاستخدام العام
window.AdvancedStateManager = AdvancedStateManager;
window.StateHelpers = StateHelpers;

// تهيئة تلقائية
document.addEventListener('DOMContentLoaded', function() {
    window.stateManager = new AdvancedStateManager();
    
    // إعداد المتغيرات العامة للنظام
    window.stateManager.setState('app', {
        version: '1.0.0',
        environment: 'production',
        initialized: true,
        theme: 'light'
    }, { persist: true });
    
    // متابعة التغييرات في وضع التطوير
    if (window.location.hostname === 'localhost') {
        window.stateManager.watch();
    }
});