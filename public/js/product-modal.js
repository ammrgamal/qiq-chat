/* ====== إدارة نافذة تفاصيل المنتج ====== */

(function() {
  // إنشاء عناصر النافذة المنبثقة
  const modal = document.createElement('div');
  modal.className = 'product-modal';
  modal.innerHTML = `
    <div class="product-modal-content">
      <button class="product-modal-close" title="إغلاق">&times;</button>
      <div class="product-modal-header">
        <h2 class="product-modal-title"></h2>
        <div class="product-modal-subtitle"></div>
      </div>
      <img class="product-modal-image" src="" alt="">
      <div class="product-modal-body">
        <div class="product-detail-row">
          <div class="product-detail-label">رقم القطعة</div>
          <div class="product-detail-value product-pn"></div>
        </div>
        <div class="product-detail-row">
          <div class="product-detail-label">الشركة المصنعة</div>
          <div class="product-detail-value product-brand"></div>
        </div>
        <div class="product-detail-row">
          <div class="product-detail-label">الفئة</div>
          <div class="product-detail-value product-category"></div>
        </div>
        <div class="product-detail-row">
          <div class="product-detail-label">السعر</div>
          <div class="product-detail-value product-price"></div>
        </div>
        <div class="product-detail-row">
          <div class="product-detail-label">التوفر</div>
          <div class="product-detail-value product-availability"></div>
        </div>
        <div class="product-detail-row product-desc-row" style="display:none">
          <div class="product-detail-label">الوصف</div>
          <div class="product-detail-value product-description"></div>
        </div>
      </div>
      <a href="#" class="product-spec-link" target="_blank" rel="noopener">
        📄 عرض المواصفات الفنية
      </a>
    </div>
  `;
  document.body.appendChild(modal);

  // إغلاق النافذة عند النقر خارجها
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeProductDetails();
  });

  // إغلاق النافذة عند النقر على زر الإغلاق
  modal.querySelector('.product-modal-close').addEventListener('click', closeProductDetails);

  // دالة لعرض تفاصيل المنتج
  window.showProductDetails = function(product) {
    if (!product) return;
    
    // تعبئة البيانات
    modal.querySelector('.product-modal-title').textContent = product.name || '';
    modal.querySelector('.product-modal-subtitle').textContent = product.brand || '';
    modal.querySelector('.product-modal-image').src = product.image || 'https://via.placeholder.com/200?text=Product';
    modal.querySelector('.product-pn').textContent = product.pn || product.sku || '';
    modal.querySelector('.product-brand').textContent = product.brand || product.manufacturer || '';
    modal.querySelector('.product-category').textContent = product.category || '';
    modal.querySelector('.product-price').textContent = formatPrice(product.price);
    modal.querySelector('.product-availability').textContent = formatAvailability(product.availability);
    
    // الوصف التفصيلي
    const descRow = modal.querySelector('.product-desc-row');
    const descEl = modal.querySelector('.product-description');
    if (product.ExtendedDescription || product.ShortDescription) {
      descEl.textContent = product.ExtendedDescription || product.ShortDescription;
      descRow.style.display = '';
    } else {
      descRow.style.display = 'none';
    }

    // رابط المواصفات الفنية
    const specLink = modal.querySelector('.product-spec-link');
    if (product.spec_sheet) {
      specLink.href = product.spec_sheet;
      specLink.style.display = '';
    } else {
      specLink.style.display = 'none';
    }

    // عرض النافذة
    modal.classList.add('show');
    
    // قفل التمرير في الخلفية
    document.body.style.overflow = 'hidden';
  };

  // دالة لإغلاق النافذة
  window.closeProductDetails = function() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  };

  // دوال مساعدة
  function formatPrice(price) {
    if (!price) return 'غير متوفر';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  function formatAvailability(status) {
    switch(status?.toLowerCase()) {
      case 'stock': return '✓ متوفر';
      case 'on back order': return '⏳ متوفر للطلب';
      default: return 'غير متوفر';
    }
  }
})();