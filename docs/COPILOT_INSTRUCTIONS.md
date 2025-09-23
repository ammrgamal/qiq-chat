## GitHub Copilot Instructions – Fix PDF Export for Professional Quote (QuickITQuote)

Goal: Generate a professional PDF quote that mimics the QuoteWerks layout, includes product images, avoids Arabic unless user-provided, and uses proper fonts.

### 1) PDF Font & Unicode Fix
- Replace default fonts with a clean, Unicode-complete font (Roboto/Open Sans/Arial) via pdfmake.
- Example:

```
fonts: {
  Roboto: {
    normal: 'fonts/Roboto-Regular.ttf',
    bold: 'fonts/Roboto-Bold.ttf',
    italics: 'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-BoldItalic.ttf'
  }
}
```

- Ensure the chosen font supports English, numbers, and provides light Arabic fallback.
- Remove or convert Arabic strings automatically if not client-provided.

### 2) Show Product Images in Quote Table
- Display product thumbnail in BOQ table.
- Source: `product.image` or `product.thumbnail`.
- Add a new column or include image inside Description cell.
- Suggested size: width 60px, height 60px, objectFit: contain.

### 3) Sanitize All Text for Non-Arabic PDF
- Auto-translate any Arabic user input into English (Google Translate API if available) or strip Arabic characters using `/[\u0600-\u06FF]/` detection.
- Rules:
  - If client_name or project_name contains Arabic → keep + translate.
  - If any table row contains Arabic → translate or discard Arabic text from output.

### 4) PDF Layout (Structure & Styling)
Order:
1. Cover Page (Logo, Quote Number/Date, Currency, Client & Project Details)
2. Table of Contents (clean list + page numbers)
3. Cover Letter (English only) with summary prices
4. BOQ Table: Image | Description | PN | Qty | Unit Price | Line Total (alternating row color)
5. Product Details (bullets)
6. Terms & Conditions (payment, delivery, FX/tax remarks)

### 5) Remove Common Errors
- Avoid undefined values; replace missing with '-' or 'Not provided'.
- Remove placeholders (e.g., "Project s").
- Keep ToC clean (no extra dots/corrupted formatting).

### Assets / Design Notes
- Use Roboto or Open Sans fonts.
- Dynamic logo path: `customerBrand.logo` or default.
- If quote has no products → prevent PDF generation with a warning.

---

## Issue: تحسين عرض معلومات المنتج في Modal + إصلاح الأزرار

### 1) إزالة القيم Unknown
- عند بناء الجدول داخل المودال: استثنِ أي صف قيمةُه "Unknown" أو فارغ/null.
```js
const cleanedRows = features.filter(row => row.value && row.value.toLowerCase() !== 'unknown');
```

### 2) إصلاح زر "نسخ" Copy
```js
document.getElementById('copyButton').addEventListener('click', () => {
  const text = document.getElementById('modalContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  });
});
```

### 3) إصلاح زر "إرفاق في عرض السعر" (Attach to Quote)
```js
document.getElementById('attachToQuote').addEventListener('click', () => {
  const partNumber = currentProduct.partNumber || currentProduct.mpn;
  if (!partNumber) return;
  addToQuote(partNumber, 1); // default qty = 1
  closeModal();
  alert('Item attached to quote!');
});
```

### 4) تنظيف المحتوى قبل التصدير/النسخ/الإرفاق
```js
function sanitizeProductDetails(rawText) {
  return rawText
    .split('\n')
    .filter(line => !line.includes('Unknown') && line.trim() !== '**Cons:**' && line.trim() !== '')
    .join('\n');
}
```

### مطلوب تفعيله
- تنظيف بيانات الجدول من "Unknown".
- تفعيل زر نسخ المحتوى.
- تفعيل زر إرفاق في عرض السعر (يضيف البند مباشرة للـ Quote).
- عرض Toast/Alert لتأكيد الإجراء.
