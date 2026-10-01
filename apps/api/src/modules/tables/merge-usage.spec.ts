import { mergeUsage } from "@/modules/tables/merge-usage";

describe("mergeUsage", () => {
	it("is null when no round took anything", () => {
		expect(mergeUsage(null, null)).toBeNull();
		expect(mergeUsage(null, {})).toBeNull();
	});

	it("keeps a single round as it was", () => {
		expect(mergeUsage(null, { milk: 0.2 })).toEqual({ milk: 0.2 });
	});

	it("adds the same ingredient across rounds without float drift", () => {
		expect(mergeUsage({ milk: 0.1, beans: 18 }, { milk: 0.2 })).toEqual({
			milk: 0.3,
			beans: 18,
		});
	});
});
