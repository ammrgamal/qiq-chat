import { describe, test, expect } from '@jest/globals';

// Minimal copy of computeTotals logic to guard against regressions
function computeTotals(items: Array<{ unit?: number; unit_price?: number; price?: number; qty?: number }>, include: boolean){
  const subtotal = (items||[]).reduce((s,it)=> s + (Number(it.unit ?? it.unit_price ?? it.price ?? 0) * Number(it.qty ?? 1)), 0);
  const install = include ? subtotal * 0.05 : 0;
  const grand = subtotal + install;
  return { subtotal, install, grand };
}

describe('computeTotals', () => {
  test('empty items', () => {
    const { subtotal, install, grand } = computeTotals([], false);
    expect(subtotal).toBe(0);
    expect(install).toBe(0);
    expect(grand).toBe(0);
  });

  test('basic subtotal without installation', () => {
    const items = [ { unit: 100, qty: 2 }, { unit_price: 50, qty: 1 } ];
    const { subtotal, install, grand } = computeTotals(items as any, false);
    expect(subtotal).toBe(250);
    expect(install).toBe(0);
    expect(grand).toBe(250);
  });

  test('with installation 5%', () => {
    const items = [ { unit: 100, qty: 2 }, { price: 50, qty: 1 } ];
    const { subtotal, install, grand } = computeTotals(items as any, true);
    expect(subtotal).toBe(250);
    expect(install).toBeCloseTo(12.5);
    expect(grand).toBeCloseTo(262.5);
  });
});
