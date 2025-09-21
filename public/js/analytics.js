// Analytics and insights system
class AnalyticsManager {
  constructor() {
    this.storageKey = 'qiq_analytics';
    this.sessionKey = 'qiq_session';
    this.data = this.loadAnalytics();
    this.session = this.initSession();
    this.setupTracking();
  }

  loadAnalytics() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : {
        pageViews: {},
        searches: [],
        interactions: [],
        performance: [],
        userJourney: [],
        errors: []
      };
    } catch {
      return {
        pageViews: {},
        searches: [],
        interactions: [],
        performance: [],
        userJourney: [],
        errors: []
      };
    }
  }

  saveAnalytics() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save analytics:', e);
    }
  }

  initSession() {
    const sessionId = sessionStorage.getItem(this.sessionKey) || this.generateSessionId();
    sessionStorage.setItem(this.sessionKey, sessionId);
    
    return {
      id: sessionId,
      startTime: Date.now(),
      pageViews: 0,
      interactions: 0
    };
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Track page views
  trackPageView(page = window.location.pathname) {
    const timestamp = Date.now();
    const pageKey = page.replace(/^\//, '') || 'home';
    
    this.data.pageViews[pageKey] = (this.data.pageViews[pageKey] || 0) + 1;
    this.session.pageViews++;
    
    this.data.userJourney.push({
      type: 'pageView',
      page: pageKey,
      timestamp,
      sessionId: this.session.id
    });

    this.saveAnalytics();
  }

  // Track search queries
  trackSearch(query, results = 0, filters = {}, duration = 0) {
    const searchData = {
      query: query.trim(),
      results,
      filters,
      duration,
      timestamp: Date.now(),
      sessionId: this.session.id
    };

    this.data.searches.push(searchData);
    this.session.interactions++;
    
    // Limit search history to last 1000 entries
    if (this.data.searches.length > 1000) {
      this.data.searches = this.data.searches.slice(-1000);
    }

    this.saveAnalytics();
  }

  // Track user interactions
  trackInteraction(type, details = {}) {
    const interactionData = {
      type,
      details,
      timestamp: Date.now(),
      sessionId: this.session.id,
      page: window.location.pathname
    };

    this.data.interactions.push(interactionData);
    this.session.interactions++;

    // Limit interactions to last 1000 entries
    if (this.data.interactions.length > 1000) {
      this.data.interactions = this.data.interactions.slice(-1000);
    }

    this.saveAnalytics();
  }

  // Track performance metrics
  trackPerformance(metric, value, context = {}) {
    const performanceData = {
      metric,
      value,
      context,
      timestamp: Date.now(),
      sessionId: this.session.id
    };

    this.data.performance.push(performanceData);

    // Limit performance data to last 500 entries
    if (this.data.performance.length > 500) {
      this.data.performance = this.data.performance.slice(-500);
    }

    this.saveAnalytics();
  }

  // Track errors
  trackError(error, context = {}) {
    const errorData = {
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: Date.now(),
      sessionId: this.session.id,
      page: window.location.pathname
    };

    this.data.errors.push(errorData);

    // Limit error logs to last 100 entries
    if (this.data.errors.length > 100) {
      this.data.errors = this.data.errors.slice(-100);
    }

    this.saveAnalytics();
  }

  // Get analytics insights
  getInsights(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const recentSearches = this.data.searches.filter(s => s.timestamp > cutoff);
    const recentInteractions = this.data.interactions.filter(i => i.timestamp > cutoff);
    const recentJourney = this.data.userJourney.filter(j => j.timestamp > cutoff);

    return {
      totalPageViews: Object.values(this.data.pageViews).reduce((a, b) => a + b, 0),
      topPages: this.getTopPages(),
      topSearches: this.getTopSearches(recentSearches),
      searchSuccessRate: this.getSearchSuccessRate(recentSearches),
      userFlow: this.getUserFlow(recentJourney),
      errorRate: this.getErrorRate(days),
      averageSessionDuration: this.getAverageSessionDuration(),
      interactionTypes: this.getInteractionTypes(recentInteractions)
    };
  }

  getTopPages(limit = 5) {
    return Object.entries(this.data.pageViews)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([page, views]) => ({ page, views }));
  }

  getTopSearches(searches, limit = 10) {
    const searchCounts = {};
    searches.forEach(s => {
      searchCounts[s.query] = (searchCounts[s.query] || 0) + 1;
    });

    return Object.entries(searchCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  getSearchSuccessRate(searches) {
    if (searches.length === 0) return 0;
    const successful = searches.filter(s => s.results > 0).length;
    return Math.round((successful / searches.length) * 100);
  }

  getUserFlow(journey) {
    const flow = {};
    for (let i = 0; i < journey.length - 1; i++) {
      const from = journey[i].page;
      const to = journey[i + 1].page;
      const key = `${from} → ${to}`;
      flow[key] = (flow[key] || 0) + 1;
    }

    return Object.entries(flow)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));
  }

  getErrorRate(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentErrors = this.data.errors.filter(e => e.timestamp > cutoff);
    const recentInteractions = this.data.interactions.filter(i => i.timestamp > cutoff);
    
    if (recentInteractions.length === 0) return 0;
    return Math.round((recentErrors.length / recentInteractions.length) * 100 * 100) / 100;
  }

  getAverageSessionDuration() {
    const sessions = {};
    this.data.userJourney.forEach(event => {
      if (!sessions[event.sessionId]) {
        sessions[event.sessionId] = { start: event.timestamp, end: event.timestamp };
      } else {
        sessions[event.sessionId].end = Math.max(sessions[event.sessionId].end, event.timestamp);
      }
    });

    const durations = Object.values(sessions).map(s => s.end - s.start);
    if (durations.length === 0) return 0;
    
    const average = durations.reduce((a, b) => a + b, 0) / durations.length;
    return Math.round(average / 1000); // Return in seconds
  }

  getInteractionTypes(interactions) {
    const types = {};
    interactions.forEach(i => {
      types[i.type] = (types[i.type] || 0) + 1;
    });

    return Object.entries(types)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => ({ type, count }));
  }

  // Setup automatic tracking
  setupTracking() {
    // Track page load
    this.trackPageView();

    // Track clicks
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, .clickable');
      if (target) {
        this.trackInteraction('click', {
          element: target.tagName,
          className: target.className,
          text: target.textContent.slice(0, 50)
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      this.trackInteraction('form_submit', {
        form: e.target.id || e.target.className
      });
    });

    // Track errors
    window.addEventListener('error', (e) => {
      this.trackError(e.error, {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      this.trackError(e.reason, {
        type: 'unhandled_promise_rejection'
      });
    });

    // Track performance
    if (window.performance && performance.getEntriesByType) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            this.trackPerformance('page_load', navigation.loadEventEnd - navigation.loadEventStart);
            this.trackPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
          }
        }, 1000);
      });
    }
  }

  // Export data for analysis
  exportData() {
    const insights = this.getInsights(30); // Last 30 days
    
    return {
      summary: insights,
      rawData: {
        pageViews: this.data.pageViews,
        recentSearches: this.data.searches.slice(-100),
        recentInteractions: this.data.interactions.slice(-100),
        recentPerformance: this.data.performance.slice(-50),
        recentErrors: this.data.errors.slice(-20)
      },
      session: this.session,
      exportedAt: new Date().toISOString()
    };
  }

  // Generate analytics report
  generateReport() {
    const insights = this.getInsights();
    
    return `
# تقرير التحليلات - QuickITQuote

## إحصائيات عامة
- إجمالي مشاهدات الصفحات: ${insights.totalPageViews}
- معدل نجاح البحث: ${insights.searchSuccessRate}%
- متوسط مدة الجلسة: ${insights.averageSessionDuration} ثانية
- معدل الأخطاء: ${insights.errorRate}%

## أهم الصفحات
${insights.topPages.map(p => `- ${p.page}: ${p.views} مشاهدة`).join('\n')}

## أهم عمليات البحث
${insights.topSearches.map(s => `- "${s.query}": ${s.count} مرة`).join('\n')}

## مسار المستخدم
${insights.userFlow.map(f => `- ${f.path}: ${f.count} مرة`).join('\n')}

## أنواع التفاعل
${insights.interactionTypes.map(i => `- ${i.type}: ${i.count} مرة`).join('\n')}

تم إنشاء التقرير في: ${new Date().toLocaleString('ar-EG')}
    `.trim();
  }
}

