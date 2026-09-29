import type { Feature } from "@/shared/enums/subscription.enum";
import { SetMetadata } from "@nestjs/common";

export const FEATURES_KEY = "features";

/**
 * Plan features a business-scoped route needs (plan §26). Checked by `FeatureGuard`, which
 * runs after `BusinessAccessGuard` has resolved the membership — so a non-member still gets
 * the 404, and only a member whose plan lacks the feature sees the upgrade message.
 */
export const RequireFeature = (...features: Feature[]) =>
	SetMetadata(FEATURES_KEY, features);
