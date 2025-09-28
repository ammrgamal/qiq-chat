(function(){
  const STORAGE_KEY = 'qiq_currency_code_v1';
  const RATES_KEY = 'qiq_currency_rates_v1';
  const RATES_TTL_MS = 12 * 60 * 60 * 1000; // 12h

  function loadCurrency(){
    try { return localStorage.getItem(STORAGE_KEY) || 'USD'; } catch { return 'USD'; }
  }
  function saveCurrency(code){
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }

  function loadRates(){
    try {
      const raw = localStorage.getItem(RATES_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.ts || !obj.usd) return null;
      if (Date.now() - obj.ts > RATES_TTL_MS) return null;
      return obj.usd; // map of { eur: rate, egp: rate, ... }
    } catch { return null; }
  }

  async function fetchRates(){
    try {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('rates HTTP '+r.status);
      const j = await r.json();
      const usd = j && j.usd ? j.usd : null;
      if (usd) {
        try { localStorage.setItem(RATES_KEY, JSON.stringify({ ts: Date.now(), usd })); } catch {}
      }
      return usd;
    } catch { return null; }
  }

  let currencyCode = loadCurrency().toUpperCase();
  let cachedRates = loadRates();

  async function ensureRates(){
    if (cachedRates) return cachedRates;
    cachedRates = await fetchRates();
    return cachedRates || {};
  }

  function getRate(to){
    const code = String(to||'USD').toLowerCase();
    if (code === 'usd') return 1;
    const r = cachedRates && cachedRates[code];
    return typeof r === 'number' && r > 0 ? r : 1;
  }

  function convert(amountUSD, to){
    const n = Number(amountUSD||0);
    const rate = getRate(to||currencyCode);
    return n * rate;
  }

  function format(amountUSD, opts={}){
    const code = (opts.code || currencyCode || 'USD').toUpperCase();
    const n = convert(amountUSD, code);
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n); }
    catch { return code + ' ' + n.toFixed(2); }
  }

  function setCurrency(code){
    const c = String(code||'USD').toUpperCase();
    currencyCode = c;
    saveCurrency(c);
    try { window.dispatchEvent(new CustomEvent('qiq-currency-changed', { detail: { code: c } })); } catch {}
  }

  // Public API
  window.QiqCurrency = {
    get currencyCode(){ return currencyCode; },
    setCurrency,
    ensureRates,
    getRate,
    convert,
    format
  };

  // Warm rates in background
  ensureRates();
})();
