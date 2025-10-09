// استخدام adapter CJS
const { loadRulesEngine } = require('./adapters/rulesEngine.adapter.cjs');
let rulesEngine;
beforeAll(async () => { rulesEngine = await loadRulesEngine(); });

describe('rulesEngine basic resolution', () => {
  test('switch product gets network & switch tags and rack bundle', () => {
    const res = rulesEngine.resolve({ name: 'Layer3 Gigabit Switch 48-Port', manufacturer: 'Cisco' });
    expect(res.tags).toEqual(expect.arrayContaining(['network','switch']));
    expect(res.bundles).toEqual(expect.arrayContaining(['rack_mount_kit']));
  });
  test('firewall with poe & manufacturer bonus', () => {
    const res = rulesEngine.resolve({ name: 'Enterprise Firewall PoE Appliance', manufacturer: 'Fortinet' });
    expect(res.tags).toEqual(expect.arrayContaining(['security','firewall','poe']));
    expect(res.bundles).toEqual(expect.arrayContaining(['support_subscription']));
    expect(res.qualityBonus).toBeGreaterThanOrEqual(5);
  });
});
