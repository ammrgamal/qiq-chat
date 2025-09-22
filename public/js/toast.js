/* ========= Global Toast Notification System ========= */
(function() {
  'use strict';

  // Global Toast Notification System
  window.QiqToast = {
    container: null,
    defaultDuration: 3000,
    
    init() {
      this.container = document.getElementById('qiq-toast-container');
      if (!this.container) {
        // Create container if it doesn't exist
        this.container = document.createElement('div');
        this.container.id = 'qiq-toast-container';
        this.container.className = 'qiq-toast';
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
      }
    },

  show(message, type = 'info', duration) {
      this.init();
      const d = typeof duration === 'number' ? duration : this.defaultDuration;
      
      const toast = document.createElement('div');
      toast.className = `item ${type}`;
      
      const content = document.createElement('span');
      content.textContent = message;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close';
      closeBtn.innerHTML = '×';
      closeBtn.setAttribute('aria-label', 'إغلاق');
      
      toast.appendChild(content);
      toast.appendChild(closeBtn);
      
      // Add to container
      this.container.appendChild(toast);
      
      // Auto remove after duration
      const timeoutId = setTimeout(() => {
        this.remove(toast);
      }, d);
      
      // Manual close
      closeBtn.addEventListener('click', () => {
        clearTimeout(timeoutId);
        this.remove(toast);
      });
      
      // Force reflow for animation
      toast.offsetHeight;
      
      return toast;
    },

    remove(toast) {
      if (toast && toast.parentNode) {
        toast.style.animation = 'qiq-fade-out 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    },

    success(message, duration) {
      return this.show(message, 'success', duration);
    },

    error(message, duration) {
      return this.show(message, 'error', duration);
    },

    warning(message, duration) {
      return this.show(message, 'warning', duration);
    },

    info(message, duration) {
      return this.show(message, 'info', duration);
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => QiqToast.init());
  } else {
    QiqToast.init();
  }

})();