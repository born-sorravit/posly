/**
 * Queue names and shared job options. Names are added here together with the module that
 * produces and consumes them — see `QueueModule` for why none exist yet.
 */
export const DEFAULT_JOB_OPTIONS = {
	attempts: 5,
	backoff: { type: "exponential" as const, delay: 5000 },
	// Keep a short tail for debugging; without a cap these tables grow without bound.
	removeOnComplete: { age: 24 * 3600, count: 500 },
	removeOnFail: { age: 7 * 24 * 3600, count: 500 },
};
