/* =========================================================================
   QIQ Chat UI – unified NL chat + product search rendering
   Works with /api/chat (الملف اللي ادّتهولك قبل كده)
   يعتمد إن في الصفحة DOM elements:
   - #qiq-window لعرض الرسائل
   - form#qiq-form وفيه input#qiq-input وزر submit
   ويقبل وجود دوال اختيارية:
   - window.qiqAddToQuote(sku, qty, slug?)    // لإضافة المنتج للعرض
   - window.qiqStage(hitLike, defaultQty)     // لعمل staging في الجدول
   ========================================================================= */

(() => {
  /* ===== DOM ===== */
  const win    = document.getElementById("qiq-window");
  const form   = document.getElementById("qiq-form");
  const input  = document.getElementById("qiq-input");
  const sendBtn= form?.querySelector("button[type='submit']") || form?.querySelector(".qiq-send");

  if (!win || !form || !input) {
    console.warn("[QIQ] Missing base DOM elements (#qiq-window, #qiq-form, #qiq-input).");
    return;
  }

  /* ===== Helpers ===== */
  const esc = s => (s??"").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const mdToHtml = (md) => {
    if (!md) return "";
    md = String(md).replace(/\\n/g, "\n");
    const linkify = (t) => esc(t)
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g,'<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    const lines = md.split(/\r?\n/); let html="", inOl=false, inUl=false;
    const close=()=>{ if(inOl){html+="</ol>";inOl=false} if(inUl){html+="</ul>";inUl=false} };
    for(const line of lines){
      if (/^\s*\d+\.\s+/.test(line)){ const it=line.replace(/^\s*\d+\.\s+/, ''); if(!inOl){close(); html+="<ol>"; inOl=true} html+=`<li>${linkify(it)}</li>`; }
      else if (/^\s*[-*]\s+/.test(line)){ const it=line.replace(/^\s*[-*]\s+/, ''); if(!inUl){close(); html+="<ul>"; inUl=true} html+=`<li>${linkify(it)}</li>`; }
      else if (!line.trim()){ close(); }
      else { close(); html+=`<p>${linkify(line)}</p>`; }
    }
    close(); return html;
  };

  function addMsg(role, html, asHtml=false) {
    const wrap = document.createElement("div");
    wrap.className = "qiq-msg " + (role === "user" ? "user" : "bot");
    const bubble = document.createElement("div");
    bubble.className = "qiq-bubble"; bubble.dir = "auto";
    if (asHtml) bubble.innerHTML = html; else bubble.textContent = html;
    wrap.appendChild(bubble); win.appendChild(wrap);
    win.scrollTop = win.scrollHeight; 
    return bubble;
  }

  /* ===== البداية ===== */
  const messages = [{
    role: "system",
    content: "أنت QuickITQuote Intake & Shopping Assistant."
  }];

  addMsg("bot",
    "أهلاً بك في QuickITQuote 👋\nاسأل عن منتج أو رخصة، أو استخدم زر “Import BOQ”.", false
  );

  /* ===== ريندر النتائج (Hits) ===== */
  function renderHits(hits) {
    if (!Array.isArray(hits) || !hits.length) return;

    const rows = hits.slice(0, 5).map(h => {
      const name  = h.name || h.title || h.Description || "-";
      const img   = h.image || h["Image URL"] || h.thumbnail || "";
      const sku   = h.sku || h.SKU || h.pn || h["Part Number"] || "";
      const price = h.price ?? h.Price ?? h["List Price"] ?? "";
      const link  = h.link || h.product_url || h.url || h.permalink || "";

      return `
        <div class="qiq-inline" style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;padding:8px;border:1px solid #eee;border-radius:10px;">
          <img src="${esc(img)}" alt="" style="width:58px;height:58px;object-fit:contain;border:1px solid #eee;border-radius:8px;background:#fff" onerror="this.style.display='none'">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700">${esc(name)}</div>
            ${sku ? `<div class="qiq-chip" style="display:inline-block;background:#eef2ff;border:1px solid #dbe1ff;border-radius:8px;padding:2px 8px;margin-top:6px;font-size:12px">PN/SKU: ${esc(sku)}</div>` : ""}
            ${price ? `<div class="qiq-chip" style="display:inline-block;background:#f5f5f5;border:1px solid #e5e7eb;border-radius:8px;padding:2px 8px;margin-top:6px;font-size:12px">Price: ${esc(price)}</div>` : ""}
            ${link ? `<div style="margin-top:6px"><a class="qiq-link" target="_blank" rel="noopener" href="${esc(link)}">Open product</a></div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="qiq-mini primary" type="button" data-sku="${esc(sku)}" data-link="${esc(link)}">Add</button>
            <button class="qiq-mini" type="button" data-stage='${esc(JSON.stringify(h))}'>Stage</button>
          </div>
        </div>
      `;
    }).join("");

    addMsg("bot", `<div class="qiq-section-title">Matches</div>${rows}`, true);
  }

  // أحداث أزرار Add/Stage داخل نتائج الهتس
  win.addEventListener("click", async (e) => {
    const addBtn = e.target.closest("button.qiq-mini.primary[data-sku]");
    const stageBtn = e.target.closest("button.qiq-mini[data-stage]");

    if (addBtn) {
      e.preventDefault();
      const sku  = addBtn.getAttribute("data-sku") || "";
      const link = addBtn.getAttribute("data-link") || "";
      if (typeof window.qiqAddToQuote === "function" && sku) {
        addBtn.disabled = true; const old = addBtn.textContent; addBtn.textContent = "Adding…";
        try { await window.qiqAddToQuote(sku, 1, link ? (new URL(link, location.origin).pathname.split("/").filter(Boolean).pop()||"") : ""); }
        catch {}
        addBtn.textContent = "Added ✓"; setTimeout(()=>{ addBtn.textContent = old; addBtn.disabled=false; }, 700);
      } else {
        alert("AddToQuote غير مفعّل في هذه الصفحة.");
      }
    }

    if (stageBtn) {
      e.preventDefault();
      try {
        const hit = JSON.parse(stageBtn.getAttribute("data-stage")||"{}");
        if (typeof window.qiqStage === "function") {
          stageBtn.disabled = true; const old = stageBtn.textContent; stageBtn.textContent="Staging…";
          await window.qiqStage(hit, 1);
          stageBtn.textContent="Staged ✓"; setTimeout(()=>{ stageBtn.textContent=old; stageBtn.disabled=false; }, 700);
        } else {
          alert("Staging غير مفعّل في هذه الصفحة.");
        }
      } catch {}
    }
  });

  /* ===== إرسال الرسالة إلى /api/chat ===== */
  async function sendChat(userText) {
    const bubble = addMsg("bot", "…");
    sendBtn && (sendBtn.disabled = true);

    try {
      messages.push({ role: "user", content: userText });

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages })
      });
      const data = await r.json();

      const reply = data?.reply || "تم.";
      bubble.innerHTML = mdToHtml(reply) || esc(reply);

      // خزّن ردّ المساعد في التاريخ
      messages.push({ role: "assistant", content: reply });

      // لو فيه hits، اعرضها
      if (Array.isArray(data?.hits) && data.hits.length) {
        renderHits(data.hits);
      }
    } catch (err) {
      bubble.textContent = `حصل خطأ أثناء الاتصال بالخادم: ${err?.message || err}`;
    } finally {
      sendBtn && (sendBtn.disabled = false);
      win.scrollTop = win.scrollHeight;
    }
  }

  /* ===== Events ===== */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const txt = (input.value || "").trim();
    if (!txt) return;
    input.value = "";
    addMsg("user", txt);
    sendChat(txt);
  });

  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });
})();
