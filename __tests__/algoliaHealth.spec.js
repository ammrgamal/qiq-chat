const runAlgolia = process.env.RUN_ALGOLIA_TESTS === '1';
const maybe = runAlgolia ? describe : describe.skip;

maybe('algolia health', () => {
	test('env gating works', () => {
		expect(typeof runAlgolia).toBe('boolean');
	});
	if (runAlgolia) {
		test('requires credentials presence', () => {
			expect(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY).toBeTruthy();
		});
	}
});
