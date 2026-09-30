import { SetMetadata } from "@nestjs/common";

export const PLATFORM_ADMIN_KEY = "platformAdmin";

/**
 * Limits a route to Posly's own operators (`user.is_platform_admin`), enforced by the global
 * `PlatformAdminGuard`. Such routes read across every shop, so they must never carry a
 * `:businessId` param — that would put them under `BusinessAccessGuard` instead.
 */
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);
