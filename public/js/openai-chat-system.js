/**
 * نظام الشات الذكي المحسن مع OpenAI Assistant API
 * Enhanced Intelligent Chat System with OpenAI Assistant Integration
 * 
 * Assistant ID: asst_OYoqbbkPzgI6kojL6iliOiM (Sales and Presales Agent)
 */

// متغيرات النظام
let chatThreadId = null;
let chatHistory = [];
let isProcessing = false;
let currentSession = null;

/**
 * تهيئة نظام الشات المحسن مع OpenAI Assistant
 */
async function initializeOpenAIChatSystem() {
    try {
        // إنشاء thread جديد للمحادثة
        await createChatThread();
        
        // إعداد معالجات الأحداث
        setupChatEventHandlers();
        
        // إعداد واجهة الشات
        setupChatInterface();
        
        // رسالة ترحيب ذكية
        await sendWelcomeMessage();
        
        console.log('✅ OpenAI Chat System initialized successfully');
        
    } catch (error) {
        console.error('❌ OpenAI Chat System initialization failed:', error);
        // التبديل إلى النمط الاحتياطي
        initializeFallbackChat();
    }
}

/**
 * إنشاء thread جديد للمحادثة مع OpenAI Assistant
 */
async function createChatThread() {
    try {
        // التحقق من وجود thread محفوظ
        const savedThreadId = localStorage.getItem('qiq_openai_thread_id');
        if (savedThreadId) {
            chatThreadId = savedThreadId;
            console.log('Using existing OpenAI thread:', chatThreadId);
            return;
        }
        
        const response = await fetch('/api/openai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_thread' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            chatThreadId = result.thread_id;
            localStorage.setItem('qiq_openai_thread_id', chatThreadId);
            console.log('New OpenAI thread created:', chatThreadId);
        } else {
            throw new Error('Failed to create OpenAI chat thread');
        }
        
    } catch (error) {
        console.error('OpenAI thread creation error:', error);
        chatThreadId = `fallback_${Date.now()}`;
    }
}

/**
 * إرسال رسالة للمساعد الذكي OpenAI
 */
async function sendMessageToOpenAIAssistant(message, userContext = {}) {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        // إضافة السياق من الصفحة الحالية
        const enhancedContext = {
            ...userContext,
            page: detectCurrentPage(),
            timestamp: new Date().toISOString(),
            user_session: currentSession?.session_id,
            url: window.location.href
        };
        
        // إضافة المنتجات المحددة إذا كانت متاحة
        if (window.qiqQuoteItems && window.qiqQuoteItems.length > 0) {
            enhancedContext.quote_items = window.qiqQuoteItems.length;
            enhancedContext.products = window.qiqQuoteItems.map(item => item.name);
        }
        
        // إرسال مباشر للـ API
        const response = await fetch('/api/openai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                thread_id: chatThreadId,
                user_context: enhancedContext
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // تحديث thread_id إذا تم إنشاء واحد جديد
            if (result.thread_id && result.thread_id !== chatThreadId) {
                chatThreadId = result.thread_id;
                localStorage.setItem('qiq_openai_thread_id', chatThreadId);
            }
            
            return {
                response: result.response,
                tokens_used: result.tokens_used,
                success: true
            };
        } else if (result.fallback) {
            return {
                response: result.response || getFallbackResponse(message),
                success: false,
                fallback: true
            };
        } else {
            throw new Error(result.message || 'OpenAI Assistant request failed');
        }
        
    } catch (error) {
        console.error('OpenAI Assistant message error:', error);
        return {
            response: getFallbackResponse(message),
            success: false,
            error: error.message
        };
    } finally {
        isProcessing = false;
    }
}

/**
 * إعداد معالجات أحداث الشات
 */
function setupChatEventHandlers() {
    // معالج إرسال الرسائل من الحقل الرئيسي
    const chatInput = document.getElementById('qiq-input');
    const sendButton = document.getElementById('qiq-send');
    
    if (chatInput && sendButton) {
        // إرسال بالضغط على Enter
        chatInput.addEventListener('keypress', async function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await handleUserMessage();
            }
        });
        
        // إرسال بالنقر على الزر
        sendButton.addEventListener('click', async function(e) {
            e.preventDefault();
            await handleUserMessage();
        });
    }
    
    // البحث عن حقول إدخال أخرى في الصفحة
    const alternativeInputs = document.querySelectorAll('input[placeholder*="رسالة"], input[placeholder*="message"], textarea[placeholder*="رسالة"]');
    alternativeInputs.forEach(input => {
        input.addEventListener('keypress', async function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = input.value.trim();
                if (message) {
                    input.value = '';
                    await processUserMessage(message);
                }
            }
        });
    });
    
    // معالج الأزرار السريعة
    document.addEventListener('click', async function(e) {
        if (e.target.matches('.qiq-quick-action') || e.target.closest('.qiq-quick-action')) {
            const button = e.target.matches('.qiq-quick-action') ? e.target : e.target.closest('.qiq-quick-action');
            const action = button.dataset.action;
            const message = button.dataset.message;
            
            if (message) {
                await processUserMessage(message, { action: action });
            }
        }
    });
}

