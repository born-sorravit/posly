import {
	CreateUploadDto,
	UploadTicketResponse,
} from "@/modules/storage/dto/upload.dto";
import { StorageService } from "@/modules/storage/storage.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

@ApiTags("storage")
@ApiBearerAuth()
@Controller("businesses/:businessId/uploads")
export class StorageController {
	constructor(private readonly storageService: StorageService) {}

	@Post()
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({
		summary: "Get a signed URL to upload an image straight to Supabase Storage",
		description:
			"The browser PUTs the file to `uploadUrl`, then saves `path` on the product or business.",
	})
	@ApiOkResponse({ type: UploadTicketResponse })
	create(
		@CurrentMembership() membership: ResolvedMembership,
		@Body() dto: CreateUploadDto
	): Promise<UploadTicketResponse> {
		// A logo is store identity, not catalogue: it needs the stronger permission.
		if (
			dto.purpose === "business-logo" &&
			!membership.permissions.includes(Permission.BUSINESS_MANAGE)
		) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return this.storageService.createUploadTicket(
			membership.businessId,
			dto.purpose,
			dto.contentType,
			dto.size
		);
	}
}
