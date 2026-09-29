import type { Permission } from "@/shared/enums/permission.enum";
import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/**
 * The permissions a business-scoped route needs — all of them. Checked by
 * `BusinessAccessGuard` against the caller's membership in the route's `:businessId`.
 */
export const RequirePermission = (...permissions: Permission[]) =>
	SetMetadata(PERMISSIONS_KEY, permissions);
