// Quote Management System
class QuoteManager {
    constructor() {
        this.quoteItems = document.getElementById('quote-items');
        this.totalPrice = document.getElementById('total-price');
        this.quoteCount = document.getElementById('quote-count');
        this.exportPdfButton = document.getElementById('export-pdf');
        this.sendQuoteButton = document.getElementById('send-quote');
        this.quoteToggle = document.getElementById('quote-toggle');
        
        this.items = [];
        this.total = 0;
        
        this.init();
    }
    
    init() {
        // Load saved quote from localStorage
        this.loadSavedQuote();
        
        // Event listeners
        this.exportPdfButton.addEventListener('click', () => this.exportToPdf());
        this.sendQuoteButton.addEventListener('click', () => this.sendQuote());
        this.quoteToggle.addEventListener('click', () => this.toggleQuoteView());
        
        this.updateUI();
        console.log('💰 Quote manager initialized');
    }
    
    addToQuote(productId) {
        const product = window.algoliaIntegration.getProductById(productId);
        if (!product) {
            this.showNotification('لم يتم العثور على المنتج', 'error');
            return;
        }
        
        // Check if item already exists
        const existingItem = this.items.find(item => item.product.objectID === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
            this.showNotification(`تم زيادة كمية ${product.name}`, 'success');
        } else {
            this.items.push({
                product: product,
                quantity: 1,
                id: Date.now() + Math.random()
            });
            this.showNotification(`تم إضافة ${product.name} إلى الاقتباس`, 'success');
        }
        
        this.updateUI();
        this.saveQuote();
    }
    
