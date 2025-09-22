// UI/UX enhancements: Dark mode, mobile responsiveness, drag & drop
class ThemeManager {
  constructor() {
    this.storageKey = 'qiq_theme';
    this.currentTheme = this.loadTheme();
    this.applyTheme();
    this.setupThemeToggle();
  }

  loadTheme() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) return saved;
    
    // Auto-detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  saveTheme(theme) {
    localStorage.setItem(this.storageKey, theme);
    this.currentTheme = theme;
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    
    if (this.currentTheme === 'dark') {
      this.applyDarkMode();
    } else {
      this.removeDarkMode();
    }
  }

  applyDarkMode() {
    const darkStyles = `
      :root[data-theme="dark"] {
        --bg-primary: #1f2937;
        --bg-secondary: #374151;
        --bg-tertiary: #4b5563;
        --text-primary: #f9fafb;
        --text-secondary: #e5e7eb;
        --text-muted: #cbd5e1;
        --border-color: #4b5563;
        --accent-color: #3b82f6;
        --success-color: #10b981;
        --error-color: #ef4444;
        --warning-color: #f59e0b;
      }

      [data-theme="dark"] body {
        background-color: var(--bg-primary);
        color: var(--text-primary);
      }

      [data-theme="dark"] .card,
      [data-theme="dark"] .qiq-result-card,
      [data-theme="dark"] .quote-section {
        background-color: var(--bg-secondary);
        border-color: var(--border-color);
        color: var(--text-primary);
      }

      [data-theme="dark"] .topbar {
        background-color: #111827;
        border-bottom-color: #374151;
      }
      [data-theme="dark"] .topbar .brand, 
      [data-theme="dark"] .topbar a { color: var(--text-primary); }

      [data-theme="dark"] input,
      [data-theme="dark"] textarea,
      [data-theme="dark"] select {
        background-color: var(--bg-tertiary);
        border-color: var(--border-color);
        color: var(--text-primary);
      }

      [data-theme="dark"] input::placeholder {
        color: var(--text-muted);
      }

      [data-theme="dark"] .btn.secondary {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
      }

      [data-theme="dark"] .chip { background-color: #374151; color: #e5e7eb; }
      [data-theme="dark"] .price { background: #1f2937; color: #93c5fd; }
      [data-theme="dark"] .muted { color: var(--text-muted); }
      [data-theme="dark"] .name { color: var(--text-primary); }

      [data-theme="dark"] .sidebar {
        background-color: var(--bg-secondary);
        border-color: var(--border-color);
      }

      [data-theme="dark"] .pagination button {
        background-color: var(--bg-secondary);
        border-color: var(--border-color);
        color: var(--text-primary);
      }

      [data-theme="dark"] .motivational-message {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
      }
      [data-theme="dark"] .btn.ghost, [data-theme="dark"] a.btn.ghost {
        background: transparent;
        color: #e5e7eb;
        border-color: #6b7280;
      }
      [data-theme="dark"] .results.list-lines .card {
        background: transparent;
        border-bottom-color: #374151;
      }

      /* Chat container & bubbles */
      [data-theme="dark"] .qiq { background: var(--bg-secondary); border-color: var(--border-color); }
      [data-theme="dark"] .qiq-window { background: #111827; color: var(--text-primary); }
      [data-theme="dark"] .qiq-form { background: var(--bg-secondary); border-top-color: var(--border-color); }
      [data-theme="dark"] .qiq-input { background: var(--bg-tertiary); border-color: var(--border-color); color: var(--text-primary); }
      [data-theme="dark"] .qiq-input::placeholder { color: var(--text-muted); }
      [data-theme="dark"] .qiq-bubble { background: var(--bg-tertiary); border-color: var(--border-color); color: var(--text-primary); }
      [data-theme="dark"] .qiq-msg.user .qiq-bubble { background: #2563eb; border-color: #2563eb; color: #fff; }
      [data-theme="dark"] .qiq-btn, [data-theme="dark"] .qiq-send { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
      [data-theme="dark"] .qiq-btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
      [data-theme="dark"] .qiq-success { background: var(--success-color); border-color: var(--success-color); }
      [data-theme="dark"] .qiq-products-list { background: var(--bg-secondary); border-color: var(--border-color); }
      [data-theme="dark"] .qiq-result-row { background: #111827; border-color: var(--border-color); color: var(--text-primary); }
      [data-theme="dark"] .qiq-result-row:hover { background: #0f172a; }
      [data-theme="dark"] .qiq-result-row .qiq-chip { background: #1f2937; border-color: #374151; color: #e5e7eb; }
      [data-theme="dark"] .qiq-chip.price { background:#0b1220; border-color:#1e293b; color:#93c5fd; }

      /* BOQ table */
      [data-theme="dark"] .qiq-boq { background: var(--bg-secondary); border-color: var(--border-color); }
      [data-theme="dark"] .qiq-table { background: var(--bg-secondary); color: var(--text-primary); }
      [data-theme="dark"] .qiq-table th { background: #111827; color: var(--text-secondary); border-bottom-color: var(--border-color); }
      [data-theme="dark"] .qiq-table td { border-bottom-color: var(--border-color); }
      [data-theme="dark"] .qiq-table tbody tr:hover { background: #1f2937; }
      [data-theme="dark"] .qiq-link { color: #93c5fd; }
    `;

    let styleEl = document.getElementById('dark-theme-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dark-theme-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = darkStyles;
  }

  removeDarkMode() {
    const styleEl = document.getElementById('dark-theme-styles');
    if (styleEl) {
      styleEl.remove();
    }
  }

  toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.saveTheme(newTheme);
    this.applyTheme();
    try { window.dispatchEvent(new CustomEvent('qiq-theme-changed', { detail: { theme: newTheme } })); } catch {}
    
    // Animate the transition
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);

    return newTheme;
  }

  setupThemeToggle() {
    // Create theme toggle button if it doesn't exist
    if (!document.querySelector('.theme-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'theme-toggle';
      toggle.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
      toggle.style.cssText = `
        position: fixed; top: 20px; left: 20px; z-index: 1000;
        background: var(--bg-secondary, #f3f4f6); border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 50%; width: 44px; height: 44px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; transition: all 0.2s ease;
      `;
      
      toggle.addEventListener('click', () => {
        const newTheme = this.toggle();
        toggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
      });

      document.body.appendChild(toggle);
    }
  }
}

