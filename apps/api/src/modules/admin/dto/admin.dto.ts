import type { CacheStats } from "@/shared/cache/cache.service";
import { PaginationDto } from "@/shared/dto/pagination.dto";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsBoolean,
	IsIn,
	IsUUID,
	MinLength,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

/** Query strings arrive as text; only the literal "true" switches demo data on. */
const toBool = ({ value }: { value: unknown }) => value === true || value === "true";

class DemoFilterDto {
	@ApiPropertyOptional({
		default: false,
		description:
			"Include the shared demo shop and its accounts (excluded by default).",
	})
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminOverviewQueryDto extends DemoFilterDto {
	@ApiPropertyOptional({ default: 30, minimum: 7, maximum: 90 })
	@IsOptional()
	@IsInt()
	@Min(7)
	@Max(90)
	@Type(() => Number)
	days: number = 30;
}

export class AdminBusinessesQueryDto extends PaginationDto {
	@ApiPropertyOptional({ description: "Shop name or owner email contains" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({ enum: PlanCode })
	@IsOptional()
	@IsEnum(PlanCode)
	plan?: PlanCode;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminUsersQueryDto extends PaginationDto {
	@ApiPropertyOptional({ description: "Email or name contains" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminSubscriptionsQueryDto extends PaginationDto {
	@ApiPropertyOptional({ enum: SubscriptionStatus })
	@IsOptional()
	@IsEnum(SubscriptionStatus)
	status?: SubscriptionStatus;

	@ApiPropertyOptional({ enum: PlanCode })
	@IsOptional()
	@IsEnum(PlanCode)
	plan?: PlanCode;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminActivityQueryDto extends PaginationDto {
	@ApiPropertyOptional({ enum: AuditAction })
	@IsOptional()
	@IsEnum(AuditAction)
	action?: AuditAction;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminRecentOrdersQueryDto extends DemoFilterDto {
	@ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	limit: number = 30;
}

export class AdminSetPlanDto {
	@ApiProperty({ enum: PlanCode })
	@IsEnum(PlanCode)
	plan: PlanCode;

	@ApiPropertyOptional({
		minimum: 1,
		maximum: 3650,
		description:
			"Ends after this many days and falls back to Free; omit for open-ended.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(3650)
	@Type(() => Number)
	days?: number;

	@ApiPropertyOptional({ description: "Why, for the action log." })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	note?: string;
}

export class AdminRevokeSessionsDto {
	@ApiPropertyOptional({ description: "Why, for the action log." })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	note?: string;
}

export class AdminActionsQueryDto extends PaginationDto {}

export class AdminSearchQueryDto {
	@ApiProperty({
		description: "Shop name or id, email or name, order number (#123) or order id",
	})
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	q: string;
}

export const NOTE_TARGETS = ["business", "user"] as const;
export type NoteTarget = (typeof NOTE_TARGETS)[number];

export class AdminNotesQueryDto {
	@ApiProperty({ enum: NOTE_TARGETS })
	@IsIn(NOTE_TARGETS)
	targetType: NoteTarget;

	@ApiProperty()
	@IsUUID()
	targetId: string;
}

export class AdminCreateNoteDto extends AdminNotesQueryDto {
	@ApiProperty({ maxLength: 2000 })
	@IsString()
	@MinLength(1)
	@MaxLength(2000)
	body: string;
}

export class AdminAnnouncementAudienceDto {
	@ApiPropertyOptional({
		enum: PlanCode,
		description: "Only shops on this plan; omit for every shop.",
	})
	@IsOptional()
	@IsEnum(PlanCode)
	plan?: PlanCode;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(toBool)
	includeDemo: boolean = false;
}

export class AdminAnnouncementDto extends AdminAnnouncementAudienceDto {
	@ApiProperty({ maxLength: 80 })
	@IsString()
	@MinLength(1)
	@MaxLength(80)
	title: string;

	@ApiProperty({ maxLength: 500 })
	@IsString()
	@MinLength(1)
	@MaxLength(500)
	body: string;
}

/*
 * Responses. The admin monitor is an internal, read-only screen, so these are plain shapes
 * (mirrored in apps/admin/src/lib/types.ts). Money is satang, as everywhere else.
 */

export interface DailyPoint {
	date: string;
	orders: number;
	gmv: number;
	signups: number;
	newBusinesses: number;
}

export interface AdminOverviewResponse {
	days: number;
	totals: {
		businesses: number;
		newBusinesses: number;
		users: number;
		newUsers: number;
		ordersAllTime: number;
		ordersToday: number;
		gmvToday: number;
		ordersPeriod: number;
		gmvPeriod: number;
		refundsPeriod: number;
		refundedAmountPeriod: number;
		cancelledPeriod: number;
		activeShopsPeriod: number;
	};
	subscriptions: { plan: string; status: string; count: number }[];
	series: DailyPoint[];
	topBusinesses: { id: string; name: string; orders: number; gmv: number }[];
}

export interface AdminBusinessRow {
	id: string;
	name: string;
	businessType: string;
	ownerEmail: string | null;
	plan: string | null;
	subscriptionStatus: string | null;
	members: number;
	branches: number;
	orders30d: number;
	gmv30d: number;
	lastOrderAt: string | null;
	onboardedAt: string | null;
	createdAt: string;
	isDemo: boolean;
}

export interface AdminBusinessDetail {
	business: {
		id: string;
		name: string;
		businessType: string;
		phone: string | null;
		address: string | null;
		taxId: string | null;
		currency: string;
		timezone: string;
		onboardedAt: string | null;
		createdAt: string;
		isDemo: boolean;
	};
	subscription: {
		plan: string;
		planName: string | null;
		status: string;
		startDate: string;
		endDate: string | null;
		cancelAtPeriodEnd: boolean;
		hasStripe: boolean;
	} | null;
	stats: {
		ordersAllTime: number;
		gmvAllTime: number;
		orders30d: number;
		gmv30d: number;
		products: number;
		customers: number;
	};
	members: {
		id: string;
		displayName: string;
		email: string | null;
		role: string;
		status: string;
		hasAccount: boolean;
		createdAt: string;
	}[];
	branches: { id: string; name: string; isDefault: boolean; isActive: boolean }[];
	series: { date: string; orders: number; gmv: number }[];
	recentOrders: AdminOrderRow[];
	recentActivity: AdminAuditRow[];
	/** What platform admins changed on this shop, newest first. */
	adminActions: AdminActionRow[];
}

export interface AdminUserRow {
	id: string;
	email: string;
	name: string;
	provider: string;
	isVerified: boolean;
	isPlatformAdmin: boolean;
	isDemo: boolean;
	shops: number;
	lastSeenAt: string | null;
	createdAt: string;
}

export interface AdminSubscriptionRow {
	id: string;
	businessId: string;
	businessName: string;
	plan: string;
	planName: string | null;
	monthlyPrice: number;
	status: string;
	startDate: string;
	endDate: string | null;
	cancelAtPeriodEnd: boolean;
	hasStripe: boolean;
}

export interface AdminSubscriptionSummary {
	byStatus: Record<string, number>;
	/** Sum of monthly prices of ACTIVE paid plans, in satang. */
	mrr: number;
}

export interface AdminAuditRow {
	id: string;
	businessId: string;
	businessName: string;
	actorName: string;
	action: string;
	entity: string;
	entityId: string;
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface AdminOrderRow {
	id: string;
	businessId: string;
	businessName: string;
	number: number;
	status: string;
	serviceType: string | null;
	employeeName: string;
	total: number;
	createdAt: string;
}

export interface AdminSystemResponse {
	checkedAt: string;
	api: {
		env: string;
		node: string;
		uptimeSeconds: number;
		memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
		timezone: string;
	};
	database: {
		up: boolean;
		latencyMs: number | null;
		sizeMb: number | null;
		connections: number | null;
		migrations: { applied: number; last: string | null; pending: boolean | null };
		tables: { name: string; rows: number }[];
	};
	cache: { provider: "redis" | "memory"; up: boolean; latencyMs: number | null };
	cacheStats: CacheStats | null;
	integrations: {
		stripe: boolean;
		stripeWebhook: boolean;
		mail: boolean;
		storage: boolean;
		googleSignIn: boolean;
		demo: boolean;
	};
}

export interface AdminUserDetail {
	user: {
		id: string;
		email: string;
		name: string;
		avatarUrl: string | null;
		provider: string;
		isVerified: boolean;
		isPlatformAdmin: boolean;
		isDemo: boolean;
		locale: string;
		createdAt: string;
		lastSeenAt: string | null;
	};
	memberships: {
		businessId: string;
		businessName: string;
		role: string;
		status: string;
		plan: string | null;
		joinedAt: string;
	}[];
	/** Refresh tokens not revoked and not expired: one per signed-in device. */
	sessions: {
		id: string;
		createdAt: string;
		expiresAt: string;
		userAgent: string | null;
	}[];
	actions: AdminActionRow[];
}

export interface AdminActionRow {
	id: string;
	adminEmail: string;
	action: string;
	targetType: string;
	targetId: string;
	targetName: string | null;
	payload: Record<string, unknown>;
	createdAt: string;
}

/** One shop that needs a look, with the figure that put it on the list. */
export interface AdminAttentionRow {
	businessId: string;
	businessName: string;
	ownerEmail: string | null;
	plan: string | null;
	/** What the list is about: an end date, days quiet, orders used against the limit… */
	endDate: string | null;
	lastOrderAt: string | null;
	ordersThisMonth: number | null;
	orderLimit: number | null;
	createdAt: string;
	cancelAtPeriodEnd: boolean;
}

export interface AdminAttentionResponse {
	/** Billing failed; Stripe is retrying. */
	pastDue: AdminAttentionRow[];
	/** A paid plan ending within 7 days, or set to cancel at period end. */
	expiring: AdminAttentionRow[];
	/** 80% or more of this month's order limit used. */
	nearQuota: AdminAttentionRow[];
	/** Sold before, nothing in the last 7 days. */
	dormant: AdminAttentionRow[];
	/** Signed up over 3 days ago and never finished setting up. */
	notOnboarded: AdminAttentionRow[];
}

export interface AdminSearchResponse {
	businesses: {
		id: string;
		name: string;
		ownerEmail: string | null;
		plan: string | null;
		isDemo: boolean;
	}[];
	users: { id: string; email: string; name: string; isDemo: boolean }[];
	orders: {
		id: string;
		businessId: string;
		businessName: string;
		number: number;
		status: string;
		total: number;
		createdAt: string;
	}[];
}

export interface AdminNoteRow {
	id: string;
	adminUserId: string;
	adminEmail: string;
	body: string;
	createdAt: string;
}

export interface AdminGrowthResponse {
	/** The last 12 calendar months (Bangkok), oldest first. */
	months: {
		month: string;
		newBusinesses: number;
		signups: number;
		/** Shops with at least one paid order that month. */
		activeBusinesses: number;
		gmv: number;
	}[];
	/**
	 * Shops by the month they signed up (last 6), and how many of them sold anything in
	 * each month since: `active[k]` is month k after signing up (0 = the signup month).
	 */
	cohorts: { month: string; size: number; active: number[] }[];
	/** One snapshot per day, recorded from the day this feature shipped. */
	daily: {
		day: string;
		mrr: number;
		paidBusinesses: number;
		businesses: number;
		users: number;
	}[];
	now: { mrr: number; paidBusinesses: number };
}
