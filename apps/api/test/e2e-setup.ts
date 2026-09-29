/**
 * Runs before the module registry is populated for each e2e file.
 *
 * The credential endpoints allow 10 attempts a minute in production. A suite that registers
 * a dozen accounts would spend most of its assertions on 429s, so the limit is raised here —
 * the tight default is asserted directly in `auth-throttle.spec.ts`.
 */
process.env.AUTH_THROTTLE_LIMIT = process.env.AUTH_THROTTLE_LIMIT ?? "1000";

/**
 * A just-rotated refresh token is normally forgiven for 15s so concurrent browser requests
 * all succeed. The suite asserts both sides of that boundary, so the window is shortened —
 * waiting 15 seconds to prove a replay is rejected would be the slowest test in the project.
 */
process.env.REFRESH_ROTATION_GRACE_MS =
	process.env.REFRESH_ROTATION_GRACE_MS ?? "1000";

/**
 * The suites write real rows, so they must never reach the deployed database. `.env` may point
 * at Railway; the e2e run requires an explicit throwaway database instead and refuses to
 * start without one.
 */
if (!process.env.E2E_DATABASE_URL) {
	throw new Error(
		"Set E2E_DATABASE_URL to a disposable Postgres (e.g. the docker-compose one) to run e2e tests."
	);
}
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
process.env.DB_SSL = process.env.E2E_DB_SSL ?? "false";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-secret";

/**
 * Never real Stripe: an empty key keeps online payment off (dotenv does not override a set
 * variable, even an empty one), and the billing suite swaps in a fake client.
 */
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_e2e_test_secret";