// A/B Testing Framework
class ABTestManager {
  constructor() {
    this.storageKey = 'qiq_ab_tests';
    this.tests = this.loadTests();
    this.userVariants = this.loadUserVariants();
  }

  loadTests() {
    // Define your A/B tests here
    return {
      'search_layout': {
        name: 'تخطيط صفحة البحث',
        variants: ['original', 'enhanced'],
        trafficSplit: 50 // 50/50 split
      },
      'button_color': {
        name: 'لون الأزرار',
        variants: ['blue', 'green'],
        trafficSplit: 50
      }
    };
  }

  loadUserVariants() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  saveUserVariants() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.userVariants));
  }

  getVariant(testName) {
    if (!this.tests[testName]) return null;

    // Return existing variant for this user
    if (this.userVariants[testName]) {
      return this.userVariants[testName];
    }

    // Assign new variant
    const test = this.tests[testName];
    const random = Math.random() * 100;
    const variant = random < test.trafficSplit ? test.variants[0] : test.variants[1];
    
    this.userVariants[testName] = variant;
    this.saveUserVariants();
    
    // Track assignment
    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackInteraction('ab_test_assignment', {
        test: testName,
        variant
      });
    }

    return variant;
  }

  trackConversion(testName, conversionType = 'default') {
    const variant = this.userVariants[testName];
    if (!variant) return;

    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackInteraction('ab_test_conversion', {
        test: testName,
        variant,
        conversionType
      });
    }
  }
}

