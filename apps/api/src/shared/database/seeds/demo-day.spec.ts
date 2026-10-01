import { dayTarget, saleTimes, shareBy } from "@/shared/database/seeds/demo-day";
import { DEMO_SHOPS } from "@/shared/database/seeds/demo.data";

const cafe = DEMO_SHOPS[0]; // Sunny Cafe, open 07:00–19:00
const at = (time: string) => new Date(`2026-10-01T${time}:00+07:00`);

describe("demo day", () => {
	it("aims at the same total for a shop and date, whenever it is asked", () => {
		expect(dayTarget(cafe, "2026-10-01")).toBe(dayTarget(cafe, "2026-10-01"));
		expect(dayTarget(cafe, "2026-10-01")).toBeGreaterThan(cafe.ordersPerDay * 0.8);
	});

	it("has nothing before opening and everything from closing", () => {
		expect(shareBy(cafe, "2026-10-01", at("04:00"))).toBe(0);
		expect(shareBy(cafe, "2026-10-01", at("07:00"))).toBe(0);
		expect(shareBy(cafe, "2026-10-01", at("19:00"))).toBe(1);
		expect(shareBy(cafe, "2026-10-01", at("23:30"))).toBe(1);
	});

	it("only grows through the day", () => {
		let last = 0;
		for (let minutes = 7 * 60; minutes <= 19 * 60; minutes += 15) {
			const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
			const share = shareBy(cafe, "2026-10-01", at(time));
			expect(share).toBeGreaterThanOrEqual(last);
			last = share;
		}
	});

	it("places sales inside the window and the opening hours, in order", () => {
		let seed = 1;
		const random = () => {
			seed = (seed * 16_807) % 2_147_483_647;
			return seed / 2_147_483_647;
		};
		const times = saleTimes(
			cafe,
			"2026-10-01",
			at("06:00"),
			at("09:30"),
			50,
			random
		);
		expect(times).toHaveLength(50);
		for (const [i, t] of times.entries()) {
			expect(t.getTime()).toBeGreaterThanOrEqual(at("07:00").getTime());
			expect(t.getTime()).toBeLessThanOrEqual(at("09:30").getTime());
			if (i > 0) expect(t.getTime()).toBeGreaterThanOrEqual(times[i - 1].getTime());
		}
		expect(
			saleTimes(cafe, "2026-10-01", at("19:30"), at("20:00"), 5, random)
		).toEqual([]);
	});
});
