import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { Public } from "@/shared/decorators/public.decorator";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";

export class PlanHighlightResponse {
	@ApiProperty() label: string;
	@ApiProperty({ description: "Promised but not shipped yet" }) soon: boolean;
}

export class PlanResponse {
	@ApiProperty() code: string;
	@ApiProperty() name: string;
	@ApiProperty({ description: "Satang per month" }) monthlyPrice: number;
	@ApiProperty({ nullable: true }) orderLimit: number | null;
	@ApiProperty({ nullable: true, description: "Staff, not counting the owner" })
	memberLimit: number | null;
	@ApiProperty({ nullable: true }) branchLimit: number | null;
	@ApiProperty({ type: [String] }) features: string[];
	@ApiProperty({ type: [PlanHighlightResponse] })
	highlights: PlanHighlightResponse[];
}

/** The public price list — the landing page and the subscription settings both read it. */
@ApiTags("subscriptions")
@Controller("plans")
export class PlansController {
	constructor(private readonly entitlements: EntitlementsService) {}

	@Public()
	@Get()
	@ApiOperation({ summary: "Public plans, cheapest first" })
	async list(): Promise<PlanResponse[]> {
		const plans = await this.entitlements.plansByCode();
		return [...plans.values()]
			.filter((p) => p.isPublic)
			.map((p) => ({
				code: p.code,
				name: p.name,
				monthlyPrice: p.monthlyPrice,
				orderLimit: p.orderLimit,
				memberLimit: p.memberLimit,
				branchLimit: p.branchLimit,
				features: (p.features ?? []).filter((f) => f.enabled).map((f) => f.feature),
				highlights: p.highlights,
			}));
	}
}