// User Feedback System
class FeedbackManager {
  constructor() {
    this.storageKey = 'qiq_feedback';
    this.feedback = this.loadFeedback();
    this.setupFeedbackWidget();
  }

  loadFeedback() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveFeedback() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.feedback));
  }

  submitFeedback(rating, comment, category = 'general') {
    const feedbackItem = {
      id: Date.now().toString(),
      rating,
      comment,
      category,
      page: window.location.pathname,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    this.feedback.push(feedbackItem);
    this.saveFeedback();

    // Track feedback submission
    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackInteraction('feedback_submitted', {
        rating,
        category,
        hasComment: !!comment
      });
    }

    return feedbackItem.id;
  }

  setupFeedbackWidget() {
    // Create floating feedback button
    const feedbackBtn = document.createElement('button');
    feedbackBtn.innerHTML = '💬';
    feedbackBtn.title = 'إرسال تعليق';
    feedbackBtn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 1000;
      background: #3b82f6; color: white; border: none;
      border-radius: 50%; width: 56px; height: 56px;
      font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    `;

    feedbackBtn.addEventListener('mouseenter', () => {
      feedbackBtn.style.transform = 'scale(1.1)';
    });

    feedbackBtn.addEventListener('mouseleave', () => {
      feedbackBtn.style.transform = 'scale(1)';
    });

    feedbackBtn.addEventListener('click', () => {
      this.showFeedbackModal();
    });

    document.body.appendChild(feedbackBtn);
  }

  showFeedbackModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;">
        <h3 style="margin: 0 0 16px 0; text-align: center;">📝 رأيك يهمنا</h3>
        <form id="feedback-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px;">تقييمك للموقع:</label>
            <div style="display: flex; gap: 8px; justify-content: center;">
              ${[1,2,3,4,5].map(rating => 
                `<button type="button" class="rating-btn" data-rating="${rating}" 
                 style="background: none; border: none; font-size: 24px; cursor: pointer;">⭐</button>`
              ).join('')}
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px;">فئة التعليق:</label>
            <select name="category" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px;">
              <option value="general">عام</option>
              <option value="search">البحث</option>
              <option value="ui">واجهة المستخدم</option>
              <option value="performance">الأداء</option>
              <option value="bug">مشكلة تقنية</option>
            </select>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px;">تعليقك (اختياري):</label>
            <textarea name="comment" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; min-height: 80px;" placeholder="شاركنا رأيك..."></textarea>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" onclick="this.closest('.feedback-modal').remove()" style="padding: 8px 16px; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer;">إلغاء</button>
            <button type="submit" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">إرسال</button>
          </div>
        </form>
      </div>
    `;

    modal.className = 'feedback-modal';
    document.body.appendChild(modal);

    let selectedRating = 0;

    // Handle rating selection
    modal.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRating = parseInt(btn.dataset.rating);
        modal.querySelectorAll('.rating-btn').forEach((rBtn, index) => {
          rBtn.style.opacity = index < selectedRating ? '1' : '0.3';
        });
      });
    });

    // Handle form submission
    modal.querySelector('#feedback-form').addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (selectedRating === 0) {
        alert('يرجى اختيار تقييم');
        return;
      }

      const formData = new FormData(e.target);
      const feedbackId = this.submitFeedback(
        selectedRating,
        formData.get('comment'),
        formData.get('category')
      );

      modal.remove();
      
      // Show thank you message
      const thanks = document.createElement('div');
      thanks.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: #10b981; color: white; padding: 16px 20px;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      thanks.textContent = 'شكراً لك! تم إرسال تعليقك بنجاح 🙏';
      document.body.appendChild(thanks);
      
      setTimeout(() => thanks.remove(), 3000);
    });
  }

  getFeedbackSummary() {
    const ratings = this.feedback.map(f => f.rating);
    const averageRating = ratings.length > 0 ? 
      Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;

    const categories = {};
    this.feedback.forEach(f => {
      categories[f.category] = (categories[f.category] || 0) + 1;
    });

    return {
      totalFeedback: this.feedback.length,
      averageRating,
      ratingDistribution: [1,2,3,4,5].map(rating => ({
        rating,
        count: ratings.filter(r => r === rating).length
      })),
      categories: Object.entries(categories).map(([category, count]) => ({ category, count })),
      recentFeedback: this.feedback.slice(-10)
    };
  }
}

// Initialize analytics
document.addEventListener('DOMContentLoaded', () => {
  window.QiqAnalytics = new AnalyticsManager();
  window.QiqABTest = new ABTestManager();
  window.QiqFeedback = new FeedbackManager();
});

// Export for admin dashboard
window.QiqInsights = {
  AnalyticsManager,
  ABTestManager,
  FeedbackManager
};