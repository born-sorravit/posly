import { samplePreview } from "@/modules/catalog/sample-catalog";
import { BusinessType } from "@/shared/enums/business-type.enum";
import { Controller, Get, Param, ParseEnumPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

/**
 * The sample menu for a shop type, before the shop exists — onboarding shows it so "use
 * sample data" says exactly what it will create. Signed-in only (the global JWT guard);
 * there is no `:businessId`, and nothing here is tenant data.
 */
@ApiTags("catalog")
@ApiBearerAuth()
@Controller("catalog/samples")
export class SampleCatalogController {
	@Get(":businessType")
	@ApiOperation({
		summary: "Categories and products the sample menu for a shop type creates",
	})
	preview(
		@Param("businessType", new ParseEnumPipe(BusinessType)) type: BusinessType
	) {
		return samplePreview(type);
	}
}
