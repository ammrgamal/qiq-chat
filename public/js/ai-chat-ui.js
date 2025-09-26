// AI Chat UI Controller
class AIChatUI {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-chat');
        this.clearButton = document.getElementById('clear-chat');
        this.floatingHelp = document.getElementById('floating-help');
        
        this.messages = [];
        this.isTyping = false;
        
        this.init();
    }
    
    init() {
        // Set welcome timestamp
        document.getElementById('welcome-time').textContent = new Date().toLocaleTimeString('ar-SA');
        
        // Event listeners
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.clearButton.addEventListener('click', () => this.clearChat());
        this.floatingHelp.addEventListener('click', () => this.focusChat());
        
        // Auto-scroll to bottom
        this.scrollToBottom();
    }
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;
        
        // Add user message
        this.addMessage('user', message);
        this.chatInput.value = '';
        
        // Show typing indicator
        this.showTyping();
        
        try {
            // Send to AI backend
            const response = await this.callAI(message);
            this.hideTyping();
            this.addMessage('assistant', response);
        } catch (error) {
            this.hideTyping();
            this.addMessage('assistant', 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.');
            console.error('AI Chat Error:', error);
        }
    }
    
    async callAI(message) {
        // Check if V0 API is available
        const hasV0 = await this.checkV0API();
        
        if (hasV0) {
            return await this.callV0API(message);
        } else {
            // Fallback to OpenAI or local processing
            return await this.callOpenAI(message);
        }
    }
    
    async checkV0API() {
        try {
            const response = await fetch('/health');
            const health = await response.json();
            return health.env?.hasV0API || false;
        } catch (error) {
            return false;
        }
    }
    
    async callV0API(message) {
        const response = await fetch('/api/v0-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                context: 'product_assistance',
                language: 'arabic'
            })
        });
        
        if (!response.ok) throw new Error('V0 API Error');
        
        const data = await response.json();
        return data.response || 'عذراً، لم أتمكن من فهم طلبك.';
    }
    
    async callOpenAI(message) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                context: 'أنت مساعد ذكي متخصص في منتجات تكنولوجيا المعلومات. ساعد العملاء في العثور على المنتجات المناسبة وأجب على استفساراتهم باللغة العربية.'
            })
        });
        
        if (!response.ok) {
            // Fallback responses for common queries
            return this.getFallbackResponse(message);
        }
        
        const data = await response.json();
        return data.response || this.getFallbackResponse(message);
    }
    
    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('سويتش') || lowerMessage.includes('switch')) {
            return 'لدينا مجموعة متنوعة من السويتشات المُدارة وغير المُدارة. يمكنني مساعدتك في اختيار السويتش المناسب حسب عدد المنافذ والميزات المطلوبة. ما هي متطلباتك المحددة؟';
        }
        
        if (lowerMessage.includes('راوتر') || lowerMessage.includes('router')) {
            return 'نوفر راوترات للشركات بمختلف الأحجام والمواصفات. هل تحتاج راوتر للمكتب الصغير أم لشبكة المؤسسة؟ وما هي سرعة الإنترنت المطلوبة؟';
        }
        
        if (lowerMessage.includes('كابل') || lowerMessage.includes('cable')) {
            return 'لدينا كابلات شبكات عالية الجودة Cat6, Cat6a, وFiber Optic. ما هي المسافة المطلوبة وسرعة النقل المرغوبة؟';
        }
        
        if (lowerMessage.includes('سعر') || lowerMessage.includes('price')) {
            return 'يمكنني مساعدتك في الحصول على أفضل الأسعار. أضف المنتجات المطلوبة إلى سلة الاقتباس وسأقوم بإعداد عرض سعر مخصص لك.';
        }
        
        return 'شكراً لك على تواصلك معنا! يمكنني مساعدتك في اختيار المنتجات المناسبة لمشروعك. هل يمكنك إخباري بالمزيد عن احتياجاتك؟';
    }
    
    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'chat-bubble-user p-4 rounded-xl max-w-md ml-auto' : 'chat-bubble-assistant p-4 rounded-xl max-w-md';
        
        const timestamp = new Date().toLocaleTimeString('ar-SA');
        const senderName = sender === 'user' ? 'أنت' : 'المساعد';
        const icon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
        
        messageDiv.innerHTML = `
            <div class="flex items-center mb-2">
                <i class="${icon} ${sender === 'user' ? 'text-qiq-dark' : 'text-qiq-gold'} mr-2"></i>
                <span class="font-semibold">${senderName}</span>
                <span class="text-xs ${sender === 'user' ? 'text-qiq-dark/70' : 'text-gray-400'} mr-auto">${timestamp}</span>
            </div>
            <p class="leading-relaxed">${text}</p>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.messages.push({ sender, text, timestamp });
        this.scrollToBottom();
    }
    
    showTyping() {
        this.isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'chat-bubble-assistant p-4 rounded-xl max-w-md';
        typingDiv.innerHTML = `
            <div class="flex items-center mb-2">
                <i class="fas fa-robot text-qiq-gold mr-2"></i>
                <span class="font-semibold">المساعد</span>
                <span class="text-xs text-gray-400 mr-auto">يكتب...</span>
            </div>
            <div class="flex space-x-1">
                <div class="w-2 h-2 bg-qiq-gold rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-qiq-gold rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-qiq-gold rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTyping() {
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) typingDiv.remove();
        this.isTyping = false;
    }
    
    clearChat() {
        if (confirm('هل تريد مسح جميع الرسائل؟')) {
            this.chatMessages.innerHTML = `
                <div class="chat-bubble-assistant p-4 rounded-xl max-w-md">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-robot text-qiq-gold mr-2"></i>
                        <span class="font-semibold">المساعد</span>
                        <span class="text-xs text-gray-400 mr-auto">${new Date().toLocaleTimeString('ar-SA')}</span>
                    </div>
                    <p>مرحباً بك مرة أخرى! كيف يمكنني مساعدتك اليوم؟</p>
                </div>
            `;
            this.messages = [];
        }
    }
    
    focusChat() {
        this.chatInput.focus();
        document.querySelector('.chat-area').scrollIntoView({ behavior: 'smooth' });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Theme Controller
class ThemeController {
    constructor() {
        this.themeToggle = document.getElementById('theme-toggle');
        this.isDark = true; // Default to dark theme
        
        this.init();
    }
    
    init() {
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    toggleTheme() {
        this.isDark = !this.isDark;
        
        if (this.isDark) {
            document.body.className = 'bg-qiq-dark text-white';
            this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.className = 'bg-white text-gray-900';
            this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
        
        // Update all qiq-dark and qiq-gray elements
        this.updateThemeElements();
    }
    
    updateThemeElements() {
        // This would need more sophisticated theme switching
        // For now, we'll keep the dark theme as primary
        console.log('Theme switched to:', this.isDark ? 'dark' : 'light');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChatUI();
    window.themeController = new ThemeController();
    
    console.log('🤖 AI Chat UI initialized');
    console.log('🎨 Theme controller initialized');
});