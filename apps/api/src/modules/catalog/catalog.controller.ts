import { CatalogService } from "@/modules/catalog/catalog.service";
import {
	AdjustStockDto,
	QueryStockAdjustmentsDto,
	StockAdjustmentResponse,
	CategoryResponse,
	CreateCategoryDto,
	CreateModifierGroupDto,
	CreateProductDto,
	ModifierGroupResponse,
	ProductResponse,
	ReorderCategoriesDto,
	UpdateCategoryDto,
	UpdateProductDto,
} from "@/modules/catalog/dto/catalog.dto";
import { SampleCatalogService } from "@/modules/catalog/sample-catalog.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Feature } from "@/shared/enums/subscription.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { PaginatedResponse } from "@/shared/utils/pagination.util";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

@ApiTags("catalog")
@ApiBearerAuth()
@Controller("businesses/:businessId")
export class CatalogController {
	constructor(
		private readonly catalogService: CatalogService,
		private readonly sampleCatalogService: SampleCatalogService
	) {}

	// ---------------------------------------------------------------- categories

	@Get("categories")
	@RequirePermission(Permission.PRODUCTS_READ)
	@ApiOperation({ summary: "Categories in POS display order" })
	@ApiOkResponse({ type: [CategoryResponse] })
	findCategories(
		@CurrentMembership() m: ResolvedMembership
	): Promise<CategoryResponse[]> {
		return this.catalogService.findCategories(m);
	}

	@Post("categories")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: CategoryResponse })
	createCategory(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateCategoryDto
	): Promise<CategoryResponse> {
		return this.catalogService.createCategory(m, dto);
	}

	/** Declared before `:categoryId` so "order" is not read as an id. */
	@Put("categories/order")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({ summary: "Reorder categories" })
	@ApiOkResponse({ type: [CategoryResponse] })
	reorderCategories(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: ReorderCategoriesDto
	): Promise<CategoryResponse[]> {
		return this.catalogService.reorderCategories(m, dto);
	}

	@Patch("categories/:categoryId")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: CategoryResponse })
	updateCategory(
		@CurrentMembership() m: ResolvedMembership,
		@Param("categoryId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateCategoryDto
	): Promise<CategoryResponse> {
		return this.catalogService.updateCategory(m, id, dto);
	}

	@Delete("categories/:categoryId")
	@HttpCode(200)
	@RequirePermission(Permission.PRODUCTS_WRITE)
	async deleteCategory(
		@CurrentMembership() m: ResolvedMembership,
		@Param("categoryId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.catalogService.deleteCategory(m, id);
		return { deleted: true };
	}

	// ---------------------------------------------------------------- modifier groups

	@Get("modifier-groups")
	@RequirePermission(Permission.PRODUCTS_READ)
	@ApiOkResponse({ type: [ModifierGroupResponse] })
	findModifierGroups(
		@CurrentMembership() m: ResolvedMembership
	): Promise<ModifierGroupResponse[]> {
		return this.catalogService.findModifierGroups(m);
	}

	@Post("modifier-groups")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: ModifierGroupResponse })
	createModifierGroup(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateModifierGroupDto
	): Promise<ModifierGroupResponse> {
		return this.catalogService.createModifierGroup(m, dto);
	}

	@Put("modifier-groups/:groupId")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({
		summary:
			"Replace a group's settings and options; options sent with an id keep it",
	})
	@ApiOkResponse({ type: ModifierGroupResponse })
	updateModifierGroup(
		@CurrentMembership() m: ResolvedMembership,
		@Param("groupId", ParseUUIDPipe) id: string,
		@Body() dto: CreateModifierGroupDto
	): Promise<ModifierGroupResponse> {
		return this.catalogService.updateModifierGroup(m, id, dto);
	}

	@Delete("modifier-groups/:groupId")
	@HttpCode(200)
	@RequirePermission(Permission.PRODUCTS_WRITE)
	async deleteModifierGroup(
		@CurrentMembership() m: ResolvedMembership,
		@Param("groupId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.catalogService.deleteModifierGroup(m, id);
		return { deleted: true };
	}

	// ---------------------------------------------------------------- products

	@Get("products")
	@RequirePermission(Permission.PRODUCTS_READ)
	@ApiOperation({ summary: "Every product with its modifier groups (the POS menu)" })
	@ApiOkResponse({ type: [ProductResponse] })
	findProducts(
		@CurrentMembership() m: ResolvedMembership
	): Promise<ProductResponse[]> {
		return this.catalogService.findProducts(m);
	}

	@Get("products/:productId")
	@RequirePermission(Permission.PRODUCTS_READ)
	@ApiOkResponse({ type: ProductResponse })
	findProduct(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) id: string
	): Promise<ProductResponse> {
		return this.catalogService.findProduct(m, id);
	}

	@Post("products")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: ProductResponse })
	createProduct(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateProductDto
	): Promise<ProductResponse> {
		return this.catalogService.createProduct(m, dto);
	}

	@Patch("products/:productId")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: ProductResponse })
	updateProduct(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateProductDto
	): Promise<ProductResponse> {
		return this.catalogService.updateProduct(m, id, dto);
	}

	@Post("products/:productId/stock-adjustments")
	@HttpCode(200)
	@RequirePermission(Permission.INVENTORY_WRITE)
	@RequireFeature(Feature.INVENTORY)
	@ApiOperation({ summary: "Receive, write off or count stock for one product" })
	@ApiOkResponse({ type: ProductResponse })
	adjustStock(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) id: string,
		@Body() dto: AdjustStockDto
	): Promise<ProductResponse> {
		return this.catalogService.adjustStock(m, id, dto);
	}

	@Get("stock-adjustments")
	@RequirePermission(Permission.INVENTORY_WRITE)
	@RequireFeature(Feature.INVENTORY)
	@ApiOperation({ summary: "Stock adjustment history, newest first" })
	@ApiOkResponse({ type: [StockAdjustmentResponse] })
	findStockAdjustments(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryStockAdjustmentsDto
	): Promise<PaginatedResponse<StockAdjustmentResponse>> {
		return this.catalogService.findStockAdjustments(m, query);
	}

	@Delete("products/:productId")
	@HttpCode(200)
	@RequirePermission(Permission.PRODUCTS_WRITE)
	async deleteProduct(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.catalogService.deleteProduct(m, id);
		return { deleted: true };
	}

	// ---------------------------------------------------------------- onboarding

	@Post("catalog/sample")
	@HttpCode(200)
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({
		summary: "Seed a starter menu for the business's type",
		description:
			"Refused once the business has any product, so it can never duplicate a menu.",
	})
	seedSample(
		@CurrentMembership() m: ResolvedMembership
	): Promise<{ products: number }> {
		return this.sampleCatalogService.seed(m);
	}
}
