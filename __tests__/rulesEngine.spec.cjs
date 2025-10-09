const { loadRulesEngine } = require('./adapters/rulesEngine.adapter.cjs');
let engine;
beforeAll(async () => { engine = await loadRulesEngine(); });

describe('rulesEngine basic resolution (CJS)', () => {
  test('switch product tags + bundle', () => {
    const res = engine.resolve({ name: 'Layer3 Gigabit Switch 48-Port', manufacturer: 'Cisco' });
    expect(res.tags).toEqual(expect.arrayContaining(['network','switch']));
    expect(res.bundles).toEqual(expect.arrayContaining(['rack_mount_kit']));
  });
  test('firewall with poe & manufacturer bonus', () => {
    const res = engine.resolve({ name: 'Enterprise Firewall PoE Appliance', manufacturer: 'Fortinet' });
    expect(res.tags).toEqual(expect.arrayContaining(['security','firewall','poe']));
    expect(res.qualityBonus).toBeGreaterThanOrEqual(5);
  });
});
