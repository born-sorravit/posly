/**
 * Shared by the middleware and the server-only session helpers.
 *
 * Kept in their own module because middleware cannot import anything marked `server-only`.
 */
export const ACCESS_COOKIE = "posly_at";
export const REFRESH_COOKIE = "posly_rt";
