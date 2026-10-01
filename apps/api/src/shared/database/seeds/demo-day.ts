import { rng } from "@/shared/database/seeds/demo-builder";
import type { DemoShop } from "@/shared/database/seeds/demo.data";

const HOUR = 3_600_000;

/** A stable number from a string, to seed the day's randomness. */
const hash = (text: string): number => {
	let h = 2_166_136_261;
	for (let i = 0; i < text.length; i++)
		h = Math.imul(h ^ text.charCodeAt(i), 16_777_619);
	return h >>> 0;
};

/** Midnight of a Bangkok date (`YYYY-MM-DD`), as an instant. */
export const bangkokMidnight = (date: string): Date =>
	new Date(`${date}T00:00:00+07:00`);

/**
 * How many orders a demo shop takes on `date`: the seed's latest-day volume, busier at
 * weekends, ±20%. Seeded by shop and date, so every top-up that day aims at the same total.
 */
export const dayTarget = (shop: DemoShop, date: string): number => {
	const random = rng(hash(`${shop.name}|${date}`));
	const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
	const weekend = weekday === 0 || weekday === 6;
	return Math.round(
		shop.ordersPerDay * 1.15 * (weekend ? 1.3 : 1) * (0.8 + random() * 0.4)
	);
};

/** Hours since Bangkok midnight of `date` — above 24 once the date is past. */
const hoursInto = (date: string, now: Date) =>
	(now.getTime() - bangkokMidnight(date).getTime()) / HOUR;

/**
 * The share of the day's orders that should exist by `now`: 0 before opening, 1 from
 * closing, and in between weighted by the shop's busy hours.
 */
export const shareBy = (shop: DemoShop, date: string, now: Date): number => {
	const [open, close] = shop.hours;
	const elapsed = hoursInto(date, now);
	let done = 0;
	let total = 0;
	for (let h = open; h < close; h++) {
		const weight = shop.peak(h);
		total += weight;
		done += weight * Math.min(1, Math.max(0, elapsed - h));
	}
	return total === 0 ? 0 : done / total;
};

/**
 * Times for `count` sales between `from` and `to` (both on `date`), spread like the shop's
 * day: an hour is picked by how busy it is and how much of it lies in the window.
 */
export const saleTimes = (
	shop: DemoShop,
	date: string,
	from: Date,
	to: Date,
	count: number,
	random: () => number
): Date[] => {
	const midnight = bangkokMidnight(date).getTime();
	const [open, close] = shop.hours;
	const slots: { start: number; end: number; weight: number }[] = [];
	for (let h = open; h < close; h++) {
		const start = Math.max(midnight + h * HOUR, from.getTime());
		const end = Math.min(midnight + (h + 1) * HOUR, to.getTime());
		if (end > start)
			slots.push({ start, end, weight: shop.peak(h) * (end - start) });
	}
	if (slots.length === 0) return [];
	const totalWeight = slots.reduce((sum, s) => sum + s.weight, 0);
	const times: Date[] = [];
	for (let n = 0; n < count; n++) {
		let roll = random() * totalWeight;
		let slot = slots[slots.length - 1];
		for (const candidate of slots) {
			roll -= candidate.weight;
			if (roll <= 0) {
				slot = candidate;
				break;
			}
		}
		times.push(new Date(slot.start + random() * (slot.end - slot.start)));
	}
	return times.sort((a, b) => a.getTime() - b.getTime());
};
