import { trimmed } from "@/shared/dto/transform.util";
import { BusinessType } from "@/shared/enums/business-type.enum";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { IsThaiTaxId } from "@/shared/utils/thai-tax-id.util";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Length,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";

export class CreateBusinessDto {
	@ApiProperty({ example: "Sunny Cafe" })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name: string;

	@ApiProperty({ enum: BusinessType })
	@IsEnum(BusinessType)
	businessType: BusinessType;

	@ApiPropertyOptional({ example: "081-234-5678" })
	@IsOptional()
	@IsString()
	@MaxLength(30)
	phone?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	address?: string;

	@ApiPropertyOptional({
		nullable: true,
		description: "13-digit Thai tax id; null clears it",
	})
	@IsOptional()
	@IsThaiTaxId()
	taxId?: string | null;

	@ApiPropertyOptional({ default: "THB" })
	@IsOptional()
	@IsIn(["THB"])
	currency?: string;

	@ApiPropertyOptional({ default: "Asia/Bangkok" })
	@IsOptional()
	@IsString()
	@Length(3, 64)
	timezone?: string;
}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {
	@ApiPropertyOptional({
		nullable: true,
		description:
			"Storage path from POST /uploads (purpose business-logo); null removes it",
	})
	@IsOptional()
	@IsString()
	@MaxLength(300)
	logoPath?: string | null;

	@ApiPropertyOptional({ description: "PromptPay mobile number or 13-digit tax id" })
	@IsOptional()
	@Matches(/^(0\d{9}|\d{13})$/)
	promptPayId?: string;

	@ApiPropertyOptional({ description: "VAT in basis points; 700 = 7%" })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(3000)
	vatBasisPoints?: number;

	@ApiPropertyOptional({
		description:
			"True: shelf prices already include VAT. False: VAT is added at checkout",
	})
	@IsOptional()
	@IsBoolean()
	pricesIncludeVat?: boolean;

	@ApiPropertyOptional({ nullable: true, example: "ขอบคุณที่ใช้บริการ" })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(300)
	receiptFooter?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	receiptShowLogo?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	receiptShowTaxId?: boolean;

	@ApiPropertyOptional({
		description: "Guests may open a free table by ordering from its QR",
	})
	@IsOptional()
	@IsBoolean()
	tableSelfOpen?: boolean;
}

export class BusinessSummaryResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ enum: BusinessType }) businessType: BusinessType;
	@ApiProperty({ nullable: true }) logoUrl: string | null;
	@ApiProperty() currency: string;
	@ApiProperty({
		enum: MemberRole,
		description: "The caller's role in this business",
	})
	role: MemberRole;
	@ApiProperty({ nullable: true }) onboardedAt: string | null;
}

export class PlanLimitsResponse {
	@ApiProperty({
		nullable: true,
		description: "Orders per month; null is unlimited",
	})
	orders: number | null;
	@ApiProperty({ nullable: true, description: "Staff, not counting the owner" })
	members: number | null;
	@ApiProperty({ nullable: true }) branches: number | null;
	@ApiProperty({ nullable: true }) tables: number | null;
}

export class PlanUsageResponse {
	@ApiProperty() ordersThisMonth: number;
	@ApiProperty() members: number;
	@ApiProperty() branches: number;
	@ApiProperty() tables: number;
}

/** What this shop may do right now — the UI asks this, it never decides from a plan code. */
export class SubscriptionSummaryResponse {
	@ApiProperty({
		description: "The plan in force; FREE while a paid plan has lapsed",
	})
	plan: string;
	@ApiProperty() planName: string;
	@ApiProperty() subscribedPlan: string;
	@ApiProperty() status: string;
	@ApiProperty({ nullable: true }) endDate: string | null;
	@ApiProperty() cancelAtPeriodEnd: boolean;
	@ApiProperty({
		description: "Paid through Stripe; plan changes go through billing",
	})
	billedOnline: boolean;
	@ApiProperty({ description: "Whether this server takes card payments at all" })
	onlinePayment: boolean;
	@ApiProperty({ type: [String] }) features: string[];
	@ApiProperty({ type: PlanLimitsResponse }) limits: PlanLimitsResponse;
	@ApiProperty({ type: PlanUsageResponse }) usage: PlanUsageResponse;
}

export class BusinessDetailResponse extends BusinessSummaryResponse {
	@ApiProperty({ nullable: true }) phone: string | null;
	@ApiProperty({ nullable: true }) address: string | null;
	@ApiProperty({ nullable: true }) taxId: string | null;
	@ApiProperty({ nullable: true }) promptPayId: string | null;
	@ApiProperty() timezone: string;
	@ApiProperty() vatBasisPoints: number;
	@ApiProperty() pricesIncludeVat: boolean;
	@ApiProperty({ nullable: true }) receiptFooter: string | null;
	@ApiProperty() receiptShowLogo: boolean;
	@ApiProperty() receiptShowTaxId: boolean;
	@ApiProperty() tableSelfOpen: boolean;
	@ApiProperty({ type: [String], description: "The caller's effective permissions" })
	permissions: string[];
	@ApiProperty({ type: SubscriptionSummaryResponse })
	subscription: SubscriptionSummaryResponse;
}