    removeFromQuote(itemId) {
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
            const itemName = this.items[itemIndex].product.name;
            this.items.splice(itemIndex, 1);
            this.showNotification(`تم حذف ${itemName} من الاقتباس`, 'info');
            this.updateUI();
            this.saveQuote();
        }
    }
    
    updateQuantity(itemId, newQuantity) {
        if (newQuantity < 1) {
            this.removeFromQuote(itemId);
            return;
        }
        
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            item.quantity = newQuantity;
            this.updateUI();
            this.saveQuote();
        }
    }
    
    updateUI() {
        this.renderQuoteItems();
        this.calculateTotal();
        this.updateQuoteCount();
    }
    
    renderQuoteItems() {
        if (this.items.length === 0) {
            this.quoteItems.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-shopping-cart text-4xl mb-4 opacity-50"></i>
                    <p>لم تتم إضافة أي منتجات بعد</p>
                    <p class="text-sm">ابحث عن المنتجات وأضفها إلى سلة الاقتباس</p>
                </div>
            `;
            return;
        }
        
        this.quoteItems.innerHTML = `
            <div class="space-y-3">
                ${this.items.map(item => this.renderQuoteItem(item)).join('')}
            </div>
        `;
    }
    
    renderQuoteItem(item) {
        const unitPrice = parseFloat(item.product.price.replace(/[^\d.]/g, ''));
        const itemTotal = unitPrice * item.quantity;
        
        return `
            <div class="bg-qiq-dark rounded-lg p-4 border border-qiq-gold/20">
                <div class="flex items-center space-x-4 space-x-reverse">
                    <img src="${item.product.image || '/images/product-placeholder.jpg'}" 
                         alt="${item.product.name}" 
                         class="w-12 h-12 object-cover rounded"
                         onerror="this.src='/images/product-placeholder.jpg'">
                    <div class="flex-1">
                        <h4 class="font-semibold text-white text-sm">${item.product.name}</h4>
                        <p class="text-xs text-gray-400">${item.product.price} ر.س / قطعة</p>
                    </div>
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <button onclick="window.quoteManager.updateQuantity(${item.id}, ${item.quantity - 1})" 
                                class="text-qiq-gold hover:text-yellow-600 w-6 h-6 flex items-center justify-center">
                            <i class="fas fa-minus text-xs"></i>
                        </button>
                        <span class="w-8 text-center text-sm font-semibold">${item.quantity}</span>
                        <button onclick="window.quoteManager.updateQuantity(${item.id}, ${item.quantity + 1})" 
                                class="text-qiq-gold hover:text-yellow-600 w-6 h-6 flex items-center justify-center">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-qiq-gold text-sm">${itemTotal.toLocaleString('ar-SA')} ر.س</p>
                        <button onclick="window.quoteManager.removeFromQuote(${item.id})" 
                                class="text-red-400 hover:text-red-600 text-xs mt-1">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateTotal() {
        this.total = this.items.reduce((sum, item) => {
            const unitPrice = parseFloat(item.product.price.replace(/[^\d.]/g, ''));
            return sum + (unitPrice * item.quantity);
        }, 0);
        
        this.totalPrice.textContent = `${this.total.toLocaleString('ar-SA')} ر.س`;
    }
    
    updateQuoteCount() {
        const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
        this.quoteCount.textContent = totalItems;
        
        // Update button color based on items
        if (totalItems > 0) {
            this.quoteToggle.classList.add('animate-pulse');
        } else {
            this.quoteToggle.classList.remove('animate-pulse');
        }
    }
    
    async exportToPdf() {
        if (this.items.length === 0) {
            this.showNotification('لا توجد منتجات في الاقتباس', 'warning');
            return;
        }
        
        try {
            this.showNotification('جاري إنشاء ملف PDF...', 'info');
            
            // Use the PDF generator
            const pdfData = await window.pdfGenerator.generateQuotePdf(this.items, this.total);
            
            // Create download link
            const blob = new Blob([pdfData], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `quote-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('تم تصدير الاقتباس بنجاح', 'success');
            
        } catch (error) {
            console.error('PDF Export Error:', error);
            this.showNotification('حدث خطأ في تصدير PDF', 'error');
        }
    }
    
    async sendQuote() {
        if (this.items.length === 0) {
            this.showNotification('لا توجد منتجات في الاقتباس', 'warning');
            return;
        }
        
        // Show email modal or redirect to quote form
        const email = prompt('أدخل عنوان البريد الإلكتروني لإرسال الاقتباس:');
        if (!email) return;
        
        try {
            const quoteData = {
                items: this.items.map(item => ({
                    name: item.product.name,
                    description: item.product.description,
                    price: item.product.price,
                    quantity: item.quantity,
                    pn: item.product.objectID
                })),
                total: this.total,
                client: {
                    email: email,
                    name: 'عميل من النظام الذكي'
                },
                date: new Date().toISOString().slice(0, 10),
                number: `AI-${Date.now()}`
            };
            
            const response = await fetch('/api/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData)
            });
            
            if (response.ok) {
                this.showNotification('تم إرسال الاقتباس بنجاح', 'success');
                // Optionally clear the quote
                if (confirm('هل تريد مسح الاقتباس الحالي؟')) {
                    this.clearQuote();
                }
            } else {
                throw new Error('Failed to send quote');
            }
            
        } catch (error) {
            console.error('Send Quote Error:', error);
            this.showNotification('حدث خطأ في إرسال الاقتباس', 'error');
        }
    }
    
    toggleQuoteView() {
        const quoteSection = document.querySelector('#quote-items').closest('.bg-qiq-gray');
        quoteSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    clearQuote() {
        this.items = [];
        this.total = 0;
        this.updateUI();
        this.saveQuote();
        this.showNotification('تم مسح الاقتباس', 'info');
    }
    
    saveQuote() {
        try {
            localStorage.setItem('qiq-quote', JSON.stringify({
                items: this.items,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Save quote error:', error);
        }
    }
    
    loadSavedQuote() {
        try {
            const savedQuote = localStorage.getItem('qiq-quote');
            if (savedQuote) {
                const data = JSON.parse(savedQuote);
                
                // Check if quote is not too old (24 hours)
                const isRecent = (Date.now() - data.timestamp) < (24 * 60 * 60 * 1000);
                
                if (isRecent && data.items) {
                    this.items = data.items;
                    console.log('💾 Loaded saved quote with', this.items.length, 'items');
                }
            }
        } catch (error) {
            console.error('Load quote error:', error);
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all transform translate-x-full opacity-0`;
        
        // Set colors based on type
        const colors = {
            success: 'bg-green-600 text-white',
            error: 'bg-red-600 text-white',
            warning: 'bg-yellow-600 text-white',
            info: 'bg-qiq-gold text-qiq-dark'
        };
        
        notification.className += ` ${colors[type] || colors.info}`;
        notification.innerHTML = `
            <div class="flex items-center space-x-2 space-x-reverse">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'} text-lg"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.quoteManager = new QuoteManager();
    console.log('💰 Quote manager initialized');
});