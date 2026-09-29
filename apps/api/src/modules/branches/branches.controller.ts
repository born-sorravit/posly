import {
	BranchResponse,
	CreateBranchDto,
	UpdateBranchDto,
} from "@/modules/branches/dto/branch.dto";
import { BranchesService } from "@/modules/branches/branches.service";
import { DemoBlocked } from "@/shared/decorators/demo-blocked.decorator";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

@ApiTags("branches")
@ApiBearerAuth()
@Controller("businesses/:businessId/branches")
export class BranchesController {
	constructor(private readonly branchesService: BranchesService) {}

	@Get()
	@ApiOperation({ summary: "Branches the caller may work in" })
	@ApiOkResponse({ type: [BranchResponse] })
	findAll(
		@CurrentMembership() membership: ResolvedMembership
	): Promise<BranchResponse[]> {
		return this.branchesService.findAll(membership);
	}

	@Post()
	@DemoBlocked()
	@RequirePermission(Permission.BRANCHES_MANAGE)
	@ApiOperation({ summary: "Add a branch" })
	@ApiOkResponse({ type: BranchResponse })
	create(
		@CurrentMembership() membership: ResolvedMembership,
		@Body() dto: CreateBranchDto
	): Promise<BranchResponse> {
		return this.branchesService.create(membership, dto);
	}

	@Patch(":branchId")
	@DemoBlocked()
	@RequirePermission(Permission.BRANCHES_MANAGE)
	@ApiOperation({ summary: "Update a branch" })
	@ApiOkResponse({ type: BranchResponse })
	update(
		@CurrentMembership() membership: ResolvedMembership,
		@Param("branchId", ParseUUIDPipe) branchId: string,
		@Body() dto: UpdateBranchDto
	): Promise<BranchResponse> {
		return this.branchesService.update(membership, branchId, dto);
	}
}
