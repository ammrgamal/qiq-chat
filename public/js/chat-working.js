// الحل المبسط - نسخة تعمل
(() => {
  // DOM Elements
  const win = document.getElementById("qiq-window");
  const form = document.getElementById("qiq-form");
  const input = document.getElementById("qiq-input");
  const sendBtn = form?.querySelector(".qiq-send");
  const searchBtn = document.getElementById("qiq-search-btn");
  
  // Constants
  const API = {
    CHAT: "/api/chat",
    SEARCH: "/api/search"
  };
  
  // State
  let isLoading = false;
  const messages = [{
    role: "system",
    content: "أنت مساعد QuickITQuote. ساعد العميل في العثور على المنتجات المناسبة."
  }];
  
  // Helpers
  function esc(str) {
    return (str ?? "").toString()
      .replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[m]);
  }
  
  function addMessage(role, content) {
    const wrap = document.createElement("div");
    wrap.className = `qiq-msg ${role}`;
    
    const bubble = document.createElement("div");
    bubble.className = "qiq-bubble";
    bubble.textContent = content;
    bubble.dir = "auto";
    
    wrap.appendChild(bubble);
    win.appendChild(wrap);
    win.scrollTop = win.scrollHeight;
  }
  
  function setLoading(isEnabled) {
    isLoading = isEnabled;
    sendBtn.disabled = isEnabled;
    searchBtn.disabled = isEnabled;
    
    if (isEnabled) {
      addMessage("bot", "جاري البحث...");
    }
  }
  
  function displayProducts(products) {
    if (!products?.length) return;
    
    const container = document.getElementById("search-results");
    if (!container) return;
    
    container.innerHTML = products.map(p => `
      <div class="product-card">
        <img src="${esc(p.image || 'https://via.placeholder.com/100')}" 
             alt="${esc(p.name)}"
             class="product-image">
        <div class="product-info">
          <h3>${esc(p.name)}</h3>
          ${p.sku ? `<div class="sku">رقم المنتج: ${esc(p.sku)}</div>` : ''}
          ${p.price ? `<div class="price">السعر: $${esc(p.price)}</div>` : ''}
        </div>
        <button onclick="window.addToQuote(${esc(JSON.stringify(p))})"
                class="add-btn">إضافة للعرض</button>
      </div>
    `).join('');
    
    container.style.display = 'block';
  }
  
  // Main Handler
  async function handleMessage(userText) {
    if (!userText?.trim() || isLoading) return;
    
    // Add user message
    addMessage("user", userText);
    messages.push({ role: "user", content: userText });
    
    // Show loading
    setLoading(true);
    
    try {
      // Make API calls in parallel
      const [chatRes, searchRes] = await Promise.all([
        fetch(API.CHAT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages })
        }),
        fetch(API.SEARCH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userText })
        })
      ]);
      
      // Process chat response
      if (!chatRes.ok) throw new Error("Chat API failed");
      const chatData = await chatRes.json();
      const botReply = chatData.choices?.[0]?.message?.content 
                   || chatData.content 
                   || "عذراً، لم أفهم الرسالة";
      
      // Process search response
      if (!searchRes.ok) throw new Error("Search API failed");
      const searchData = await searchRes.json();
      const products = searchData.hits || [];
      
      // Update UI
      setLoading(false);
      addMessage("bot", botReply);
      messages.push({ role: "assistant", content: botReply });
      
      if (products.length > 0) {
        displayProducts(products);
        addMessage("bot", `وجدت ${products.length} منتج مناسب 👆`);
      }
      
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      addMessage("bot", "عذراً، حدث خطأ. حاول مرة أخرى.");
    }
  }
  
  // Event Listeners
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      input.value = "";
      handleMessage(text);
    }
  });
  
  searchBtn?.addEventListener("click", () => {
    const text = input.value.trim();
    if (text) {
      input.value = "";
      handleMessage(text);
    }
  });
  
  // Global functions
  window.addToQuote = (product) => {
    console.log("Adding to quote:", product);
    alert("تمت إضافة المنتج إلى عرض السعر");
  };
  
  // Welcome message
  addMessage("bot", `مرحباً بك في QuickITQuote! 👋
• يمكنك البحث عن منتج باسمه أو رقمه
• طلب توصيات لحلول تقنية
• طرح أي أسئلة عن المنتجات`);
  
})();