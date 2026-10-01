import { AuditLog } from "@/models/audit/entities/audit-log.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { ModifierOption } from "@/models/catalog/entities/modifier-option.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { Ingredient } from "@/models/inventory/entities/ingredient.entity";
import { RecipeLine } from "@/models/inventory/entities/recipe-line.entity";
import { StockAdjustmentType } from "@/modules/catalog/dto/catalog.dto";
import type {
	AdjustIngredientStockDto,
	CreateIngredientDto,
	IngredientResponse,
	RecipeResponse,
	SetRecipeDto,
	UpdateIngredientDto,
} from "@/modules/inventory/dto/inventory.dto";
import { recipeCost, unitCost } from "@/modules/inventory/recipe-cost";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { averageCost } from "@/shared/utils/average-cost.util";
import { roundQuantity } from "@/shared/utils/quantity.util";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource, type EntityManager, In, IsNull } from "typeorm";

/** Whose recipe: a product's, or a modifier option's. */
export type RecipeOwner = { productId: string } | { optionId: string };

/** One sold line, as far as ingredients care. */
export interface ConsumedLine {
	productId: string;
	optionIds: string[];
	quantity: number;
}

/**
 * Ingredients and recipes (plan phase 2 of costing). A recipe turns into one number — the
 * product's `cost` or the option's `costDelta` — recomputed whenever the recipe or an
 * ingredient's price changes, so checkout keeps reading a single stored cost.
 */
