(function(){
  'use strict';

  function ab2b64(buf){
    try{
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x8000;
      for (let i=0; i<bytes.length; i+=chunk){
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
      }
      return btoa(binary);
    }catch{ return null; }
  }

  async function loadFontToVfs(url, name){
    try{
      const res = await fetch(url, { mode:'cors' });
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      const b64 = ab2b64(buf);
      if (!b64) return false;
      window.pdfMake = window.pdfMake || {};
      window.pdfMake.vfs = window.pdfMake.vfs || {};
      window.pdfMake.vfs[name] = b64;
      return true;
    }catch{ return false; }
  }

  function registerArabicFonts(){
    if (!window.pdfMake) return false;
    window.pdfMake.fonts = Object.assign({}, window.pdfMake.fonts || {}, {
      Arabic: {
        normal: 'NotoNaskhArabic-Regular.ttf',
        bold: 'NotoKufiArabic-Regular.ttf',
        italics: 'NotoNaskhArabic-Regular.ttf',
        bolditalics: 'NotoKufiArabic-Regular.ttf'
      }
    });
    return true;
  }

  async function ensureArabicFonts(){
    if (!window.pdfMake) return false;
    const has = (window.pdfMake.vfs && window.pdfMake.vfs['NotoNaskhArabic-Regular.ttf']);
    if (has) { registerArabicFonts(); return true; }
    // Try local fonts folder first
    const ok1 = await loadFontToVfs('/fonts/NotoNaskhArabic-Regular.ttf', 'NotoNaskhArabic-Regular.ttf');
    const ok2 = await loadFontToVfs('/fonts/NotoKufiArabic-Regular.ttf', 'NotoKufiArabic-Regular.ttf');
    if (ok1 || ok2) { registerArabicFonts(); return true; }
    return false;
  }

  window.ensureArabicFonts = ensureArabicFonts;
})();
