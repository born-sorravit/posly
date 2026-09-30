/**
 * Shared by the middleware and the server-only session helpers.
 *
 * Kept in their own module because middleware cannot import anything marked `server-only`.
 * Named apart from the web app's (`posly_at`/`posly_rt`): on localhost both apps share one
 * cookie jar, and signing out of one must not sign you out of the other.
 */
export const ACCESS_COOKIE = "posly_admin_at";
export const REFRESH_COOKIE = "posly_admin_rt";
