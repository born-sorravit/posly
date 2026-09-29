import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import {
	MEMBERSHIP_REQUEST_KEY,
	type ResolvedMembership,
} from "@/shared/decorators/current-membership.decorator";
import { FEATURES_KEY } from "@/shared/decorators/require-feature.decorator";
import type { Feature } from "@/shared/enums/subscription.enum";
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class FeatureGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly entitlements: EntitlementsService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const required =
			this.reflector.getAllAndOverride<Feature[]>(FEATURES_KEY, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];
		if (required.length === 0) return true;

		const membership = context.switchToHttp().getRequest()[MEMBERSHIP_REQUEST_KEY] as
			| ResolvedMembership
			| undefined;
		if (!membership)
			throw new ForbiddenException("Feature check requires a business scope");

		const { features } = await this.entitlements.forBusiness(membership.businessId);
		const missing = required.find((f) => !features.includes(f));
		if (missing)
			throw new ForbiddenException(`Your plan does not include ${missing}`);
		return true;
	}
}