@Injectable()
export class InventoryService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: NotificationsService,
		private readonly cacheService: CacheService
	) {}

	// ---------------------------------------------------------------- ingredients

	async findIngredients(
		membership: ResolvedMembership
	): Promise<IngredientResponse[]> {
		const ingredients = await this.dataSource.getRepository(Ingredient).find({
			where: { businessId: membership.businessId },
			order: { name: "ASC" },
		});
		const usage = await this.usageCounts(
			this.dataSource.manager,
			membership.businessId
		);
		return ingredients.map((i) =>
			this.toResponse(i, usage.get(i.id) ?? 0, membership)
		);
	}

	async createIngredient(
		membership: ResolvedMembership,
		dto: CreateIngredientDto
	): Promise<IngredientResponse> {
		const repository = this.dataSource.getRepository(Ingredient);
		const ingredient = repository.create({
			businessId: membership.businessId,
			name: dto.name,
			unit: dto.unit,
			purchasePrice: dto.purchasePrice,
			purchaseQty: dto.purchaseQty,
			trackStock: dto.trackStock ?? false,
			stock: dto.trackStock ? (dto.stock ?? 0) : null,
			lowStockAt: dto.trackStock ? (dto.lowStockAt ?? null) : null,
		});
		await this.saveUnique(() => repository.save(ingredient));
		return this.toResponse(ingredient, 0, membership);
	}

	/** A new price flows into every recipe that uses the ingredient, in the same transaction. */
	async updateIngredient(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateIngredientDto
	): Promise<IngredientResponse> {
		await this.dataSource.transaction(async (manager) => {
			const ingredient = await this.loadIngredient(manager, membership, id);
			// Recipes hold amounts in this unit: 18 กรัม must not quietly become 18 กิโลกรัม.
			if (dto.unit !== undefined && dto.unit !== ingredient.unit) {
				const usage = await this.usageCounts(manager, membership.businessId);
				if (usage.get(id)) {
					throw new ConflictException(
						"The unit cannot change while recipes use this ingredient"
					);
				}
			}
			const repriced =
				(dto.purchasePrice !== undefined &&
					dto.purchasePrice !== ingredient.purchasePrice) ||
				(dto.purchaseQty !== undefined &&
					dto.purchaseQty !== ingredient.purchaseQty);
			Object.assign(ingredient, dto);
			if (!ingredient.trackStock) {
				ingredient.stock = null;
				ingredient.lowStockAt = null;
			} else if (ingredient.stock === null) {
				ingredient.stock = 0;
			}
			await this.saveUnique(() => manager.save(ingredient));
			if (repriced) await this.recomputeUsing(manager, membership.businessId, [id]);
		});
		if (dto.purchasePrice !== undefined || dto.purchaseQty !== undefined) {
			await this.costsChanged(membership.businessId);
		}
		const ingredient = await this.loadIngredient(
			this.dataSource.manager,
			membership,
			id
		);
		const usage = await this.usageCounts(
			this.dataSource.manager,
			membership.businessId
		);
		return this.toResponse(ingredient, usage.get(id) ?? 0, membership);
	}

	/** Refused while a live recipe uses it: removing it would silently change that cost. */
	async deleteIngredient(membership: ResolvedMembership, id: string): Promise<void> {
		const ingredient = await this.loadIngredient(
			this.dataSource.manager,
			membership,
			id
		);
		const usage = await this.usageCounts(
			this.dataSource.manager,
			membership.businessId
		);
		const used = usage.get(id) ?? 0;
		if (used > 0) {
			throw new ConflictException(`${ingredient.name} is used in ${used} recipes`);
		}
		await this.dataSource.transaction(async (manager) => {
			// Lines left on deleted products or options, which nobody can sell any more.
			await manager.delete(RecipeLine, { ingredientId: id });
			await manager.softDelete(Ingredient, { id });
		});
	}

	/**
	 * Received, written off or counted — the same three kinds as a product, recorded in the
	 * audit log (`entity = 'ingredient'`) with before and after.
	 */
	async adjustStock(
		membership: ResolvedMembership,
		id: string,
		dto: AdjustIngredientStockDto
	): Promise<IngredientResponse> {
		await this.dataSource.transaction(async (manager) => {
			const ingredient = await manager.findOne(Ingredient, {
				where: { id, businessId: membership.businessId },
				lock: { mode: "pessimistic_write" },
			});
			if (!ingredient) throw new NotFoundException("Ingredient not found");
			if (!ingredient.trackStock) {
				throw new BadRequestException("Ingredient does not track stock");
			}
			if (dto.type !== StockAdjustmentType.COUNT && dto.quantity === 0) {
				throw new BadRequestException("Quantity must be more than 0");
			}

			const before = ingredient.stock ?? 0;
			const after = roundQuantity(
				dto.type === StockAdjustmentType.IN
					? before + dto.quantity
					: dto.type === StockAdjustmentType.OUT
						? before - dto.quantity
						: dto.quantity
			);
			if (dto.type === StockAdjustmentType.OUT && after < 0) {
				throw new ConflictException(`Only ${before} in stock`);
			}
			if (dto.totalCost !== undefined && dto.type !== StockAdjustmentType.IN) {
				throw new BadRequestException(
					"A purchase price goes with received stock only"
				);
			}

			// Receiving at a price moves the price per unit to the weighted average of what is
			// left and what arrived, kept in the shop's own buying size (per 1,000 g stays so).
			// A price of 0 was never entered, so it does not drag the average down.
			const costBefore = ingredient.purchasePrice > 0 ? unitCost(ingredient) : null;
			let costAfter = costBefore;
			if (dto.totalCost !== undefined) {
				costAfter = averageCost(
					before,
					costBefore,
					dto.quantity,
					dto.totalCost / dto.quantity
				);
			}
			const repriced = costAfter !== costBefore && costAfter !== null;

			await manager.update(
				Ingredient,
				{ id },
				{
					stock: after,
					...(repriced
						? {
								purchasePrice: Math.round(
									(costAfter as number) * ingredient.purchaseQty
								),
							}
						: {}),
				}
			);
			if (repriced) await this.recomputeUsing(manager, membership.businessId, [id]);
			await this.notifyStock(
				manager,
				membership.businessId,
				ingredient,
				before,
				after
			);

			const actor = await manager.findOneOrFail(BusinessMember, {
				where: { id: membership.memberId },
			});
			await manager.save(
				manager.create(AuditLog, {
					businessId: membership.businessId,
					memberId: membership.memberId,
					actorName: actor.displayName,
					action: AuditAction.STOCK_ADJUSTED,
					entity: "ingredient",
					entityId: id,
					payload: {
						type: dto.type,
						quantity: dto.quantity,
						before,
						after,
						note: dto.note || null,
						...(dto.totalCost !== undefined
							? {
									totalCost: dto.totalCost,
									// Per unit, to four decimals of a satang.
									costBefore:
										costBefore === null
											? null
											: Math.round(costBefore * 10_000) / 10_000,
									costAfter:
										costAfter === null
											? null
											: Math.round(costAfter * 10_000) / 10_000,
								}
							: {}),
					},
				})
			);
		});
		if (dto.totalCost !== undefined) await this.costsChanged(membership.businessId);
		const ingredient = await this.loadIngredient(
			this.dataSource.manager,
			membership,
			id
		);
		const usage = await this.usageCounts(
			this.dataSource.manager,
			membership.businessId
		);
		return this.toResponse(ingredient, usage.get(id) ?? 0, membership);
	}

	// ---------------------------------------------------------------- recipes

	async findRecipe(
		membership: ResolvedMembership,
		owner: RecipeOwner
	): Promise<RecipeResponse> {
		await this.assertOwner(this.dataSource.manager, membership.businessId, owner);
		return this.recipeOf(this.dataSource.manager, owner);
	}

	/**
	 * Replaces the recipe and writes its cost onto the owner. An empty recipe hands the cost
	 * back to the owner's form: the last computed figure stays until someone types another.
	 */
	async setRecipe(
		membership: ResolvedMembership,
		owner: RecipeOwner,
		dto: SetRecipeDto
	): Promise<RecipeResponse> {
		const ids = dto.lines.map((l) => l.ingredientId);
		if (new Set(ids).size !== ids.length) {
			throw new BadRequestException("An ingredient appears twice in the recipe");
		}
		const result = await this.dataSource.transaction(async (manager) => {
			await this.assertOwner(manager, membership.businessId, owner);
			if (ids.length) {
				const found = await manager.count(Ingredient, {
					where: { id: In(ids), businessId: membership.businessId },
				});
				if (found !== ids.length)
					throw new BadRequestException("Unknown ingredient");
			}

			await manager.delete(RecipeLine, this.ownerWhere(owner));
			if (dto.lines.length) {
				await manager.save(
					dto.lines.map((line, index) =>
						manager.create(RecipeLine, {
							businessId: membership.businessId,
							productId: "productId" in owner ? owner.productId : null,
							modifierOptionId: "optionId" in owner ? owner.optionId : null,
							ingredientId: line.ingredientId,
							quantity: line.quantity,
							displayOrder: index,
						})
					)
				);
				await this.recompute(manager, owner);
			}
			return this.recipeOf(manager, owner);
		});
		await this.costsChanged(membership.businessId);
		return result;
	}

	// ---------------------------------------------------------------- sales

	/**
	 * Takes what a sale's recipes use out of tracked ingredients. Never refuses: a kitchen
	 * that is short of one garnish still sells, the stock goes negative and the shop is told.
	 * Returns what was taken, by ingredient id, for the order to keep; null when nothing was.
	 */
	async consume(
		manager: EntityManager,
		businessId: string,
		lines: ConsumedLine[]
	): Promise<Record<string, number> | null> {
		const planned = await this.planUsage(manager, lines);
		if (!planned) return null;
		const { usage, tracked } = planned;

		const byId = new Map(tracked.map((r) => [r.ingredientId, r.ingredient]));
		// A fixed order, so two tills selling the same things lock rows the same way round.
		for (const id of [...usage.keys()].sort()) {
			const amount = roundQuantity(usage.get(id) ?? 0);
			usage.set(id, amount);
			const rows = (await manager.query(
				`UPDATE ingredient SET stock = stock - $2::numeric WHERE id = $1 RETURNING stock`,
				[id, amount]
			)) as [{ stock: string }[], number];
			const after = Number(rows[0][0].stock);
			const ingredient = byId.get(id);
			if (ingredient) {
				await this.notifyStock(
					manager,
					businessId,
					ingredient,
					roundQuantity(after + amount),
					after
				);
			}
		}
		return Object.fromEntries(usage);
	}

	/**
	 * What these lines take from tracked ingredients by today's recipes, without touching
	 * stock: `consume` applies it, and splitting a table's bill uses it to say which part of
	 * the tab's usage goes with the lines being paid.
	 */
	async usageOf(
		manager: EntityManager,
		lines: ConsumedLine[]
	): Promise<Record<string, number> | null> {
		const planned = await this.planUsage(manager, lines);
		if (!planned) return null;
		return Object.fromEntries(
			[...planned.usage.entries()].map(([id, amount]) => [id, roundQuantity(amount)])
		);
	}

	private async planUsage(manager: EntityManager, lines: ConsumedLine[]) {
		const productIds = [...new Set(lines.map((l) => l.productId))];
		const optionIds = [...new Set(lines.flatMap((l) => l.optionIds))];
		if (!productIds.length) return null;

		const recipe = await manager.find(RecipeLine, {
			where: [
				{ productId: In(productIds), deletedAt: IsNull() },
				...(optionIds.length
					? [{ modifierOptionId: In(optionIds), deletedAt: IsNull() }]
					: []),
			],
			relations: { ingredient: true },
		});
		const tracked = recipe.filter(
			(r) => r.ingredient?.trackStock && !r.ingredient.deletedAt
		);
		if (!tracked.length) return null;

		const usage = new Map<string, number>();
		for (const line of lines) {
			for (const r of tracked) {
				const uses =
					r.productId === line.productId ||
					(r.modifierOptionId !== null &&
						line.optionIds.includes(r.modifierOptionId));
				if (uses) {
					usage.set(
						r.ingredientId,
						(usage.get(r.ingredientId) ?? 0) + r.quantity * line.quantity
					);
				}
			}
		}
		return { usage, tracked };
	}

	/** A refund or void puts back exactly what the sale took. */
	async restore(
		manager: EntityManager,
		usage: Record<string, number> | null
	): Promise<void> {
		if (!usage) return;
		for (const id of Object.keys(usage).sort()) {
			await manager.query(
				`UPDATE ingredient SET stock = stock + $2::numeric WHERE id = $1 AND track_stock = true`,
				[id, usage[id]]
			);
		}
	}

	// ---------------------------------------------------------------- internals

	private async recipeOf(
		manager: EntityManager,
		owner: RecipeOwner
	): Promise<RecipeResponse> {
		const lines = await manager.find(RecipeLine, {
			where: this.ownerWhere(owner),
			relations: { ingredient: true },
			withDeleted: false,
			order: { displayOrder: "ASC" },
		});
		return {
			lines: lines.map((l) => ({
				ingredientId: l.ingredientId,
				name: l.ingredient.name,
				unit: l.ingredient.unit,
				quantity: l.quantity,
				cost: l.quantity * unitCost(l.ingredient),
			})),
			cost: recipeCost(lines),
		};
	}

	/** Writes the recipe's cost onto its owner. */
	private async recompute(
		manager: EntityManager,
		owner: RecipeOwner
	): Promise<void> {
		const lines = await manager.find(RecipeLine, {
			where: this.ownerWhere(owner),
			relations: { ingredient: true },
		});
		if (!lines.length) return;
		const cost = recipeCost(lines);
		if ("productId" in owner) {
			await manager.update(Product, { id: owner.productId }, { cost });
		} else {
			await manager.update(
				ModifierOption,
				{ id: owner.optionId },
				{ costDelta: cost }
			);
		}
	}

	/** Every recipe that uses one of these ingredients. */
	private async recomputeUsing(
		manager: EntityManager,
		businessId: string,
		ingredientIds: string[]
	): Promise<void> {
		const rows = (await manager.query(
			`SELECT DISTINCT product_id, modifier_option_id FROM recipe_line
			 WHERE business_id = $1 AND ingredient_id = ANY($2) AND deleted_at IS NULL`,
			[businessId, ingredientIds]
		)) as { product_id: string | null; modifier_option_id: string | null }[];
		for (const row of rows) {
			await this.recompute(
				manager,
				row.product_id
					? { productId: row.product_id }
					: { optionId: row.modifier_option_id as string }
			);
		}
	}

	/** Live products and options whose recipe uses each ingredient. */
	private async usageCounts(
		manager: EntityManager,
		businessId: string
	): Promise<Map<string, number>> {
		const rows = (await manager.query(
			`SELECT r.ingredient_id AS id, COUNT(*)::int AS n FROM recipe_line r
			 LEFT JOIN product p ON p.id = r.product_id
			 LEFT JOIN modifier_option o ON o.id = r.modifier_option_id
			 WHERE r.business_id = $1 AND r.deleted_at IS NULL
			   AND (p.deleted_at IS NULL AND o.deleted_at IS NULL)
			   AND (p.id IS NOT NULL OR o.id IS NOT NULL)
			 GROUP BY r.ingredient_id`,
			[businessId]
		)) as { id: string; n: number }[];
		return new Map(rows.map((r) => [r.id, r.n]));
	}

	private async assertOwner(
		manager: EntityManager,
		businessId: string,
		owner: RecipeOwner
	) {
		if ("productId" in owner) {
			const found = await manager.count(Product, {
				where: { id: owner.productId, businessId },
			});
			if (!found) throw new NotFoundException("Product not found");
			return;
		}
		const [row] = (await manager.query(
			`SELECT 1 FROM modifier_option o JOIN modifier_group g ON g.id = o.group_id
			 WHERE o.id = $1 AND g.business_id = $2 AND o.deleted_at IS NULL AND g.deleted_at IS NULL`,
			[owner.optionId, businessId]
		)) as unknown[];
		if (!row) throw new NotFoundException("Option not found");
	}

	private ownerWhere(owner: RecipeOwner) {
		return "productId" in owner
			? { productId: owner.productId }
			: { modifierOptionId: owner.optionId };
	}

	private async loadIngredient(
		manager: EntityManager,
		membership: ResolvedMembership,
		id: string
	): Promise<Ingredient> {
		const ingredient = await manager.findOne(Ingredient, {
			where: { id, businessId: membership.businessId },
		});
		if (!ingredient) throw new NotFoundException("Ingredient not found");
		return ingredient;
	}

	private notifyStock(
		manager: EntityManager,
		businessId: string,
		ingredient: Ingredient,
		before: number,
		after: number
	) {
		return this.notifications.stockChanged(
			manager,
			businessId,
			ingredient,
			before,
			after,
			{
				ingredient: true,
			}
		);
	}

	/** Costs feed the dashboard's gross profit. */
	private costsChanged(businessId: string) {
		return this.cacheService.bump(CacheKeys.dashboardVersion(businessId));
	}

	private async saveUnique<T>(save: () => Promise<T>): Promise<T> {
		try {
			return await save();
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "23505"
			) {
				throw new ConflictException("An ingredient with this name already exists");
			}
			throw error;
		}
	}

	/** Buying prices are the shop's margin: only members who can edit products see them. */
	private toResponse(
		ingredient: Ingredient,
		usedBy: number,
		membership: ResolvedMembership
	): IngredientResponse {
		const showCost = membership.permissions.includes(Permission.PRODUCTS_WRITE);
		return {
			id: ingredient.id,
			name: ingredient.name,
			unit: ingredient.unit,
			purchasePrice: showCost ? ingredient.purchasePrice : null,
			purchaseQty: ingredient.purchaseQty,
			unitCost: showCost ? unitCost(ingredient) : null,
			trackStock: ingredient.trackStock,
			stock: ingredient.stock,
			lowStockAt: ingredient.lowStockAt,
			usedBy,
		};
	}
}