class ResponsiveManager {
  constructor() {
    this.breakpoints = {
      mobile: 768,
      tablet: 1024,
      desktop: 1200
    };
    this.setupResponsiveStyles();
    this.setupMobileMenu();
  }

  setupResponsiveStyles() {
    const responsiveStyles = `
      @media (max-width: 768px) {
        .container {
          padding: 8px;
          margin: 8px auto;
        }

        .layout {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .sidebar {
          order: 2;
          padding: 8px;
        }

        .results {
          order: 1;
        }

        .card {
          flex-direction: column;
          text-align: center;
        }

        .card img {
          width: 80px;
          height: 80px;
          margin: 0 auto 8px;
        }

        .quick-actions {
          flex-direction: column;
          gap: 8px;
        }

        .quick-btn {
          width: 100%;
          padding: 12px;
        }

        .quote-section {
          padding: 12px;
        }

        .table-container {
          overflow-x: auto;
        }

        .comparison-table {
          min-width: 600px;
        }

        .theme-toggle {
          top: 10px !important;
          left: 10px !important;
          width: 36px !important;
          height: 36px !important;
          font-size: 14px !important;
        }

        .qiq-window {
          height: 300px;
        }

        .motivational-message {
          font-size: 14px;
          padding: 10px 12px;
        }
      }

      @media (max-width: 480px) {
        .toolbar {
          flex-direction: column;
          gap: 8px;
        }

        .toolbar input {
          min-width: auto;
          width: 100%;
        }

        .header {
          flex-direction: column;
          text-align: center;
          gap: 8px;
        }

        .chips {
          justify-content: center;
        }
      }

      /* Tablet optimizations */
      @media (min-width: 769px) and (max-width: 1024px) {
        .layout {
          grid-template-columns: 200px 1fr;
        }

        .results {
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }
      }

      /* Large screen optimizations */
      @media (min-width: 1200px) {
        .container {
          max-width: 1400px;
        }

        .results {
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'responsive-styles';
    styleEl.textContent = responsiveStyles;
    document.head.appendChild(styleEl);
  }

  setupMobileMenu() {
    // Add mobile menu toggle for sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= this.breakpoints.mobile) {
      const toggle = document.createElement('button');
      toggle.className = 'mobile-menu-toggle';
      toggle.innerHTML = '🔽 الفلاتر';
      toggle.style.cssText = `
        width: 100%; padding: 8px; margin-bottom: 8px;
        background: #f3f4f6; border: 1px solid #e5e7eb;
        border-radius: 8px; cursor: pointer;
      `;

      let isOpen = false;
      const content = sidebar.innerHTML;
      
      toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
          sidebar.innerHTML = toggle.outerHTML + content;
          toggle.innerHTML = '🔼 إخفاء الفلاتر';
        } else {
          sidebar.innerHTML = toggle.outerHTML;
          toggle.innerHTML = '🔽 الفلاتر';
        }
      });

      sidebar.innerHTML = toggle.outerHTML;
    }
  }

  isMobile() {
    return window.innerWidth <= this.breakpoints.mobile;
  }

  isTablet() {
    return window.innerWidth > this.breakpoints.mobile && window.innerWidth <= this.breakpoints.tablet;
  }

  isDesktop() {
    return window.innerWidth > this.breakpoints.tablet;
  }
}

class DragDropManager {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.setupDragDrop();
  }

  setupDragDrop() {
    if (!this.container) return;

    this.container.addEventListener('dragstart', (e) => {
      if (e.target.closest('.draggable-item')) {
        e.target.closest('.draggable-item').classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.closest('.draggable-item').outerHTML);
        e.dataTransfer.setData('text/plain', e.target.closest('.draggable-item').dataset.index || '');
      }
    });

    this.container.addEventListener('dragend', (e) => {
      document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingItem = document.querySelector('.dragging');
      const siblings = [...this.container.querySelectorAll('.draggable-item:not(.dragging)')];
      
      const nextSibling = siblings.find(sibling => {
        return e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
      });

      if (nextSibling) {
        this.container.insertBefore(draggingItem, nextSibling);
      } else {
        this.container.appendChild(draggingItem);
      }
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.onDrop(e);
    });

    // Add visual feedback
    const dragStyles = `
      .draggable-item {
        cursor: move;
        transition: transform 0.2s ease;
      }

      .draggable-item:hover {
        transform: translateY(-2px);
      }

      .dragging {
        opacity: 0.5;
        transform: rotate(5deg);
      }

      .drag-over {
        border: 2px dashed #3b82f6;
        background-color: rgba(59, 130, 246, 0.1);
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = dragStyles;
    document.head.appendChild(styleEl);
  }

  onDrop(e) {
    // Override this method to handle drop logic
    console.log('Item dropped');
  }

  makeDraggable(element, index) {
    element.setAttribute('draggable', true);
    element.classList.add('draggable-item');
    element.dataset.index = index;
  }
}

class PrintOptimizer {
  static setupPrintStyles() {
    const printStyles = `
      @media print {
        body * {
          visibility: hidden;
        }

        .printable, .printable * {
          visibility: visible;
        }

        .printable {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }

        .no-print {
          display: none !important;
        }

        .btn, button {
          display: none !important;
        }

        .sidebar {
          display: none !important;
        }

        .layout {
          grid-template-columns: 1fr !important;
        }

        .card {
          break-inside: avoid;
          border: 1px solid #000;
          margin-bottom: 8px;
        }

        .motivational-message {
          display: none !important;
        }

        @page {
          margin: 1cm;
          size: A4;
        }

        .page-break {
          page-break-before: always;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = printStyles;
    document.head.appendChild(styleEl);
  }

  static optimizeForPrint(element) {
    element.classList.add('printable');
    
    // Hide unnecessary elements
    const hideSelectors = ['.btn', 'button', '.toolbar', '.pagination', '.motivational-message'];
    hideSelectors.forEach(selector => {
      element.querySelectorAll(selector).forEach(el => el.classList.add('no-print'));
    });
  }

  static print(elementSelector) {
    const element = document.querySelector(elementSelector);
    if (!element) return;

    this.optimizeForPrint(element);
    
    // Create print-specific layout
    const printContainer = document.createElement('div');
    printContainer.className = 'print-container';
    printContainer.innerHTML = element.innerHTML;
    
    document.body.appendChild(printContainer);
    
    window.print();
    
    setTimeout(() => {
      document.body.removeChild(printContainer);
      element.classList.remove('printable');
    }, 1000);
  }
}

class I18nManager {
  constructor() {
    this.storageKey = 'qiq_lang';
    this.lang = localStorage.getItem(this.storageKey) || 'ar';
    this.strings = {
      ar: {
        Catalog: 'الكتالوج', Quote: 'عرض السعر', Account: 'الحساب', Chat: 'الدردشة',
        'Product Catalog': 'كتالوج المنتجات',
        Favorites: 'المفضلة', Comparison: 'المقارنة', 'View Quote': 'عرض عرض السعر',
        Company: 'الشركة', Category: 'الفئة', 'Price range': 'نطاق السعر', Apply: 'تطبيق',
        Lines: 'سطور', Grid: 'شبكة',
        Search: 'بحث', Clear: 'مسح', 'Search by name / PN / SKU': 'ابحث بالاسم / PN / SKU',
        'Search by name / PN / SKU': 'ابحث بالاسم / PN / SKU',
        'AI Agent': 'الوكيل الذكي',
        'Import BOQ (Excel)': 'استيراد BOQ (Excel)',
        'Search products': 'البحث عن منتجات',
        Send: 'إرسال',
  'Add all matched': 'Add all matched',
  'Attach matched': 'إرفاق المطابقة',
        'Clear all': 'مسح الكل',
        'Export CSV': 'تصدير CSV',
        'Export XLSX': 'تصدير XLSX',
        'Go to Quote': 'الانتقال لصفحة عرض السعر',
        'Add to Quote': 'إضافة للعرض',
        'Product details': 'تفاصيل المنتج',
        Image: 'الصورة',
        'Description / PN / SKU': 'الوصف / PN / SKU',
        QTY: 'الكمية',
        'Unit price': 'سعر الوحدة',
        'Line total': 'الإجمالي',
        Actions: 'إجراءات',
        'Grand total:': 'الإجمالي الكلي:',
        'Description • PN • company': 'الوصف • PN • الشركة',
        'Image (chat)': 'صورة',
        'Description (chat)': 'الوصف • PN • الشركة',
        'QTY (chat)': 'الكمية',
        'Unit price (chat)': 'سعر الوحدة',
        'Line total (chat)': 'الإجمالي',
        'Actions (chat)': 'إجراءات'
      },
      en: {
        Catalog: 'Catalog', Quote: 'Quote', Account: 'Account', Chat: 'Chat',
        'Product Catalog': 'Product Catalog',
        Favorites: 'Favorites', Comparison: 'Comparison', 'View Quote': 'View Quote',
        Company: 'Company', Category: 'Category', 'Price range': 'Price range', Apply: 'Apply',
        Lines: 'Lines', Grid: 'Grid',
        Search: 'Search', Clear: 'Clear', 'Search by name / PN / SKU': 'Search by name / PN / SKU',
        'Search by name / PN / SKU': 'Search by name / PN / SKU',
        'AI Agent': 'AI Agent',
        'Import BOQ (Excel)': 'Import BOQ (Excel)',
        'Search products': 'Search products',
        Send: 'Send',
  'Add all matched': 'Add all matched',
  'Attach matched': 'Attach matched',
        'Clear all': 'Clear all',
        'Export CSV': 'Export CSV',
        'Export XLSX': 'Export XLSX',
        'Go to Quote': 'Go to Quote page',
        'Add to Quote': 'Add to Quote',
        'Product details': 'Product details',
        Image: 'Image',
        'Description / PN / SKU': 'Description / PN / SKU',
        QTY: 'QTY',
        'Unit price': 'Unit price',
        'Line total': 'Line total',
        Actions: 'Actions',
        'Grand total:': 'Grand total:',
        'Description • PN • company': 'Description • PN • company',
        'Image (chat)': 'Image',
        'Description (chat)': 'Description • PN • company',
        'QTY (chat)': 'QTY',
        'Unit price (chat)': 'Unit price',
        'Line total (chat)': 'Line total',
        'Actions (chat)': 'Actions'
      }
    };
    this.applyDirection();
  }
  set(lang) {
    this.lang = lang;
    localStorage.setItem(this.storageKey, lang);
    this.applyDirection();
    this.translatePage();
    return this.lang;
  }
  toggle(){ return this.set(this.lang === 'ar' ? 'en' : 'ar'); }
  t(s){ return (this.strings[this.lang] && this.strings[this.lang][s]) || s; }
  applyDirection(){
    if (this.lang === 'ar') { document.documentElement.lang='ar'; document.documentElement.dir='rtl'; }
    else { document.documentElement.lang='en'; document.documentElement.dir='ltr'; }
  }
  translatePage(){
    // Minimal: update known buttons/placeholders if found
    const q = document.getElementById('q');
    if (q) q.placeholder = this.t('Search by name / PN / SKU');
    const ci = document.getElementById('qiq-input'); if (ci) ci.placeholder = this.t('Search by name / PN / SKU');
    const searchBtn = document.getElementById('searchBtn'); if (searchBtn) searchBtn.textContent = this.t('Search');
    const clearBtn = document.getElementById('clearBtn'); if (clearBtn) clearBtn.textContent = this.t('Clear');
    const importBtn = document.getElementById('qiq-import-btn'); if (importBtn) importBtn.textContent = this.t('Import BOQ (Excel)');
    const openSearchBtn = document.getElementById('qiq-open-search'); if (openSearchBtn) openSearchBtn.textContent = this.t('Search products');
    const sendBtn = document.querySelector('.qiq-send'); if (sendBtn) sendBtn.textContent = this.t('Send');
  const addAll = document.getElementById('qiq-add-all'); if (addAll) addAll.textContent = this.t('Attach matched');
    const clearAll = document.getElementById('qiq-clear-all'); if (clearAll) clearAll.textContent = this.t('Clear all');
    const exportCsv = document.getElementById('qiq-export-csv'); if (exportCsv) exportCsv.textContent = this.t('Export CSV');
    const exportXlsx = document.getElementById('qiq-export-xlsx'); if (exportXlsx) exportXlsx.textContent = this.t('Export XLSX');
    const goToQuote = document.getElementById('go-to-quote'); if (goToQuote) goToQuote.textContent = this.t('Go to Quote');

    // Chat table headers (by order)
    // Support both legacy qiq-table and new compact-quote-table
    let ths = document.querySelectorAll('table.qiq-table thead th');
    if (!ths || ths.length === 0) ths = document.querySelectorAll('table.compact-quote-table thead th');
    if (ths && ths.length >= 6) {
      ths[0].textContent = this.t('Image (chat)');
      ths[1].textContent = this.t('Description (chat)');
      ths[2].textContent = this.t('QTY (chat)');
      ths[3].textContent = this.t('Unit price (chat)');
      ths[4].textContent = this.t('Line total (chat)');
      ths[5].textContent = this.t('Actions (chat)');
    }
    let tfootGrand = document.querySelector('table.qiq-table tfoot td[colspan="3"] strong');
    if (!tfootGrand) tfootGrand = document.querySelector('table.compact-quote-table tfoot td[colspan="3"] strong');
    if (tfootGrand) tfootGrand.textContent = this.t('Grand total:');
    document.querySelectorAll('.topbar .brand .muted').forEach(el => {
      if (el.textContent.includes('Catalog')) el.textContent = this.t('Catalog');
      if (el.textContent.includes('Quote')) el.textContent = this.t('Quote');
      if (el.textContent.includes('Chat')) el.textContent = this.t('Chat');
    });
    document.querySelectorAll('a.btn.ghost').forEach(a=>{
      if (/Catalog/i.test(a.textContent)) a.textContent = this.t('Catalog');
      if (/Quote/i.test(a.textContent)) a.textContent = this.t('Quote');
      if (/Account/i.test(a.textContent)) a.textContent = this.t('Account');
      if (/AI Agent/i.test(a.textContent)) a.textContent = this.t('AI Agent');
    });

    // Catalog page specific
    const h1 = document.querySelector('.header h1'); if (h1) h1.textContent = this.t('Product Catalog');
    const viewList = document.getElementById('viewList'); if (viewList) viewList.textContent = this.t('Lines');
    const viewGrid = document.getElementById('viewGrid'); if (viewGrid) viewGrid.textContent = this.t('Grid');
    const favoritesBtn = document.getElementById('favorites-btn'); if (favoritesBtn) favoritesBtn.childNodes[0].textContent = ` ${this.t('Favorites')}`;
    const comparisonBtn = document.getElementById('comparison-btn'); if (comparisonBtn) comparisonBtn.childNodes[0].textContent = ` ${this.t('Comparison')}`;
    const applyPrice = document.getElementById('applyPrice'); if (applyPrice) applyPrice.textContent = this.t('Apply');
    const facetBrands = document.querySelector('#facet-brands h3'); if (facetBrands) facetBrands.textContent = this.t('Company');
    const facetCats = document.querySelector('#facet-categories h3'); if (facetCats) facetCats.textContent = this.t('Category');
  }
}

// Initialize UI enhancements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme manager
  window.QiqTheme = new ThemeManager();
  
  // Initialize responsive manager
  window.QiqResponsive = new ResponsiveManager();
  
  // Setup print optimization
  PrintOptimizer.setupPrintStyles();
  
  // Initialize drag and drop for quote items if container exists
  const quoteContainer = document.querySelector('#quote-items-tbody');
  if (quoteContainer) {
    window.QiqDragDrop = new DragDropManager('#quote-items-tbody');
  }
  
  // Initialize language manager
  window.QiqI18n = new I18nManager();
  window.QiqI18n.translatePage();
});

// Global utilities
window.QiqUI = {
  ThemeManager,
  ResponsiveManager,
  DragDropManager,
  PrintOptimizer
};