// /public/js/ui-chat.js
(function () {
  const PLACEHOLDER_IMG = "https://via.placeholder.com/68?text=IMG";
  const CHAT_HITS_PER_SEARCH = 5;

  const win = document.getElementById("qiq-window");
  const form = document.getElementById("qiq-form");
  const input = document.getElementById("qiq-input");
  const sendBtn = form.querySelector(".qiq-send");
  const importBtn = document.getElementById("qiq-import-btn");
  const fileInput = document.getElementById("qiq-file");
  const tbody = document.getElementById("qiq-body");
  const addAllBtn = document.getElementById("qiq-add-all");
  const statusEl = document.getElementById("qiq-status");
  const grandCell = document.getElementById("qiq-grand");
  const exportCsvBtn = document.getElementById("qiq-export-csv");
  const exportXlsxBtn = document.getElementById("qiq-export-xlsx");

  const modal = document.getElementById("qiq-modal");
  const modalClose = modal.querySelector(".qiq-modal__close");
  const modalFrame = document.getElementById("qiq-modal-frame");

  function addMsg(role, html, asHtml = false) {
    const wrap = document.createElement("div");
    wrap.className = "qiq-msg " + (role === "user" ? "user" : "bot");
    const bubble = document.createElement("div");
    bubble.className = "qiq-bubble"; bubble.dir = "auto";
    if (asHtml) bubble.innerHTML = html; else bubble.textContent = html;
    wrap.appendChild(bubble); win.appendChild(wrap);
    win.scrollTop = win.scrollHeight; return bubble;
  }

  // تحية أولى
  addMsg("bot", "أهلاً بك في QuickITQuote 👋\nهنسألك كام سؤال بسيط ونجهّز لك عرض مبدئي. ما اسم شركتك؟ / Welcome! What’s your company name?");

  // ===== Helpers =====
  const fmtUSD = v => {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    if (!isFinite(n) || n <= 0) return "-";
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  };
  const numFromPrice = v => Number(String(v || "").replace(/[^\d.]/g, "")) || 0;
  const esc = s => (s ?? "").toString().replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function arToEnDigits(s){ return String(s||"").replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0)-0x0660)); }
  function extractDesiredQty(text){
    const t = arToEnDigits(String(text||"").toLowerCase());
    const rx1 = /(\d{1,7})\s*(?:users?|مستخدم(?:ين)?|seat?s?|موظف(?:ين)?)/i;
    const m1 = t.match(rx1); if(m1) return Math.max(1, parseInt(m1[1],10));
    const tNoRanges = t.replace(/\d+\s*-\s*\d+/g, " "); const m2 = tNoRanges.match(/(\d{1,7})/);
    return m2 ? Math.max(1, parseInt(m2[1],10)) : 1;
  }
  function desiredYearsFromText(text){
    const t = arToEnDigits(String(text||""));
    const m = t.match(/(\d+)\s*(?:year|yr|سنة|سنين|سنوات)/i);
    return m ? parseInt(m[1],10) : null;
  }

  function rowKeyFromHit(h){
    const sku = (h.sku || h.SKU || h.pn || "").toString().trim();
    return sku ? sku.toUpperCase() : "";
  }

  function toCanon(h){
    const image = h["Image URL"] || h.image || h.image_url || h["image uri"] || h.thumbnail || h.images || h.img || "";
    const price = h["List Price"] || h.price || h.Price || h.list_price || h.price_usd || h.priceUSD || "";
    const pn    = h["Part Number"] || h.part_number || h.pn || h.PN || h.sku || h.SKU || h.product_code || h.item || h.code || h["رقم"] || h["كود"] || h["موديل"] || "";
    const link  = h.link || h.product_url || h.url || h.permalink || "";
    return {
      __canon: true,
      name: h.name || h.title || h.Description || "—",
      price, image,
      pn,
      sku: (h.sku || h.SKU || pn || "").toString().trim(),
      link,
      avail: h.Availability || h.status || ""
    };
  }

  // ===== Staging Table =====
  const rowsByKey = new Map();
  let raf = null;
  function scheduleTotals(){
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateStatusAndTotals);
  }
  function updateStatusAndTotals(){
    raf = null;
    const total = tbody.children.length;
    const addable = tbody.querySelectorAll("button[data-stage]:not(:disabled)").length;
    statusEl.textContent = `${total} بند. ${addable} قابل للإضافة.`;
    let grand = 0;
    tbody.querySelectorAll("tr").forEach(tr => {
      const unit = numFromPrice(tr.dataset.unit || "");
      const qty  = Math.max(1, parseInt(tr.querySelector(".qiq-qty")?.value || "1", 10));
      const line = unit * qty; const cell = tr.querySelector(".qiq-line");
      if (cell) cell.textContent = unit ? fmtUSD(line) : "-"; grand += line;
    });
    grandCell.textContent = grand ? fmtUSD(grand) : "-";
    addAllBtn.disabled = addable === 0;
  }

  function buildStagingRow(hitLike, sourceTag, defaultQty){
    const c = hitLike.__canon ? hitLike : toCanon(hitLike);
    const key = rowKeyFromHit(c);
    if (!key || rowsByKey.has(key)) return null;

    const img=c.image||PLACEHOLDER_IMG, desc=c.name||"(No name)";
    const unitPrice=c.price||"", unitNum=numFromPrice(unitPrice);
    const avail=c.avail||"", pn=c.pn||key;
    const link=c.link||"";
    const qty0=Math.max(1,parseInt(defaultQty||1,10));

    const tr=document.createElement("tr");
    tr.dataset.source=sourceTag||"Search"; tr.dataset.unit=unitPrice||"";
    tr.innerHTML = `
      <td><img class="qiq-img" src="${esc(img)}" alt="${esc(desc)}" onerror="this.src='${PLACEHOLDER_IMG}'"></td>
      <td>
        ${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${esc(link)}"><strong>${esc(desc)}</strong></a>`:`<strong>${esc(desc)}</strong>`}
        ${pn?`<div class="qiq-chip">PN/SKU: ${esc(pn)}</div>`:""}
        ${avail?`<div class="qiq-chip" style="background:#eef7ee;border-color:#d6f0d6">Availability: ${esc(avail)}</div>`:""}
        <div class="qiq-chip" style="background:#f5f5f5;border-color:#e5e7eb">Source: ${esc(tr.dataset.source)}</div>
      </td>
      <td>${unitPrice?fmtUSD(unitPrice):"-"}</td>
      <td class="qiq-line">${unitNum?fmtUSD(unitNum*qty0):"-"}</td>
      <td>
        <div class="qiq-actions-row">
          <input type="number" min="1" step="1" value="${qty0}" class="qiq-qty">
          <button class="qiq-btn" type="button" data-details="${esc(pn)}">تفاصيل</button>
          <button class="qiq-btn qiq-primary" type="button" data-stage="${esc(pn)}">Stage</button>
        </div>
      </td>
    `;
    tr.querySelector(".qiq-qty").addEventListener("input", scheduleTotals);
    rowsByKey.set(key,tr); return tr;
  }

  function renderStagingBatch(hitsOrCanon, sourceTag, defaultQty){
    if(!hitsOrCanon || !hitsOrCanon.length) return;
    const frag=document.createDocumentFragment(); let added=0;
    for(const h of hitsOrCanon){
      const tr=buildStagingRow(h, sourceTag, defaultQty);
      if(tr){ frag.appendChild(tr); added++; }
    }
    if(added){
      requestAnimationFrame(() => {
        tbody.appendChild(frag);
        scheduleTotals();
      });
    }
  }

  function buildInlineTable(title, hits, defaultQty){
    if(!hits || !hits.length) return "";
    const q=Math.max(1,parseInt(defaultQty||1,10));
    let rows="";
    for(const h of hits){
      const c = toCanon(h);
      const price = c.price ? fmtUSD(c.price) : "-";
      rows += `
        <tr>
          <td><img class="qiq-inline-img" src="${esc(c.image||PLACEHOLDER_IMG)}" alt="${esc(c.name)}" onerror="this.src='${PLACEHOLDER_IMG}'"></td>
          <td>
            <div><strong>${esc(c.name)}</strong></div>
            ${c.pn?`<div class="qiq-chip">PN/SKU: ${esc(c.pn)}</div>`:""}
          </td>
          <td>${price}</td>
          <td>
            <div class="qiq-inline-actions">
              <input type="number" min="1" value="${q}" class="qiq-qty qiq-inline-qty" style="width:72px">
              <button class="qiq-mini success" type="button" data-inline-stage='${esc(JSON.stringify(c))}'>Stage ↓</button>
              ${c.link?`<a class="qiq-mini" href="${esc(c.link)}" target="_blank" rel="noopener">Details</a>`:""}
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

  win.addEventListener("click", (e)=>{
    const stageBtn = e.target.closest("[data-inline-stage]");
    if(stageBtn){
      e.preventDefault(); e.stopPropagation();
      const c = JSON.parse(stageBtn.getAttribute("data-inline-stage") || "{}");
      const qtyInput = stageBtn.closest(".qiq-inline-actions")?.querySelector(".qiq-inline-qty");
      const q = Math.max(1, parseInt(qtyInput?.value || "1", 10));
      stageBtn.disabled = true; const old = stageBtn.textContent; stageBtn.textContent = "Staging…";
      requestAnimationFrame(() => {
        renderStagingBatch([c], "Chat", q);
        stageBtn.textContent = "Staged ✓";
        setTimeout(()=>{ stageBtn.textContent = old; stageBtn.disabled=false; }, 600);
      });
    }
  });

  // Modal (تفاصيل)
  function openModal(url){ modalFrame.src=url; modal.classList.add("active"); modal.setAttribute("aria-hidden","false"); }
  function closeModal(){ modal.classList.remove("active"); modal.setAttribute("aria-hidden","true"); modalFrame.src=""; }
  modalClose.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeModal(); });
  modal.addEventListener("click",(e)=>{ if(e.target.classList.contains("qiq-modal__backdrop")){ e.preventDefault(); e.stopPropagation(); closeModal(); }});

  // Add All → دلوقتي معناها مجرد Staging مسبق (لو عايز تضيف integration لاحقاً ابعته لباك إند)
  addAllBtn.addEventListener("click", (e)=>{
    e.preventDefault(); e.stopPropagation();
    alert("كل البنود في الجدول جاهزة للتصدير/الإرسال ضمن طلب العرض.");
  });

  // Export CSV/XLSX
  function collectTableData(){
    const data=[]; let grand=0;
    tbody.querySelectorAll("tr").forEach(tr=>{
      const img=tr.querySelector("img")?.src||"";
      const name=tr.querySelector("strong")?.textContent||"";
      const pn=(tr.querySelector(".qiq-chip")?.textContent||"").replace(/^\s*PN\/SKU:\s*/i,"").trim();
      const unitPrice=tr.dataset.unit||""; const unitNum=numFromPrice(unitPrice);
      const qty=Math.max(1,parseInt(tr.querySelector(".qiq-qty")?.value||"1",10));
      const link=tr.querySelector(".qiq-link")?.href||"";
      const source=tr.dataset.source||"";
      const line=unitNum*qty; grand+=line;
      data.push({Image:img,Name:name,PN_SKU:pn,UnitPrice:unitPrice,Qty:qty,LineTotal:line?fmtUSD(line):"-",Link:link,Source:source});
    });
    return {rows:data, grand};
  }
  function downloadBlob(filename, blob){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
  }
  function ts(){ const d=new Date(); const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }

  exportCsvBtn.addEventListener("click", ()=>{
    const {rows,grand}=collectTableData(); if(!rows.length) return alert("No rows to export.");
    const headers=Object.keys(rows[0]);
    const body=rows.map(r=>headers.map(h=>`"${String(r[h]).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const footer=`\r\n"","","Grand total","",,"${fmtUSD(grand)}","",`;
    const csv=[headers.join(","),body,footer].join("\r\n");
    downloadBlob(`qiq-staged-${ts()}.csv`, new Blob([csv],{type:"text/csv;charset=utf-8"}));
  });

  exportXlsxBtn.addEventListener("click", ()=>{
    if (typeof XLSX === "undefined") return alert("XLSX library not loaded");
    const {rows,grand}=collectTableData(); if(!rows.length) return alert("No rows to export.");
    const ws=XLSX.utils.json_to_sheet(rows); const last=rows.length+2;
    XLSX.utils.sheet_add_aoa(ws,[["Grand total","","","", "", fmtUSD(grand)]],{origin:`A${last}`});
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"QIQ Staged");
    const out=XLSX.write(wb,{bookType:"xlsx",type:"array"});
    downloadBlob(`qiq-staged-${ts()}.xlsx`, new Blob([out],{type:"application/octet-stream"}));
  });

  // ===== Chat Submit =====
  async function aSearch(query, hits = CHAT_HITS_PER_SEARCH) {
    const r = await API.searchProducts(query, hits);
    return r.hits || [];
  }

  function scoreHitForQtyAndYears(hit, qty, wantYears){
    const name = hit?.name || hit?.title || hit?.Description || "";
    const s = arToEnDigits(String(name||""));
    let min=null,max=null,years=null;
    let m = s.match(/(\d+)\s*\+\s*(?:user|seat|license)/i);
    if(m){ min=parseInt(m[1],10); max=Number.POSITIVE_INFINITY; }
    m = s.match(/(\d+)\s*-\s*(\d+)\s*(?:user|seat|license)/i);
    if(m){ min=parseInt(m[1],10); max=parseInt(m[2],10); }
    m = s.match(/(\d+)\s*(?:year|yr|سنة|سنين|سنوات)/i);
    if(m){ years=parseInt(m[1],10); }
    let score = 0;
    if(min!=null){
      if(max===Infinity && qty>=min) score += 1000;
      else if(max!=null && qty>=min && qty<=max) score += 1000;
      else if(max!=null){ const closest = qty < min ? (min-qty) : (qty-max); score += Math.max(0, 300 - closest); }
    }
    if(wantYears==null){ if(years===1) score += 40; }
    else{ if(years===wantYears) score += 60; else if(years!=null) score += Math.max(0, 40 - Math.abs(years - wantYears)*10); }
    const priceNum = numFromPrice(hit["List Price"] || hit.price || hit.Price || hit.list_price || hit.price_usd || hit.priceUSD || "");
    if(priceNum>0) score += Math.max(0, 50 - Math.log10(priceNum+1)*10);
    return -score;
  }

  form.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); form.dispatchEvent(new Event("qiq-send")); }});
  form.addEventListener("submit", (e)=>{ e.preventDefault(); form.dispatchEvent(new Event("qiq-send")); });

  form.addEventListener("qiq-send", async ()=>{
    const userText=(input.value||"").trim(); if(!userText) return;
    input.value=""; addMsg("user", userText);

    const bubble = addMsg("bot","…"); sendBtn.disabled=true;
    try{
      // استنتاج بسيط
      const qty = extractDesiredQty(userText);
      const yrs = desiredYearsFromText(userText);

      // نبحث بكذا صيغة بسيطة
      const queries = Array.from(new Set([
        userText,
        userText + " license",
        userText + " users",
      ])).slice(0, 5);

      // نجمع النتائج ونرتّبها
      let pool = [];
      for (const q of queries) {
        const hits = await aSearch(q, CHAT_HITS_PER_SEARCH);
        pool = pool.concat(hits||[]);
      }
      const seen = new Set(), uniq=[];
      for(const h of pool){
        const key = (h.objectID || h.sku || h.SKU || h.pn || "").toString();
        if(!key || seen.has(key)) continue; seen.add(key); uniq.push(h);
      }
      uniq.sort((a,b)=> scoreHitForQtyAndYears(a, qty, yrs) - scoreHitForQtyAndYears(b, qty, yrs));

      if(uniq.length){
        bubble.innerHTML = buildInlineTable("Matches & alternatives", uniq.slice(0, CHAT_HITS_PER_SEARCH), qty || 1);
      }else{
        bubble.textContent = "ملقيناش تطابق حرفي، جرّب مصطلحات أبسط أو ادخل PN/SKU.";
      }
    }catch(err){
      bubble.textContent = `حصل خطأ: ${err.message}`;
    }finally{
      sendBtn.disabled=false; win.scrollTop=win.scrollHeight;
    }
  });
})();
