/**
 * نظام QuickITQuote للدردشة والبحث
 * =============================
 * 
 * الملفات الأساسية:
 * 1. chat.html - واجهة المستخدم
 * 2. chat.js - منطق الدردشة والبحث
 * 3. chat.css - التنسيقات
 * 
 * كيف يعمل النظام:
 * 1. المستخدم يكتب رسالة/استفسار
 * 2. النظام يرسل الرسالة إلى:
 *    - API الدردشة (/api/chat) للحصول على رد
 *    - API البحث (/api/search) للبحث عن المنتجات
 * 3. يعرض النظام:
 *    - رد المساعد
 *    - نتائج البحث عن المنتجات
 * 
 * المتطلبات:
 * 1. Algolia للبحث عن المنتجات
 * 2. OpenAI للدردشة الذكية
 * 3. ملف .env.local للإعدادات السرية
 */

// ========= النسخة المبسطة من النظام =========

// 1. تهيئة النظام
const initChat = () => {
    // التأكد من وجود العناصر المطلوبة
    const elements = {
        window: document.getElementById("qiq-window"),
        form: document.getElementById("qiq-form"),
        input: document.getElementById("qiq-input"),
        results: document.getElementById("search-results")
    };
    
    if (!validateElements(elements)) {
        console.error("عناصر HTML الأساسية غير موجودة");
        return null;
    }
    
    return elements;
};

// 2. التحقق من العناصر
const validateElements = (elements) => {
    const missing = Object.entries(elements)
        .filter(([key, el]) => !el)
        .map(([key]) => key);
    
    if (missing.length > 0) {
        console.error("العناصر المفقودة:", missing);
        return false;
    }
    
    return true;
};

// 3. إرسال رسالة للدردشة
const sendChatMessage = async (message) => {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [{ role: "user", content: message }] })
        });
        
        if (!response.ok) throw new Error("فشل الاتصال");
        return await response.json();
        
    } catch (error) {
        console.error("خطأ في الدردشة:", error);
        throw error;
    }
};

// 4. البحث عن المنتجات
const searchProducts = async (query) => {
    try {
        const response = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) throw new Error("فشل البحث");
        return await response.json();
        
    } catch (error) {
        console.error("خطأ في البحث:", error);
        throw error;
    }
};

// 5. عرض رسالة في نافذة الدردشة
const displayMessage = (window, role, content) => {
    const div = document.createElement("div");
    div.className = `qiq-msg ${role}`;
    div.innerHTML = `<div class="qiq-bubble">${content}</div>`;
    window.appendChild(div);
    window.scrollTop = window.scrollHeight;
};

// 6. عرض نتائج البحث
const displayResults = (container, products) => {
    if (!products?.length) return;
    
    container.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image || 'placeholder.jpg'}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>رقم المنتج: ${product.sku || '-'}</p>
            <button onclick="addToQuote(${JSON.stringify(product)})">
                إضافة للعرض
            </button>
        </div>
    `).join("");
    
    container.style.display = "block";
};

// 7. المعالج الرئيسي
const handleUserInput = async (elements, userText) => {
    try {
        // إظهار رسالة المستخدم
        displayMessage(elements.window, "user", userText);
        
        // إظهار حالة التحميل
        const loadingMsg = displayMessage(elements.window, "bot", "جاري المعالجة...");
        
        // طلب البيانات بالتوازي
        const [chatResponse, searchResponse] = await Promise.all([
            sendChatMessage(userText),
            searchProducts(userText)
        ]);
        
        // إخفاء رسالة التحميل
        loadingMsg.remove();
        
        // عرض رد المساعد
        if (chatResponse.content) {
            displayMessage(elements.window, "bot", chatResponse.content);
        }
        
        // عرض نتائج البحث
        if (searchResponse.hits?.length > 0) {
            displayResults(elements.results, searchResponse.hits);
            displayMessage(elements.window, "bot", 
                `وجدت ${searchResponse.hits.length} منتج مناسب. تحقق من النتائج أعلاه 👆`);
        }
        
    } catch (error) {
        displayMessage(elements.window, "bot", 
            "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.");
    }
};

// تصدير الدوال الرئيسية
export {
    initChat,
    handleUserInput,
    displayMessage,
    displayResults
};