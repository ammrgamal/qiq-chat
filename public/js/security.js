// Security utilities and validators
class SecurityManager {
  // Input sanitization
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Email validation
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Phone validation (international format)
  static validatePhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // Password strength validation
  static validatePassword(password) {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: password.length >= minLength && hasUpper && hasLower && hasNumber,
      score: [
        password.length >= minLength,
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial
      ].filter(Boolean).length,
      requirements: {
        minLength: password.length >= minLength,
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial
      }
    };
  }

  // Rate limiting for client-side
  static createRateLimiter(maxRequests = 10, windowMs = 60000) {
    const requests = [];
    
    return function() {
      const now = Date.now();
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0] <= now - windowMs) {
        requests.shift();
      }
      
      // Check if we've exceeded the limit
      if (requests.length >= maxRequests) {
        const resetTime = requests[0] + windowMs;
        const waitTime = Math.ceil((resetTime - now) / 1000);
        throw new Error(`تم تجاوز الحد المسموح. يرجى المحاولة بعد ${waitTime} ثانية`);
      }
      
      // Add current request
      requests.push(now);
      return true;
    };
  }

  // Session timeout manager
  static createSessionManager(timeoutMinutes = 30) {
    let lastActivity = Date.now();
    let timeoutId;
    let warningShown = false;

    const resetTimeout = () => {
      lastActivity = Date.now();
      warningShown = false;
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        const idleTime = Date.now() - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;
        
        if (idleTime >= timeoutMs - 120000 && !warningShown) { // 2 minutes warning
          warningShown = true;
          if (confirm('ستنتهي جلستك خلال دقيقتين. هل تريد المتابعة؟')) {
            resetTimeout();
          }
        } else if (idleTime >= timeoutMs) {
          this.logout('انتهت صلاحية الجلسة');
        }
      }, 60000); // Check every minute
    };

    const logout = (reason = 'تم تسجيل الخروج') => {
      localStorage.removeItem('qiq_token');
      sessionStorage.clear();
      alert(reason);
      window.location.href = '/';
    };

    // Track user activity
    const trackActivity = () => resetTimeout();
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, trackActivity, true);
    });

    resetTimeout();
    
    return {
      resetTimeout,
      logout,
      getIdleTime: () => Date.now() - lastActivity
    };
  }

  // CSRF token generator
  static generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Content Security Policy helper
  static enforceCSP() {
    // Remove any inline scripts that might be injected
    document.querySelectorAll('script:not([src])').forEach(script => {
      if (!script.hasAttribute('data-qiq-safe')) {
        script.remove();
      }
    });

    // Monitor for new script injections
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'SCRIPT' && !node.src && !node.hasAttribute('data-qiq-safe')) {
            console.warn('Potential XSS attempt blocked:', node);
            node.remove();
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Form validation utilities
class FormValidator {
  constructor(formElement) {
    this.form = formElement;
    this.validators = new Map();
    this.errors = new Map();
  }

  addValidator(fieldName, validator, errorMessage) {
    if (!this.validators.has(fieldName)) {
      this.validators.set(fieldName, []);
    }
    this.validators.get(fieldName).push({ validator, errorMessage });
    return this;
  }

  validate() {
    this.errors.clear();
    let isValid = true;

    for (const [fieldName, validators] of this.validators) {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (!field) continue;

      const value = field.value;
      
      for (const { validator, errorMessage } of validators) {
        if (!validator(value, field)) {
          this.errors.set(fieldName, errorMessage);
          this.showFieldError(field, errorMessage);
          isValid = false;
          break;
        } else {
          this.clearFieldError(field);
        }
      }
    }

    return isValid;
  }

  showFieldError(field, message) {
    this.clearFieldError(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = 'color: #dc2626; font-size: 12px; margin-top: 4px;';
    errorDiv.textContent = message;
    
    field.style.borderColor = '#dc2626';
    field.parentNode.appendChild(errorDiv);
  }

  clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    field.style.borderColor = '';
  }

  getErrors() {
    return Object.fromEntries(this.errors);
  }
}

// Initialize security measures
document.addEventListener('DOMContentLoaded', () => {
  // Enforce CSP
  SecurityManager.enforceCSP();
  
  // Initialize session management if user is logged in
  if (localStorage.getItem('qiq_token')) {
    window.QiqSession = SecurityManager.createSessionManager(30);
  }
  
  // Add CSRF token to all forms
  document.querySelectorAll('form').forEach(form => {
    if (!form.querySelector('input[name="csrf_token"]')) {
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrf_token';
      csrfInput.value = SecurityManager.generateCSRFToken();
      form.appendChild(csrfInput);
    }
  });
});

// Global security utilities
window.QiqSecurity = SecurityManager;
window.QiqValidator = FormValidator;

// Rate limiters for common actions
window.QiqRateLimit = {
  search: SecurityManager.createRateLimiter(30, 60000), // 30 searches per minute
  login: SecurityManager.createRateLimiter(5, 300000), // 5 login attempts per 5 minutes
  registration: SecurityManager.createRateLimiter(3, 3600000) // 3 registrations per hour
};