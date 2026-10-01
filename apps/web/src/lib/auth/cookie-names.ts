/**
 * Shared by the middleware and the server-only session helpers.
 *
 * Kept in their own module because middleware cannot import anything marked `server-only`.
 */
export const ACCESS_COOKIE = "posly_at";
export const REFRESH_COOKIE = "posly_rt";
/**
 * The shop this device last worked in — the same id the workspace store keeps in
 * localStorage, mirrored here so the server can load that shop with the first page instead
 * of the browser fetching it after a blank shell. A preference, never access: the API
 * checks membership on every call.
 */
export const WORKSPACE_COOKIE = "posly_ws";
