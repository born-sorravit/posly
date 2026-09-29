export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

/**
 * The calendar date *in the shop's timezone* as `YYYY-MM-DD`.
 *
 * "Today's sales" is a local question: a cafe in Bangkok closing at 23:30 must not have its
 * last orders land on tomorrow because the server runs in UTC. Every per-day report resolves
 * its boundaries through here, with the business's own timezone.
 */
export const getLocalDateString = (
	date: Date = new Date(),
	timeZone: string = BANGKOK_TIME_ZONE
): string =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
