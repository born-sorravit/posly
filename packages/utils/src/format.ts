/**
 * Dates as a Thai shop reads them: Buddhist-era years (26 ก.ย. 2569), Bangkok time.
 * `th-TH-u-ca-buddhist` produces the era directly.
 */
const TZ = "Asia/Bangkok";

const toDate = (value: string | Date): Date => (typeof value === "string" ? new Date(value) : value);

export const formatThaiDate = (
	value: string | Date,
	options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string =>
	new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { ...options, timeZone: TZ }).format(
		toDate(value)
	);

/** 10:24 — 24-hour, as every Thai receipt prints it. */
export const formatClock = (value: string | Date): string =>
	new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: TZ,
	}).format(toDate(value));

export const formatDateTime = (value: string | Date): string =>
	`${formatThaiDate(value)} ${formatClock(value)}`;

/** "5 นาทีที่แล้ว", falling back to a date after a day. */
export const formatRelative = (value: string | Date, now: Date = new Date()): string => {
	const seconds = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
	const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
	const abs = Math.abs(seconds);
	if (abs < 60) return rtf.format(seconds, "second");
	if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
	if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
	return formatThaiDate(value, { day: "numeric", month: "short" });
};

/**
 * 0.142 -> "14.2%", 25.556 -> "2,556%". Unsigned — the arrow beside it carries the sign.
 * From 100% up the decimal says nothing a reader can use, so it goes; thousands get grouped.
 */
export const formatPercent = (ratio: number, digits = 1): string => {
	const percent = Math.abs(ratio) * 100;
	// Decided on the rounded value, so 99.96% reads "100%", not "100.0%".
	const fraction = Number(percent.toFixed(digits)) >= 100 ? 0 : digits;
	return `${new Intl.NumberFormat("en-US", {
		minimumFractionDigits: fraction,
		maximumFractionDigits: fraction,
	}).format(percent)}%`;
};

export const formatNumber = (value: number): string => new Intl.NumberFormat("th-TH").format(value);

/** "สวัสดีตอนเช้า" / "สวัสดีตอนบ่าย" / "สวัสดีตอนเย็น" key, by Bangkok hour. */
export const greetingKey = (now: Date): "morning" | "afternoon" | "evening" => {
	const hour = Number(
		new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(now)
	);
	if (hour < 12) return "morning";
	if (hour < 17) return "afternoon";
	return "evening";
};

/** Bangkok calendar date, `YYYY-MM-DD`. */
const bangkokDate = (date: Date) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/**
 * `[from, to)` ISO instants for "today", "yesterday" or the last 7 days, in Bangkok time.
 * Thailand has a fixed +07:00 offset and no DST, so the offset can be written literally.
 */
export const dayRange = (range: "today" | "yesterday" | "7d", now: Date = new Date()) => {
	const today = new Date(`${bangkokDate(now)}T00:00:00+07:00`);
	const day = 86_400_000;
	if (range === "yesterday") {
		return { from: new Date(today.getTime() - day).toISOString(), to: today.toISOString() };
	}
	const from = range === "7d" ? new Date(today.getTime() - 6 * day) : today;
	return { from: from.toISOString(), to: new Date(today.getTime() + day).toISOString() };
};

/**
 * The letter for an avatar circle. Thai writes เ แ โ ใ ไ before the consonant they follow in
 * speech, so "แนน" starts with แ but is known by น; the polite "คุณ" is dropped for the same
 * reason. Latin initials are uppercased.
 */
export const nameInitial = (name: string): string => {
	const trimmed = name.trim();
	const bare = trimmed.replace(/^คุณ\s*/, "") || trimmed;
	const letter = [...bare.replace(/^[เแโใไ]+/, "")][0] ?? [...bare][0];
	return letter ? letter.toUpperCase() : "?";
};
