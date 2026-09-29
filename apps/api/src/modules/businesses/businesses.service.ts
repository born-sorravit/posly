import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMemberRepository } from "@/models/businesses/business-member.repository";
import { BusinessRepository } from "@/models/businesses/business.repository";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Subscription } from "@/models/subscriptions/entities/subscription.entity";
import { UsersRepository } from "@/models/users/user.repository";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { BillingService } from "@/modules/billing/billing.service";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import {
	BusinessDetailResponse,
	BusinessSummaryResponse,
	CreateBusinessDto,
	UpdateBusinessDto,
} from "@/modules/businesses/dto/business.dto";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { StorageService } from "@/modules/storage/storage.service";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import {
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class BusinessesService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly businessRepository: BusinessRepository,
		private readonly memberRepository: BusinessMemberRepository,
		private readonly usersRepository: UsersRepository,
		private readonly storageService: StorageService,
		private readonly entitlements: EntitlementsService,
		private readonly billing: BillingService
	) {}

	/** Every business the user is an active member of — what the store switcher lists. */
	async findMine(userId: string): Promise<BusinessSummaryResponse[]> {
		const members = await this.memberRepository.find({
			where: { userId, status: MemberStatus.ACTIVE },
			relations: { business: true },
			order: { createdAt: "ASC" },
		});

		return members.map((member) => this.toSummary(member.business, member.role));
	}

	/**
	 * Creates the business, its first branch and the caller's OWNER membership in one
	 * transaction. A business without an owner would be unreachable, and one without a
	 * branch would have nowhere to put its first order.
	 */
	async create(
		userId: string,
		dto: CreateBusinessDto
	): Promise<BusinessSummaryResponse> {
		const user = await this.usersRepository.findOne({ where: { id: userId } });
		if (!user) {
			throw new UnauthorizedException("Account no longer exists");
		}

		return this.dataSource.transaction(async (manager) => {
			const business = await manager.save(
				manager.create(Business, {
					name: dto.name,
					businessType: dto.businessType,
					phone: dto.phone ?? null,
					address: dto.address ?? null,
					taxId: dto.taxId ?? null,
					currency: dto.currency ?? "THB",
					timezone: dto.timezone ?? "Asia/Bangkok",
				})
			);

			await manager.save(
				manager.create(Branch, {
					businessId: business.id,
					name: dto.name,
					phone: dto.phone ?? null,
					address: dto.address ?? null,
					isDefault: true,
				})
			);

			await manager.save(
				manager.create(BusinessMember, {
					businessId: business.id,
					userId: user.id,
					email: user.email,
					displayName: user.name,
					role: MemberRole.OWNER,
					status: MemberStatus.ACTIVE,
				})
			);

			// Every shop starts on Free; upgrading changes this row, never the code.
			await manager.save(
				manager.create(Subscription, {
					businessId: business.id,
					planCode: PlanCode.FREE,
					status: SubscriptionStatus.ACTIVE,
					startDate: new Date(),
					endDate: null,
				})
			);

			return this.toSummary(business, MemberRole.OWNER);
		});
	}

	async findOne(membership: ResolvedMembership): Promise<BusinessDetailResponse> {
		const business = await this.load(membership.businessId);
		return await this.toDetail(business, membership);
	}

	async update(
		membership: ResolvedMembership,
		dto: UpdateBusinessDto
	): Promise<BusinessDetailResponse> {
		const business = await this.load(membership.businessId);
		const { logoPath, ...fields } = dto;
		if (logoPath !== undefined) {
			if (logoPath !== null)
				this.storageService.assertOwnedPath(business.id, logoPath);
			const previous = business.logoPath;
			business.logoPath = logoPath;
			if (previous && previous !== logoPath)
				void this.storageService.remove(previous);
		}
		Object.assign(business, fields);
		await this.businessRepository.save(business);
		return await this.toDetail(business, membership);
	}

	/** Idempotent; the first call wins so the timestamp records when onboarding really ended. */
	async completeOnboarding(
		membership: ResolvedMembership
	): Promise<BusinessDetailResponse> {
		const business = await this.load(membership.businessId);
		if (!business.onboardedAt) {
			business.onboardedAt = new Date();
			await this.businessRepository.save(business);
		}
		return await this.toDetail(business, membership);
	}

	private async load(businessId: string): Promise<Business> {
		const business = await this.businessRepository.findOne({
			where: { id: businessId },
		});
		if (!business) throw new NotFoundException("Business not found");
		return business;
	}

	private toSummary(business: Business, role: MemberRole): BusinessSummaryResponse {
		return {
			id: business.id,
			name: business.name,
			businessType: business.businessType,
			logoUrl: business.logoPath
				? this.storageService.publicUrl(business.logoPath)
				: null,
			currency: business.currency,
			role,
			onboardedAt: business.onboardedAt?.toISOString() ?? null,
		};
	}

	private async toDetail(
		business: Business,
		membership: ResolvedMembership
	): Promise<BusinessDetailResponse> {
		const [entitlements, usage] = await Promise.all([
			this.entitlements.forBusiness(business.id),
			this.entitlements.usage(business.id, business.timezone),
		]);
		return {
			...this.toSummary(business, membership.role),
			phone: business.phone,
			address: business.address,
			taxId: business.taxId,
			promptPayId: business.promptPayId,
			timezone: business.timezone,
			vatBasisPoints: business.vatBasisPoints,
			pricesIncludeVat: business.pricesIncludeVat,
			// An emptied footer prints nothing rather than an empty line.
			receiptFooter: business.receiptFooter || null,
			receiptShowLogo: business.receiptShowLogo,
			receiptShowTaxId: business.receiptShowTaxId,
			permissions: [...membership.permissions],
			subscription: {
				plan: entitlements.plan,
				planName: entitlements.planName,
				subscribedPlan: entitlements.subscribedPlan,
				status: entitlements.status,
				endDate: entitlements.endDate?.toISOString() ?? null,
				cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
				billedOnline: entitlements.billedOnline,
				onlinePayment: this.billing.enabled,
				features: entitlements.features,
				limits: entitlements.limits,
				usage,
			},
		};
	}
}
