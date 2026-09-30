import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { BranchRepository } from "@/models/branches/branch.repository";
import { Branch } from "@/models/branches/entities/branch.entity";
import {
	BranchResponse,
	CreateBranchDto,
	UpdateBranchDto,
} from "@/modules/branches/dto/branch.dto";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { In } from "typeorm";

@Injectable()
export class BranchesService {
	constructor(
		private readonly branchRepository: BranchRepository,
		private readonly entitlements: EntitlementsService,
		private readonly cacheService: CacheService
	) {}

	/** Only the branches this member may work in, when their membership is restricted. */
	async findAll(membership: ResolvedMembership): Promise<BranchResponse[]> {
		const branches = await this.branchRepository.find({
			where: {
				businessId: membership.businessId,
				...(membership.branchIds ? { id: In(membership.branchIds) } : {}),
			},
			order: { isDefault: "DESC", createdAt: "ASC" },
		});
		return branches.map(toBranchResponse);
	}

	/**
	 * Plan gating (multi-branch is a Business-plan entitlement) belongs here once the
	 * subscriptions module exists — checked on the server, never only hidden in the UI.
	 */
	async create(
		membership: ResolvedMembership,
		dto: CreateBranchDto
	): Promise<BranchResponse> {
		await this.entitlements.assertBranchSlot(
			this.branchRepository.manager,
			membership.businessId
		);
		const branch = await this.branchRepository.save(
			this.branchRepository.create({
				businessId: membership.businessId,
				name: dto.name,
				phone: dto.phone ?? null,
				address: dto.address ?? null,
				isDefault: false,
			})
		);
		// The dashboard's "all branches" figures and branch-scoped keys change with the list.
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return toBranchResponse(branch);
	}

	async update(
		membership: ResolvedMembership,
		branchId: string,
		dto: UpdateBranchDto
	): Promise<BranchResponse> {
		// Scoped by businessId as well as id: a branch id from another tenant must 404, not
		// update someone else's shop.
		const branch = await this.branchRepository.findOne({
			where: { id: branchId, businessId: membership.businessId },
		});
		if (!branch) throw new NotFoundException("Branch not found");

		if (dto.isActive === false && branch.isDefault) {
			throw new BadRequestException("The default branch cannot be deactivated");
		}

		Object.assign(branch, dto);
		const saved = await this.branchRepository.save(branch);
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return toBranchResponse(saved);
	}
}

const toBranchResponse = (branch: Branch): BranchResponse => ({
	id: branch.id,
	name: branch.name,
	phone: branch.phone,
	address: branch.address,
	isDefault: branch.isDefault,
	isActive: branch.isActive,
});
