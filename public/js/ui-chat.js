/* /public/js/ui-chat.js
   QIQ Chat UI (Algolia via server API)
   --------------------------------------------------------- */

(() => {
  /* ====== DOM ====== */
  const win    = document.getElementById("qiq-window");
  const form   = document.getElementById("qiq-form");
  const input  = document.getElementById("qiq-input");
  const sendBtn= form.querySelector(".qiq-send");

  // BOQ + Table
  const importBtn = document.getElementById("qiq-import-btn");
  const fileInput = document.getElementById("qiq-file");
  const tbody  = document.getElementById("qiq-body");
  const addAllBtn = document.getElementById("qiq-add-all");
  const statusEl  = document.getElementById("qiq-status");
  const grandCell = document.getElementById("qiq-grand");
  const exportCsvBtn  = document.getElementById("qiq-export-csv");
  const exportXlsxBtn = document.getElementById("qiq-export-xlsx");

  // Modal
  const modal = document.getElementById("qiq-modal");
  const modalClose = modal?.querySelector(".qiq-modal__close");
  const modalFrame = document.getElementById("qiq-modal-frame");

  // Helpers
  const PLACEHOLDER_IMG = "https://via.placeholder.com/68?text=IMG";
  const fmtUSD=(v)=> {
    const n = Number(String(v||"").replace(/[^\d.]/g,""));
    if(!isFinite(n)) return "-";
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  };
  const numFromPrice=v=> Number(String(v||"").replace(/[^\d.]/g,"")) || 0;
  const esc=s=> (s??"").toString().replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  /* ====== Toast ====== */
  const toast = (() => {
    const box = document.createElement("div");
    box.className = "qiq-toast"; document.body.appendChild(box);
    return (html) => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = html + '<button class="close" aria-label="Close" type="button">×</button>';
      box.appendChild(el);
      el.querySelector(".close").addEventListener("click", (ev)=>{ev.preventDefault();ev.stopPropagation(); el.remove();});
      setTimeout(() => el.remove(), 5000);
    };
  })();

  /* ====== Chat UI ====== */
  function addMsg(role, html, asHtml=false) {
    const wrap = document.createElement("div");
    wrap.className = "qiq-msg " + (role === "user" ? "user" : "bot");
    const bubble = document.createElement("div");
    bubble.className = "qiq-bubble"; bubble.dir = "auto";
    if (asHtml) bubble.innerHTML = html; else bubble.textContent = html;
    wrap.appendChild(bubble); win.appendChild(wrap);
    win.scrollTop = win.scrollHeight; return bubble;
  }
  addMsg("bot","أهلاً بك في QuickITQuote 👋\nاسأل عن منتج أو رخصة، أو استخدم زر “البحث عن منتجات”.");

  /* ====== Modal ====== */
  function openModal(url){ if(!modal) return; modalFrame.src=url; modal.classList.add("active"); modal.setAttribute("aria-hidden","false"); }
  function closeModal(){ if(!modal) return; modal.classList.remove("active"); modal.setAttribute("aria-hidden","true"); modalFrame.src=""; }
  modalClose?.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation(); closeModal();});
  modal?.addEventListener("click",(e)=>{ if(e.target.classList.contains("qiq-modal__backdrop")){ e.preventDefault();e.stopPropagation(); closeModal(); }});

  /* ====== Server API wrappers ====== */
  async function apiSearch(query, hitsPerPage=5) {
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({ query, hitsPerPage })
      });
      if(!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      return Array.isArray(j?.hits) ? j.hits : [];
    } catch (e) {
      console.warn("search error:", e);
      toast("⚠️ حصل خطأ في البحث.");
      return [];
    }
  }

  async function apiChat(messages) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({ messages })
      });
      if(!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      return String(j?.reply || "").trim();
    } catch (e) {
      console.warn("chat error:", e);
      return "";
    }
  }

  /* ====== Inline results (cards table) ====== */
  const STORE = new Map(); let STORE_SEQ = 1;
  const stash = (obj)=>{ const id=String(STORE_SEQ++); STORE.set(id,obj); return id; };

  function toCanon(hit) {
    // أطراف شائعة للاسم/الصورة/السعر/اللينك/الـ SKU
    const name = hit?.name || hit?.title || hit?.Description || "—";
    const price = hit?.price ?? hit?.Price ?? hit?.list_price ?? "";
    const image = hit?.image || hit?.thumbnail || hit?.images?.[0] || "";
    const sku   = (hit?.sku || hit?.SKU || hit?.pn || hit?.code || "").toString().trim();
    const link  = hit?.permalink || hit?.url || hit?.product_url || "";
    return { name, price, image, sku, link };
  }

  function buildInlineTable(title, hits, defaultQty=1){
    if(!hits?.length) return "";
    const q = Math.max(1, parseInt(defaultQty||1,10));
    let rows="";
    for(const h of hits){
      const c = toCanon(h);
      const id = stash(c);
      rows += `
        <tr>
          <td><img class="qiq-inline-img" src="${esc(c.image||PLACEHOLDER_IMG)}" alt="${esc(c.name)}" onerror="this.src='${PLACEHOLDER_IMG}'"></td>
          <td>
            <div><strong>${esc(c.name)}</strong></div>
            ${c.sku?`<div class="qiq-chip">PN/SKU: ${esc(c.sku)}</div>`:""}
            ${c.link?`<div class="qiq-chip"><a class="qiq-link" href="${esc(c.link)}" target="_blank" rel="noopener">Product page</a></div>`:""}
          </td>
          <td>${c.price?fmtUSD(c.price):"-"}</td>
          <td>
            <div class="qiq-inline-actions">
              <input type="number" min="1" value="${q}" class="qiq-qty qiq-inline-qty" style="width:72px">
              <button class="qiq-mini primary" type="button" data-inline-add="${id}">Add to quotation</button>
              <button class="qiq-mini success" type="button" data-inline-stage="${id}">Stage ↓</button>
              ${c.link?`<button class="qiq-mini" type="button" data-inline-details="${id}">Details</button>`:""}
            </div>
          </td>
        </tr>
      `;
    }
    return `
      <div class="qiq-section-title">${esc(title)}</div>
      <div class="qiq-inline-wrap">
        <table class="qiq-inline-table">
          <thead><tr><th>Image</th><th>Description / PN</th><th>Unit price</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  /* ====== Staging table & totals ====== */
  const rowsByKey = new Map(); let raf=null;
  function scheduleTotals(){ if(raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(updateStatusAndTotals); }
  function updateStatusAndTotals(){
    raf=null;
    const total = tbody.children.length;
    statusEl.textContent = `${total} item(s) listed.`;
    let grand=0;
    tbody.querySelectorAll("tr").forEach(tr=>{
      const unit=numFromPrice(tr.dataset.unit||"");
      const qty =Math.max(1,parseInt(tr.querySelector(".qiq-qty")?.value||"1",10));
      const line=unit*qty; const cell=tr.querySelector(".qiq-line");
      if(cell) cell.textContent=unit?fmtUSD(line):"-"; grand+=line;
    });
    grandCell.textContent=grand?fmtUSD(grand):"-";
    addAllBtn.disabled = total===0;
  }

  function buildStagingRow(c, sourceTag="Search", qty0=1){
    const key = (c.sku || c.name).toString().trim().toUpperCase();
    if(!key || rowsByKey.has(key)) return null;

    const img=c.image||PLACEHOLDER_IMG, desc=c.name||"(No name)";
    const unitPrice=c.price||"", unitNum=numFromPrice(unitPrice);
    const link=c.link||"";

    const tr=document.createElement("tr");
    tr.dataset.source=sourceTag; tr.dataset.unit=unitPrice||"";
    tr.innerHTML=`
      <td><img class="qiq-img" src="${esc(img)}" alt="${esc(desc)}" onerror="this.src='${PLACEHOLDER_IMG}'"></td>
      <td>
        ${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${esc(link)}"><strong>${esc(desc)}</strong></a>`:`<strong>${esc(desc)}</strong>`}
        ${c.sku?`<div class="qiq-chip">PN/SKU: ${esc(c.sku)}</div>`:""}
        <div class="qiq-chip" style="background:#f5f5f5;border-color:#e5e7eb">Source: ${esc(sourceTag)}</div>
      </td>
      <td>${unitPrice?fmtUSD(unitPrice):"-"}</td>
      <td class="qiq-line">${unitNum?fmtUSD(unitNum*qty0):"-"}</td>
      <td>
        <div class="qiq-actions-row">
          <input type="number" min="1" step="1" value="${qty0}" class="qiq-qty">
          ${link?`<button class="qiq-btn" type="button" data-detail-link="${esc(link)}">Product details</button>`:""}
        </div>
      </td>
    `;
    tr.querySelector(".qiq-qty").addEventListener("input", scheduleTotals);
    tr.querySelector('[data-detail-link]')?.addEventListener('click', (ev)=>{ev.preventDefault();ev.stopPropagation(); openModal(link);});
    rowsByKey.set(key,tr);
    return tr;
  }

  function renderStagingBatch(canonList, sourceTag, qty){
    if(!canonList?.length) return;
    const frag=document.createDocumentFragment();
    let added=0;
    for(const c of canonList){ const tr=buildStagingRow(c, sourceTag, qty); if(tr){ frag.appendChild(tr); added++; } }
    if(added){ tbody.appendChild(frag); scheduleTotals(); }
  }

  /* ====== Click handlers for inline actions ====== */
  win.addEventListener("click", (e)=>{
    const addBtn   = e.target.closest("[data-inline-add]");
    const stageBtn = e.target.closest("[data-inline-stage]");
    const detBtn   = e.target.closest("[data-inline-details]");

    if(addBtn){
      e.preventDefault(); e.stopPropagation();
      const id=addBtn.getAttribute("data-inline-add"); const c=STORE.get(id); if(!c) return;
      const qtyInput = addBtn.closest(".qiq-inline-actions")?.querySelector(".qiq-inline-qty");
      const qty = Math.max(1, parseInt(qtyInput?.value||"1",10));
      // هنا تقدر تبعت للسلة بتاعت وووكومرس لو لاحقًا (حالياً بنجهّز بس)
      renderStagingBatch([c], "Chat", qty);
      toast("تمت إضافة البند إلى جدول التجهيز.");
    }

    if(stageBtn){
      e.preventDefault(); e.stopPropagation();
      const id=stageBtn.getAttribute("data-inline-stage"); const c=STORE.get(id); if(!c) return;
      const qtyInput = stageBtn.closest(".qiq-inline-actions")?.querySelector(".qiq-inline-qty");
      const q = Math.max(1, parseInt(qtyInput?.value||"1",10));
      renderStagingBatch([c], "Chat", q);
      toast("تمت إضافة البند إلى جدول التجهيز.");
    }

    if(detBtn){
      e.preventDefault(); e.stopPropagation();
      const id=detBtn.getAttribute("data-inline-details"); const c=STORE.get(id); if(!c || !c.link) return;
      openModal(c.link);
    }
  });

  /* ====== Chat send ====== */
  const chatMessages = [{
    role: "system",
    content: "You are QIQ assistant. Reply Arabic then English briefly."
  }];

  form.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); form.dispatchEvent(new Event("qiq-send")); }});
  form.addEventListener("submit", (e)=>{ e.preventDefault(); form.dispatchEvent(new Event("qiq-send")); });

  form.addEventListener("qiq-send", async ()=>{
    const userText=(input.value||"").trim(); if(!userText) return;
    input.value=""; addMsg("user", userText);

    // 1) نجيب نتائج منتجات قريبة من الطلب
    const bubble = addMsg("bot","…");
    sendBtn.disabled=true;

    try {
      const hits = await apiSearch(userText, 5);
      if(hits.length){
        const html = buildInlineTable("Matches & alternatives", hits, 1);
        bubble.innerHTML = html;
      } else {
        // 2) لو مفيش نتائج، نرد من الشات/LLM لو عايز
        chatMessages.push({role:"user", content:userText});
        const reply = await apiChat(chatMessages);
        bubble.textContent = reply || "ملقيناش تطابق حرفي. جرّب توضح أكتر أو ارفع BOQ من الزر تحت.";
      }
    } catch(e){
      bubble.textContent = "حصل خطأ أثناء المعالجة.";
    } finally {
      sendBtn.disabled=false; win.scrollTop=win.scrollHeight;
    }
  });

  /* ====== BOQ import (Excel/CSV) ====== */
  importBtn?.addEventListener("click", (e)=>{ e.preventDefault();e.stopPropagation(); fileInput.click(); });
  fileInput?.addEventListener("change", async (e)=>{
    const f=e.target.files?.[0]; if(!f) return; statusEl.textContent="Parsing file…";
    try{
      const buf=await f.arrayBuffer();
      // نحمّل XLSX من الـ CDN (موجود في index.html)
      const wb=XLSX.read(buf,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      if(!rows.length){ statusEl.textContent="Empty sheet."; return; }

      const header=Object.keys(rows[0]).map(String);
      const lc=s=>String(s).toLowerCase();
      const keyPN=header.find(h=>["part number","part_number","pn","sku","product_code","item","code","رقم","كود","موديل"].includes(lc(h)));
      const keyDesc=header.find(h=>/desc|وصف/i.test(h)) || header[0];

      statusEl.textContent="Matching items…";
      let matched=0; const staged=[];
      for(const r of rows){
        const want=String(keyPN? r[keyPN]:"").trim();
        const fallback=String(r[keyDesc]||"").trim();
        const q=want||fallback; if(!q) continue;
        const hits=await apiSearch(q, 1);
        if(hits[0]){ matched++; staged.push(toCanon(hits[0])); }
      }
      renderStagingBatch(staged, "BOQ", 1);
      statusEl.textContent=`Done. Matched ${matched} / ${rows.length}.`;
      toast("BOQ imported.");
    }catch(err){
      console.error(err); statusEl.textContent="Failed to read file."; toast("Failed to import file.");
    }finally{ fileInput.value=""; }
  });

  /* ====== Export (CSV/XLSX) ====== */
  function collectTableData(){
    const data=[]; let grand=0;
    tbody.querySelectorAll("tr").forEach(tr=>{
      const img=tr.querySelector("img")?.src||"";
      const name=tr.querySelector("strong")?.textContent||"";
      const pn=(tr.querySelector(".qiq-chip")?.textContent||"").replace(/^\s*PN\/SKU:\s*/i,"").trim();
      const unitPrice=tr.dataset.unit||"";
      const unitNum=numFromPrice(unitPrice);
      const qty=Math.max(1,parseInt(tr.querySelector(".qiq-qty")?.value||"1",10));
      const link=tr.querySelector(".qiq-link")?.href||"";
      const source=tr.dataset.source||"";
      const line=unitNum*qty; grand+=line;
      data.push({Image:img,Name:name,PN_SKU:pn,UnitPrice:unitPrice,Qty:qty,LineTotal:line?fmtUSD(line):"-",Link:link,Source:source});
    });
    return {rows:data, grand};
  }
  function downloadBlob(filename, blob){
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
  }
  function ts(){ const d=new Date(); const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }

  exportCsvBtn?.addEventListener("click", (e)=>{
    e.preventDefault();e.stopPropagation();
    const {rows,grand}=collectTableData(); if(!rows.length){ toast("No rows to export."); return; }
    const headers=Object.keys(rows[0]); const body=rows.map(r=>headers.map(h=>`"${String(r[h]).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const footer=`\r\n"","","Grand total","",,"${fmtUSD(grand)}","",`; const csv=[headers.join(","),body,footer].join("\r\n");
    downloadBlob(`qiq-staged-${ts()}.csv`, new Blob([csv],{type:"text/csv;charset=utf-8"}));
  });

  exportXlsxBtn?.addEventListener("click", (e)=>{
    e.preventDefault();e.stopPropagation();
    const {rows,grand}=collectTableData(); if(!rows.length){ toast("No rows to export."); return; }
    const ws=XLSX.utils.json_to_sheet(rows); const last=rows.length+2;
    XLSX.utils.sheet_add_aoa(ws,[["Grand total","","","", "", fmtUSD(grand)]],{origin:`A${last}`});
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"QIQ Staged");
    const out=XLSX.write(wb,{bookType:"xlsx",type:"array"});
    downloadBlob(`qiq-staged-${ts()}.xlsx`, new Blob([out],{type:"application/octet-stream"}));
  });

})();
