import {
	AdjustIngredientStockDto,
	CreateIngredientDto,
	IngredientResponse,
	RecipeResponse,
	SetRecipeDto,
	UpdateIngredientDto,
} from "@/modules/inventory/dto/inventory.dto";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Feature } from "@/shared/enums/subscription.enum";
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
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

@ApiTags("inventory")
@ApiBearerAuth()
@RequireFeature(Feature.INVENTORY)
@Controller("businesses/:businessId")
export class InventoryController {
	constructor(private readonly inventoryService: InventoryService) {}

	// ---------------------------------------------------------------- ingredients

	@Get("ingredients")
	@RequirePermission(Permission.PRODUCTS_READ)
	@ApiOperation({
		summary: "Ingredients, by name; prices only for members who edit products",
	})
	@ApiOkResponse({ type: [IngredientResponse] })
	findIngredients(
		@CurrentMembership() m: ResolvedMembership
	): Promise<IngredientResponse[]> {
		return this.inventoryService.findIngredients(m);
	}

	@Post("ingredients")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: IngredientResponse })
	createIngredient(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateIngredientDto
	): Promise<IngredientResponse> {
		return this.inventoryService.createIngredient(m, dto);
	}

	@Patch("ingredients/:ingredientId")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({
		summary: "Edit an ingredient; a new price re-costs every recipe using it",
	})
	@ApiOkResponse({ type: IngredientResponse })
	updateIngredient(
		@CurrentMembership() m: ResolvedMembership,
		@Param("ingredientId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateIngredientDto
	): Promise<IngredientResponse> {
		return this.inventoryService.updateIngredient(m, id, dto);
	}

	@Delete("ingredients/:ingredientId")
	@HttpCode(200)
	@RequirePermission(Permission.PRODUCTS_WRITE)
	async deleteIngredient(
		@CurrentMembership() m: ResolvedMembership,
		@Param("ingredientId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.inventoryService.deleteIngredient(m, id);
		return { deleted: true };
	}

	@Post("ingredients/:ingredientId/stock-adjustments")
	@HttpCode(200)
	@RequirePermission(Permission.INVENTORY_WRITE)
	@ApiOperation({ summary: "Receive, write off or count one ingredient" })
	@ApiOkResponse({ type: IngredientResponse })
	adjustStock(
		@CurrentMembership() m: ResolvedMembership,
		@Param("ingredientId", ParseUUIDPipe) id: string,
		@Body() dto: AdjustIngredientStockDto
	): Promise<IngredientResponse> {
		return this.inventoryService.adjustStock(m, id, dto);
	}

	// ---------------------------------------------------------------- recipes

	@Get("products/:productId/recipe")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: RecipeResponse })
	findProductRecipe(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) productId: string
	): Promise<RecipeResponse> {
		return this.inventoryService.findRecipe(m, { productId });
	}

	@Put("products/:productId/recipe")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({ summary: "Replace a product's recipe and set its cost from it" })
	@ApiOkResponse({ type: RecipeResponse })
	setProductRecipe(
		@CurrentMembership() m: ResolvedMembership,
		@Param("productId", ParseUUIDPipe) productId: string,
		@Body() dto: SetRecipeDto
	): Promise<RecipeResponse> {
		return this.inventoryService.setRecipe(m, { productId }, dto);
	}

	@Get("modifier-options/:optionId/recipe")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOkResponse({ type: RecipeResponse })
	findOptionRecipe(
		@CurrentMembership() m: ResolvedMembership,
		@Param("optionId", ParseUUIDPipe) optionId: string
	): Promise<RecipeResponse> {
		return this.inventoryService.findRecipe(m, { optionId });
	}

	@Put("modifier-options/:optionId/recipe")
	@RequirePermission(Permission.PRODUCTS_WRITE)
	@ApiOperation({
		summary: "Replace an option's recipe and set its extra cost from it",
	})
	@ApiOkResponse({ type: RecipeResponse })
	setOptionRecipe(
		@CurrentMembership() m: ResolvedMembership,
		@Param("optionId", ParseUUIDPipe) optionId: string,
		@Body() dto: SetRecipeDto
	): Promise<RecipeResponse> {
		return this.inventoryService.setRecipe(m, { optionId }, dto);
	}
}
