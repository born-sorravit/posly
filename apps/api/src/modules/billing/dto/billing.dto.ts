import { PlanCode } from "@/shared/enums/subscription.enum";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export class ChoosePlanDto {
	@ApiProperty({ enum: PlanCode })
	@IsEnum(PlanCode)
	plan: PlanCode;
}

export class RedirectResponse {
	@ApiProperty({ description: "Stripe-hosted page to send the browser to" })
	url: string;
}
