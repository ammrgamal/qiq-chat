import { normalizeFileUrl } from '../src/search/indexSchema';

describe('normalizeFileUrl', () => {
  it('replaces backslashes with slashes', () => {
    expect(normalizeFileUrl('images\\product\\img.jpg')).toBe('images/product/img.jpg');
  });
  it('does not encode spaces', () => {
    expect(normalizeFileUrl('images\\product\\my img.jpg')).toBe('images/product/my img.jpg');
  });
});

// يمكنك إضافة المزيد من اختبارات التقسيم والدوبلكيت والـ size guard هنا
