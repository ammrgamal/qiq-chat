// Enhanced Visitor Tracking for QuickITQuote
// This script tracks visitor behavior and integrates with HelloLeads API

class QiqVisitorTracker {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.startTime = Date.now();
    this.pageviews = 0;
    this.events = [];
    this.utm = this.extractUtmData();
    
    this.init();
  }
  
  init() {
    // Track page view
    this.trackPageview();
    
    // Track scroll depth
    this.trackScrollDepth();
    
    // Track time on page
    this.trackTimeOnPage();
    
    // Track form interactions
    this.trackFormInteractions();
    
    // Track clicks on important elements
    this.trackImportantClicks();
    
    // Send data before page unload
    this.setupBeforeUnload();
    
    console.log('🔍 QiQ Visitor Tracker initialized', {
      sessionId: this.sessionId,
      utm: this.utm
    });
  }
  
  getOrCreateSessionId() {
    const sessionKey = 'qiq_visitor_session';
    let sessionId = sessionStorage.getItem(sessionKey);
    
    if (!sessionId) {
      sessionId = `qiq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(sessionKey, sessionId);
      sessionStorage.setItem('qiq_session_start', Date.now().toString());
      
      // Track new session
      this.trackEvent('session_start', {
        referrer: document.referrer,
        landing_page: window.location.pathname
      });
    }
    
    return sessionId;
  }
  
  extractUtmData() {
    const utm = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (urlParams.has(param)) {
        utm[param] = urlParams.get(param);
      }
    });
    
    // Store UTM data for the session
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('qiq_utm_data', JSON.stringify(utm));
    } else {
      // Try to load stored UTM data
      const stored = sessionStorage.getItem('qiq_utm_data');
      if (stored) {
        try {
          Object.assign(utm, JSON.parse(stored));
        } catch (e) {
          // Ignore invalid data
        }
      }
    }
    
    return utm;
  }
  
  trackPageview() {
    this.pageviews++;
    this.trackEvent('pageview', {
      page: window.location.pathname,
      title: document.title,
      timestamp: new Date().toISOString()
    });
  }
  
  trackScrollDepth() {
    let maxScroll = 0;
    let scrollTimer = null;
    
    const updateScrollDepth = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        
        // Track milestone scroll depths
        if (maxScroll >= 25 && maxScroll < 50) {
          this.trackEvent('scroll_depth_25');
        } else if (maxScroll >= 50 && maxScroll < 75) {
          this.trackEvent('scroll_depth_50');
        } else if (maxScroll >= 75 && maxScroll < 90) {
          this.trackEvent('scroll_depth_75');
        } else if (maxScroll >= 90) {
          this.trackEvent('scroll_depth_90');
        }
      }
    };
    
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateScrollDepth, 100);
    });
  }
  
  trackTimeOnPage() {
    // Track time milestones
    const milestones = [30, 60, 120, 300]; // seconds
    
    milestones.forEach(seconds => {
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          this.trackEvent(`time_on_page_${seconds}s`);
        }
      }, seconds * 1000);
    });
  }
  
  trackFormInteractions() {
    // Track form field interactions
    const formFields = document.querySelectorAll('input, textarea, select');
    
    formFields.forEach(field => {
      field.addEventListener('focus', () => {
        this.trackEvent('form_field_focus', {
          field_id: field.id,
          field_name: field.name,
          field_type: field.type
        });
      });
      
      field.addEventListener('blur', () => {
        if (field.value.trim()) {
          this.trackEvent('form_field_filled', {
            field_id: field.id,
            field_name: field.name,
            has_value: true
          });
        }
      });
    });
    
    // Track form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        this.trackEvent('form_submit', {
          form_id: form.id,
          form_action: form.action
        });
      });
    });
  }
  
  trackImportantClicks() {
    // Track clicks on important buttons and links
    const importantElements = document.querySelectorAll(
      'button[id*="btn"], a[href*="quote"], .cta-button, [data-track="click"]'
    );
    
    importantElements.forEach(element => {
      element.addEventListener('click', () => {
        this.trackEvent('important_click', {
          element_id: element.id,
          element_text: element.textContent?.trim()?.slice(0, 50),
          element_class: element.className
        });
      });
    });
    
    // Track quote-related interactions
    const quoteButtons = document.querySelectorAll('[id*="quote"], [id*="submit"], [id*="request"]');
    quoteButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.trackEvent('quote_interaction', {
          button_id: button.id,
          action: button.id.includes('submit') ? 'submit' : 
                  button.id.includes('request') ? 'request' : 'quote'
        });
      });
    });
  }
  
  setupBeforeUnload() {
    const sendFinalData = () => {
      const sessionDuration = Math.round((Date.now() - this.startTime) / 1000);
      
      this.trackEvent('session_end', {
        duration_seconds: sessionDuration,
        pageviews: this.pageviews,
        events_count: this.events.length
      });
      
      // Send data using sendBeacon for reliability
      this.sendTrackingData(true);
    };
    
    window.addEventListener('beforeunload', sendFinalData);
    window.addEventListener('pagehide', sendFinalData);
    
    // Also send data periodically
    setInterval(() => {
      this.sendTrackingData();
    }, 60000); // Every minute
  }
  
  trackEvent(eventName, data = {}) {
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      page: window.location.pathname,
      ...data
    };
    
    this.events.push(event);
    
    console.log('📊 QiQ Event:', eventName, data);
  }
  
  getFullTrackingData() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      currentTime: Date.now(),
      duration: Math.round((Date.now() - this.startTime) / 1000),
      pageviews: this.pageviews,
      events: this.events,
      utm: this.utm,
      visitor: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer,
        currentUrl: window.location.href
      }
    };
  }
  
  async sendTrackingData(isBeacon = false) {
    const data = this.getFullTrackingData();
    
    try {
      if (isBeacon && navigator.sendBeacon) {
        // Use sendBeacon for reliable delivery during page unload
        navigator.sendBeacon('/api/visitor-tracking', JSON.stringify(data));
      } else {
        // Regular fetch for periodic updates
        await fetch('/api/visitor-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    } catch (error) {
      console.warn('Failed to send tracking data:', error);
    }
  }
  
  // Public method to get tracking data for quote submissions
  getTrackingDataForQuote() {
    return {
      sessionId: this.sessionId,
      visitor: {
        ipAddress: '', // Will be filled server-side
        userAgent: navigator.userAgent,
        referer: document.referrer,
        browser: this.detectBrowser(),
        os: this.detectOS(),
        device: this.detectDevice(),
        timestamp: new Date().toISOString(),
        utm: this.utm,
        sessionDuration: Math.round((Date.now() - this.startTime) / 1000),
        pageviews: this.pageviews,
        eventsCount: this.events.length
      }
    };
  }
  
  detectBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('chrome') && !ua.includes('edg')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('edg')) return 'edge';
    if (ua.includes('opera')) return 'opera';
    return 'unknown';
  }
  
  detectOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios')) return 'ios';
    return 'unknown';
  }
  
  detectDevice() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
  }
}

// Initialize visitor tracker when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.qiqTracker = new QiqVisitorTracker();
    });
  } else {
    window.qiqTracker = new QiqVisitorTracker();
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QiqVisitorTracker;
}