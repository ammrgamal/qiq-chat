const runAlgolia = process.env.RUN_ALGOLIA_TESTS === '1';
const maybe = runAlgolia ? describe : describe.skip;

maybe('algolia config exposure', () => {
	test('settings object keys shape', () => {
		const settings = require('../src/search/algoliaSettings');
		expect(settings.ALGOLIA_SETTINGS).toBeTruthy();
		const keys = Object.keys(settings.ALGOLIA_SETTINGS);
		expect(keys).toEqual(expect.arrayContaining(['searchableAttributes','customRanking']));
	});
});
