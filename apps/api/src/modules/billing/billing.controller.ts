import { ChoosePlanDto, RedirectResponse } from "@/modules/billing/dto/billing.dto";
import { BillingService } from "@/modules/billing/billing.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { Public } from "@/shared/decorators/public.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiExcludeEndpoint,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("businesses/:businessId/billing")
@RequirePermission(Permission.SUBSCRIPTION_MANAGE)
export class BillingController {
	constructor(private readonly billing: BillingService) {}

	@Post("checkout")
	@HttpCode(200)
	@ApiOperation({ summary: "Start Stripe Checkout for a paid plan" })
	@ApiOkResponse({ type: RedirectResponse })
	checkout(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: ChoosePlanDto
	): Promise<RedirectResponse> {
		return this.billing.checkout(m, dto.plan);
	}

	@Post("change")
	@HttpCode(204)
	@ApiOperation({
		summary: "Switch a paying shop's plan (FREE cancels at period end)",
	})
	change(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: ChoosePlanDto
	): Promise<void> {
		return this.billing.changePlan(m, dto.plan);
	}

	@Post("portal")
	@HttpCode(200)
	@ApiOperation({
		summary: "Open Stripe's customer portal: card, invoices, cancelling",
	})
	@ApiOkResponse({ type: RedirectResponse })
	portal(@CurrentMembership() m: ResolvedMembership): Promise<RedirectResponse> {
		return this.billing.portal(m);
	}
}

/** Stripe calls this; the signature, not a login, is what authenticates it. */
@Controller("billing")
export class BillingWebhookController {
	constructor(private readonly billing: BillingService) {}

	@Public()
	@SkipThrottle()
	@Post("webhook")
	@HttpCode(200)
	@ApiExcludeEndpoint()
	async webhook(
		@Req() req: { rawBody?: Buffer },
		@Headers("stripe-signature") signature: string | undefined
	): Promise<{ received: true }> {
		await this.billing.webhook(req.rawBody, signature);
		return { received: true };
	}
}