/**
 * معالجة رسالة المستخدم من الحقل الرئيسي
 */
async function handleUserMessage() {
    const chatInput = document.getElementById('qiq-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // مسح حقل الإدخال
    chatInput.value = '';
    
    // معالجة الرسالة
    await processUserMessage(message);
}

/**
 * معالجة الرسالة وعرض الرد
 */
async function processUserMessage(message, context = {}) {
    try {
        // عرض رسالة المستخدم
        displayChatMessage(message, 'user');
        
        // إضافة مؤشر التحميل
        const loadingId = showLoadingIndicator();
        
        // إرسال للمساعد الذكي OpenAI
        const result = await sendMessageToOpenAIAssistant(message, context);
        
        // إزالة مؤشر التحميل
        hideLoadingIndicator(loadingId);
        
        // عرض رد المساعد
        displayChatMessage(result.response, 'assistant', {
            tokens_used: result.tokens_used,
            success: result.success,
            fallback: result.fallback
        });
        
        // حفظ في التاريخ
        chatHistory.push({
            user: message,
            assistant: result.response,
            timestamp: new Date().toISOString(),
            context: context,
            success: result.success
        });
        
        // إضافة أزرار تفاعلية إذا لزم الأمر
        addInteractiveButtons(result.response);
        
        // تتبع التفاعل
        if (typeof trackInteraction === 'function') {
            trackInteraction('chat_message', {
                message_length: message.length,
                response_length: result.response.length,
                success: result.success,
                openai_used: !result.fallback
            });
        }
        
        // تتبع التحويل إذا كان طلب سعر
        if (message.includes('سعر') || message.includes('عرض')) {
            if (typeof trackConversion === 'function') {
                trackConversion('quote_interest', {
                    message: message,
                    response: result.response
                });
            }
        }
        
    } catch (error) {
        console.error('Message processing error:', error);
        hideLoadingIndicator();
        displayChatMessage('عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.', 'system');
    }
}

/**
 * عرض رسالة في الشات
 */
function displayChatMessage(message, sender, metadata = {}) {
    const chatWindow = document.getElementById('qiq-window') || document.querySelector('.qiq-window');
    if (!chatWindow) {
        console.warn('Chat window not found, creating alternative display');
        createAlternativeChatDisplay(message, sender);
        return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `qiq-message qiq-message-${sender}`;
    
    // إضافة الوقت
    const timestamp = new Date().toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let messageHTML = `
        <div class="qiq-message-content">${formatMessage(message)}</div>
        <div class="qiq-message-time">${timestamp}</div>
    `;
    
    // إضافة معلومات إضافية للمساعد
    if (sender === 'assistant') {
        if (metadata.tokens_used) {
            messageHTML += `<div class="qiq-message-meta">الذكاء الاصطناعي • ${metadata.tokens_used} رمز</div>`;
        } else if (metadata.fallback) {
            messageHTML += `<div class="qiq-message-meta">الوضع الاحتياطي</div>`;
        }
        
        if (!metadata.success) {
            messageElement.classList.add('qiq-message-fallback');
        }
    }
    
    messageElement.innerHTML = messageHTML;
    chatWindow.appendChild(messageElement);
    
    // التمرير للأسفل
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * إنشاء عرض شات بديل إذا لم توجد النافذة الأساسية
 */
function createAlternativeChatDisplay(message, sender) {
    let alternativeChat = document.getElementById('qiq-alternative-chat');
    
    if (!alternativeChat) {
        alternativeChat = document.createElement('div');
        alternativeChat.id = 'qiq-alternative-chat';
        alternativeChat.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            max-height: 400px;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            z-index: 10000;
            overflow-y: auto;
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = 'font-weight: bold; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;';
        header.textContent = 'QuickITQuote Chat';
        alternativeChat.appendChild(header);
        
        document.body.appendChild(alternativeChat);
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin: 8px 0;
        padding: 8px 12px;
        border-radius: 8px;
        background: ${sender === 'user' ? '#3b82f6' : '#f1f5f9'};
        color: ${sender === 'user' ? 'white' : '#1f2937'};
        font-size: 14px;
        line-height: 1.4;
    `;
    messageDiv.innerHTML = formatMessage(message);
    
    alternativeChat.appendChild(messageDiv);
    alternativeChat.scrollTop = alternativeChat.scrollHeight;
}

/**
 * تنسيق الرسائل (دعم Markdown بسيط)
 */
function formatMessage(message) {
    return message
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#e5e7eb;padding:2px 4px;border-radius:3px;">$1</code>')
        .replace(/\n/g, '<br>');
}

/**
 * عرض مؤشر التحميل
 */
function showLoadingIndicator() {
    const loadingId = `loading_${Date.now()}`;
    const chatWindow = document.getElementById('qiq-window') || document.querySelector('.qiq-window');
    
    if (chatWindow) {
        const loadingElement = document.createElement('div');
        loadingElement.id = loadingId;
        loadingElement.className = 'qiq-message qiq-message-system qiq-loading';
        loadingElement.innerHTML = `
            <div class="qiq-message-content">
                <div class="qiq-typing-indicator">
                    <span></span><span></span><span></span>
                </div>
                يفكر المساعد الذكي...
            </div>
        `;
        
        chatWindow.appendChild(loadingElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    return loadingId;
}

/**
 * إخفاء مؤشر التحميل
 */
function hideLoadingIndicator(loadingId = null) {
    if (loadingId) {
        const element = document.getElementById(loadingId);
        if (element) element.remove();
    } else {
        // إزالة جميع مؤشرات التحميل
        const loadingElements = document.querySelectorAll('.qiq-loading');
        loadingElements.forEach(el => el.remove());
    }
}

/**
 * إضافة أزرار تفاعلية بناءً على محتوى الرد
 */
function addInteractiveButtons(response) {
    const chatWindow = document.getElementById('qiq-window') || document.querySelector('.qiq-window');
    if (!chatWindow) return;
    
    const buttonsToAdd = [];
    
    // اكتشاف المحتوى وإضافة أزرار مناسبة
    if (response.includes('منتج') || response.includes('معدات') || response.includes('كتالوج')) {
        buttonsToAdd.push({
            text: '📋 عرض الكتالوج',
            action: 'view_catalog',
            url: '/products-list.html'
        });
    }
    
    if (response.includes('سعر') || response.includes('عرض') || response.includes('تكلفة')) {
        buttonsToAdd.push({
            text: '💰 طلب عرض سعر',
            action: 'request_quote',
            url: '/quote.html'
        });
    }
    
    if (response.includes('دعم') || response.includes('مساعدة') || response.includes('تواصل')) {
        buttonsToAdd.push({
            text: '📞 تحدث مع المبيعات',
            action: 'contact_sales',
            message: 'أريد التحدث مع فريق المبيعات للحصول على استشارة مخصصة'
        });
    }
    
    if (response.includes('خادم') || response.includes('server')) {
        buttonsToAdd.push({
            text: '🖥️ استكشف الخوادم',
            action: 'explore_servers',
            message: 'أريد معرفة المزيد عن خوادمكم المتاحة'
        });
    }
    
    if (buttonsToAdd.length > 0) {
        const buttonsElement = document.createElement('div');
        buttonsElement.className = 'qiq-interactive-buttons';
        
        buttonsElement.innerHTML = buttonsToAdd.map(btn => `
            <button class="qiq-quick-action btn secondary" 
                    data-action="${btn.action}" 
                    data-message="${btn.message || ''}"
                    ${btn.url ? `onclick="window.location.href='${btn.url}'"` : ''}
                    style="margin: 4px; padding: 6px 12px; font-size: 13px;">
                ${btn.text}
            </button>
        `).join('');
        
        chatWindow.appendChild(buttonsElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

/**
 * إرسال رسالة ترحيب ذكية
 */
async function sendWelcomeMessage() {
    const welcomeMessage = 'مرحباً بك في QuickITQuote! 👋\n\nأنا مساعدك الذكي المتخصص في المبيعات والاستشارات التقنية. أساعدك في:\n\n• العثور على أفضل معدات IT\n• تقديم استشارات تقنية\n• إعداد عروض أسعار مخصصة\n• الإجابة على أسئلتك الفنية\n\nكيف يمكنني مساعدتك اليوم؟';
    
    setTimeout(() => {
        displayChatMessage(welcomeMessage, 'assistant', { tokens_used: null });
        
        // إضافة أزرار بداية سريعة
        addQuickStartButtons();
    }, 1000);
}

/**
 * إضافة أزرار البداية السريعة
 */
function addQuickStartButtons() {
    const chatWindow = document.getElementById('qiq-window') || document.querySelector('.qiq-window');
    if (!chatWindow) return;
    
    const quickStartElement = document.createElement('div');
    quickStartElement.className = 'qiq-quick-start';
    quickStartElement.innerHTML = `
        <div class="qiq-quick-start-title">🚀 بداية سريعة:</div>
        <div class="qiq-quick-start-buttons">
            <button class="qiq-quick-action btn secondary" data-message="أحتاج خوادم للشركة - ما المتاح لديكم؟">🖥️ خوادم</button>
            <button class="qiq-quick-action btn secondary" data-message="أريد أجهزة حاسوب مكتبية للموظفين">💻 أجهزة حاسوب</button>
            <button class="qiq-quick-action btn secondary" data-message="أبحث عن حلول شبكات متكاملة">🌐 حلول شبكات</button>
            <button class="qiq-quick-action btn secondary" data-message="ما هي الخدمات التي تقدمونها؟">ℹ️ خدماتنا</button>
        </div>
    `;
    
    chatWindow.appendChild(quickStartElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

/**
 * إعداد واجهة الشات بأنماط محسنة
 */
function setupChatInterface() {
    // إضافة أنماط CSS للشات المحسن
    const chatStyles = document.createElement('style');
    chatStyles.id = 'openai-chat-styles';
    chatStyles.textContent = `
        .qiq-message-assistant {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            position: relative;
        }
        
        .qiq-message-assistant::before {
            content: '🤖';
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 12px;
            opacity: 0.7;
        }
        
        .qiq-message-fallback {
            background: #fbbf24;
            color: #92400e;
        }
        
        .qiq-message-user {
            background: #3b82f6;
            color: white;
            margin-left: 40px;
        }
        
        .qiq-message-system {
            background: #f3f4f6;
            color: #374151;
            font-style: italic;
            text-align: center;
        }
        
        .qiq-typing-indicator {
            display: inline-flex;
            gap: 4px;
            margin-left: 8px;
            align-items: center;
        }
        
        .qiq-typing-indicator span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            animation: qiq-typing 1.5s ease-in-out infinite;
        }
        
        .qiq-typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .qiq-typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes qiq-typing {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
        }
        
        .qiq-interactive-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 8px 0;
            padding: 0 12px;
        }
        
        .qiq-quick-start {
            margin: 12px;
            padding: 12px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 10px;
            border: 1px solid #cbd5e1;
        }
        
        .qiq-quick-start-title {
            font-weight: 600;
            margin-bottom: 10px;
            color: #1e293b;
            font-size: 14px;
        }
        
        .qiq-quick-start-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .qiq-quick-start-buttons button {
            font-size: 12px;
            padding: 4px 8px;
        }
        
        .qiq-message-meta {
            font-size: 10px;
            opacity: 0.8;
            margin-top: 4px;
            text-align: right;
        }
        
        .qiq-message-time {
            font-size: 10px;
            opacity: 0.6;
            margin-top: 4px;
            text-align: left;
        }
        
        #qiq-alternative-chat {
            direction: rtl;
            text-align: right;
        }
        
        /* تحسين الاستجابة للشاشات الصغيرة */
        @media (max-width: 480px) {
            #qiq-alternative-chat {
                width: calc(100vw - 40px);
                right: 20px;
                left: 20px;
            }
            
            .qiq-quick-start-buttons {
                flex-direction: column;
            }
        }
    `;
    
    // إزالة الأنماط القديمة إذا كانت موجودة
    const oldStyles = document.getElementById('openai-chat-styles');
    if (oldStyles) oldStyles.remove();
    
    document.head.appendChild(chatStyles);
}

/**
 * نظام احتياطي للشات
 */
function initializeFallbackChat() {
    console.log('🔄 Initializing fallback chat system');
    
    // إعداد معالجات بسيطة
    setupChatEventHandlers();
    setupChatInterface();
    
    // رسالة ترحيب احتياطية
    setTimeout(() => {
        displayChatMessage('مرحباً بك! أنا في الوضع الأساسي. كيف يمكنني مساعدتك؟', 'system');
        addBasicButtons();
    }, 500);
}

/**
 * إضافة أزرار أساسية للوضع الاحتياطي
 */
function addBasicButtons() {
    const chatWindow = document.getElementById('qiq-window') || document.querySelector('.qiq-window');
    if (!chatWindow) return;
    
    const basicButtons = document.createElement('div');
    basicButtons.className = 'qiq-interactive-buttons';
    basicButtons.innerHTML = `
        <button onclick="window.location.href='/products-list.html'" class="btn secondary">عرض المنتجات</button>
        <button onclick="window.location.href='/quote.html'" class="btn secondary">طلب عرض سعر</button>
    `;
    
    chatWindow.appendChild(basicButtons);
}

// وظائف مساعدة
function detectCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('products-list')) return 'catalog';
    if (path.includes('quote')) return 'quote';
    if (path === '/' || path.includes('index')) return 'home';
    return 'unknown';
}

function getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // ردود ذكية بناءً على الكلمات المفتاحية
    if (lowerMessage.includes('سعر') || lowerMessage.includes('price') || lowerMessage.includes('تكلفة')) {
        return '💰 يمكنني مساعدتك في الحصول على أفضل الأسعار لمعدات IT. يرجى تحديد المنتجات التي تحتاجها وسأقوم بإعداد عرض سعر مخصص لك.\n\n📋 يمكنك أيضاً زيارة صفحة المنتجات لتصفح العروض المتاحة.';
    }
    
    if (lowerMessage.includes('خادم') || lowerMessage.includes('server') || lowerMessage.includes('سيرفر')) {
        return '🖥️ لدينا مجموعة واسعة من الخوادم من أفضل الماركات العالمية مثل HP، Dell، وLenovo.\n\n📊 ما هي متطلباتك التقنية والميزانية المتاحة؟\n• خوادم الويب\n• خوادم قواعد البيانات\n• خوادم الملفات\n• خوادم التطبيقات';
    }
    
    if (lowerMessage.includes('حاسوب') || lowerMessage.includes('لابتوب') || lowerMessage.includes('laptop') || lowerMessage.includes('computer')) {
        return '💻 نوفر أحدث أجهزة الحاسوب للشركات والمؤسسات:\n\n• أجهزة مكتبية للمكاتب\n• أجهزة محمولة للعمل المتنقل\n• محطات عمل متخصصة\n\n🤔 هل تبحث عن مواصفات معينة أم تحتاج استشارة لاختيار الأنسب؟';
    }
    
    if (lowerMessage.includes('شبكة') || lowerMessage.includes('network') || lowerMessage.includes('راوتر') || lowerMessage.includes('سويتش')) {
        return '🌐 نقدم حلول شبكات متكاملة تشمل:\n\n• أجهزة الراوتر والسويتش\n• نقاط الوصول اللاسلكي\n• أمان الشبكات\n• التركيب والصيانة\n\n📏 ما حجم الشبكة التي تحتاجها وعدد المستخدمين؟';
    }
    
    if (lowerMessage.includes('دعم') || lowerMessage.includes('مساعدة') || lowerMessage.includes('help')) {
        return '🆘 أنا هنا لمساعدتك! يمكنني تقديم:\n\n• معلومات عن المنتجات\n• استشارات تقنية\n• عروض أسعار مخصصة\n• توصيات حسب احتياجاتك\n\n💬 ما الذي تحتاج معرفته تحديداً؟';
    }
    
    // رد عام ودود
    const generalResponses = [
        '👋 أهلاً بك! أنا مساعدك في QuickITQuote. كيف يمكنني مساعدتك في العثور على أفضل معدات IT؟',
        '😊 مرحباً! أنا هنا لأساعدك في اختيار المنتجات التقنية المناسبة لاحتياجاتك. ما الذي تبحث عنه؟',
        '🤝 أهلاً وسهلاً! دعني أساعدك في العثور على الحلول التقنية المثالية لشركتك. ما هي متطلباتك؟',
        '✨ مرحباً بك! كوني متخصص في معدات IT، يمكنني مساعدتك في اتخاذ القرار الصحيح. كيف أساعدك؟'
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
}

// تصدير الوظائف للاستخدام العام
if (typeof window !== 'undefined') {
    window.initializeOpenAIChatSystem = initializeOpenAIChatSystem;
    window.sendMessageToOpenAIAssistant = sendMessageToOpenAIAssistant;
    window.displayChatMessage = displayChatMessage;
    window.processUserMessage = processUserMessage;
    
    // Backward compatibility
    window.initializeFixedChatSystem = initializeOpenAIChatSystem;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOpenAIChatSystem);
    } else {
        // DOM is already loaded
        setTimeout(initializeOpenAIChatSystem, 100);
    }
}

// تصدير للـ Node.js إذا لزم الأمر
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeOpenAIChatSystem,
        sendMessageToOpenAIAssistant,
        displayChatMessage
    };
}