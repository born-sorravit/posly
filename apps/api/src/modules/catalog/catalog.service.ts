import { AuditLog } from "@/models/audit/entities/audit-log.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { CategoryRepository } from "@/models/catalog/category.repository";
import { Category } from "@/models/catalog/entities/category.entity";
import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { ModifierOption } from "@/models/catalog/entities/modifier-option.entity";
import { ModifierSelection } from "@/shared/enums/order.enum";
import { Product } from "@/models/catalog/entities/product.entity";
import { ModifierGroupRepository } from "@/models/catalog/modifier-group.repository";
import { ProductRepository } from "@/models/catalog/product.repository";
import {
	toModifierGroupResponse,
	toProductResponse,
} from "@/modules/catalog/catalog.mapper";
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
	StockAdjustmentType,
	UpdateProductDto,
} from "@/modules/catalog/dto/catalog.dto";
import { StorageService } from "@/modules/storage/storage.service";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { OrderDirection } from "@/shared/dto/pagination.dto";
import { PaginatedResponse, paginate } from "@/shared/utils/pagination.util";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";

/**
 * Categories, products and modifier groups.
 *
 * Every read and write is keyed by `membership.businessId`; an id from another tenant is a
 * 404 exactly like an id that does not exist.
 */
@Injectable()
export class CatalogService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly categoryRepository: CategoryRepository,
		private readonly productRepository: ProductRepository,
		private readonly modifierGroupRepository: ModifierGroupRepository,
		private readonly storageService: StorageService,
		private readonly notifications: NotificationsService,
		private readonly cacheService: CacheService
	) {}

	/** The dashboard lists low stock and product names: a product change retires it. */
	private productsChanged(membership: ResolvedMembership) {
		return this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
	}

	// ---------------------------------------------------------------- categories

	async findCategories(membership: ResolvedMembership): Promise<CategoryResponse[]> {
		const categories = await this.categoryRepository.find({
			where: { businessId: membership.businessId },
			order: { displayOrder: "ASC", createdAt: "ASC" },
		});

		// One grouped count rather than a query per category.
		const counts = await this.productRepository
			.createQueryBuilder("product")
			.select("product.category_id", "categoryId")
			.addSelect("COUNT(*)::int", "count")
			.where("product.business_id = :businessId", {
				businessId: membership.businessId,
			})
			.groupBy("product.category_id")
			.getRawMany<{ categoryId: string | null; count: number }>();
		const byId = new Map(counts.map((c) => [c.categoryId, c.count]));

		return categories.map((c) => ({
			id: c.id,
			name: c.name,
			icon: c.icon,
			displayOrder: c.displayOrder,
			isActive: c.isActive,
			sendToKitchen: c.sendToKitchen,
			productCount: byId.get(c.id) ?? 0,
		}));
	}

	async createCategory(
		membership: ResolvedMembership,
		dto: CreateCategoryDto
	): Promise<CategoryResponse> {
		const last = await this.categoryRepository.findOne({
			where: { businessId: membership.businessId },
			order: { displayOrder: "DESC" },
		});
		const category = await this.categoryRepository.save(
			this.categoryRepository.create({
				businessId: membership.businessId,
				name: dto.name,
				icon: dto.icon ?? "package",
				isActive: dto.isActive ?? true,
				sendToKitchen: dto.sendToKitchen ?? true,
				displayOrder: (last?.displayOrder ?? 0) + 1,
			})
		);
		return { ...this.categoryFields(category), productCount: 0 };
	}

	async updateCategory(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateCategoryDto
	): Promise<CategoryResponse> {
		const category = await this.loadCategory(membership, id);
		Object.assign(category, dto);
		await this.categoryRepository.save(category);
		const productCount = await this.productRepository.count({
			where: { businessId: membership.businessId, categoryId: id },
		});
		return { ...this.categoryFields(category), productCount };
	}

	/** Products in a deleted category become uncategorised rather than disappearing. */
	async deleteCategory(membership: ResolvedMembership, id: string): Promise<void> {
		const category = await this.loadCategory(membership, id);
		await this.productRepository.update(
			{ businessId: membership.businessId, categoryId: id },
			{ categoryId: null }
		);
		await this.categoryRepository.softRemove(category);
	}

	/** The POS chip order. Ids not in this business are ignored rather than trusted. */
	async reorderCategories(
		membership: ResolvedMembership,
		dto: ReorderCategoriesDto
	): Promise<CategoryResponse[]> {
		await this.dataSource.transaction(async (manager) => {
			for (const [index, id] of dto.ids.entries()) {
				await manager.update(
					Category,
					{ id, businessId: membership.businessId },
					{ displayOrder: index + 1 }
				);
			}
		});
		return this.findCategories(membership);
	}

	// ---------------------------------------------------------------- modifier groups

	async findModifierGroups(
		membership: ResolvedMembership
	): Promise<ModifierGroupResponse[]> {
		const groups = await this.modifierGroupRepository.find({
			where: { businessId: membership.businessId },
			relations: { options: true },
			order: { displayOrder: "ASC", createdAt: "ASC" },
		});
		const counts = new Map(
			(
				(await this.dataSource.query(
					`SELECT pmg.modifier_group_id AS id, COUNT(*)::int AS n
					 FROM product_modifier_group pmg JOIN product p ON p.id = pmg.product_id
					 WHERE p.business_id = $1 AND p.deleted_at IS NULL GROUP BY pmg.modifier_group_id`,
					[membership.businessId]
				)) as { id: string; n: number }[]
			).map((r) => [r.id, r.n])
		);
		return groups.map((g) => ({
			...toModifierGroupResponse(g),
			productCount: counts.get(g.id) ?? 0,
		}));
	}

	/**
	 * Replaces a group's settings and options. Options sent with an id keep it — so a cart
	 * holding "Size: L" still checks out — ones without are new, and missing ones are removed.
	 * Past orders are unaffected: they store the option names they were sold with.
	 */
	async updateModifierGroup(
		membership: ResolvedMembership,
		id: string,
		dto: CreateModifierGroupDto
	): Promise<ModifierGroupResponse> {
		this.assertModifierOptions(dto);
		const group = await this.modifierGroupRepository.findOne({
			where: { id, businessId: membership.businessId },
			relations: { options: true },
		});
		if (!group) throw new NotFoundException("Option group not found");

		const existing = new Map(group.options.map((o) => [o.id, o]));
		if (dto.options.some((o) => o.id && !existing.has(o.id))) {
			throw new BadRequestException("Unknown option in this group");
		}

		await this.dataSource.transaction(async (manager) => {
			const keep = new Set(dto.options.flatMap((o) => (o.id ? [o.id] : [])));
			const removed = group.options.filter((o) => !keep.has(o.id)).map((o) => o.id);
			if (removed.length)
				await manager.softDelete(ModifierOption, { id: In(removed) });

			await manager.update(
				ModifierGroup,
				{ id: group.id },
				{
					name: dto.name,
					selection: dto.selection,
					required: dto.required,
				}
			);
			for (const [index, o] of dto.options.entries()) {
				const values = {
					name: o.name,
					priceDelta: o.priceDelta,
					isDefault:
						dto.selection === ModifierSelection.SINGLE && (o.isDefault ?? false),
					displayOrder: index,
				};
				if (o.id) await manager.update(ModifierOption, { id: o.id }, values);
				else
					await manager.save(
						manager.create(ModifierOption, { ...values, groupId: group.id })
					);
			}
		});

		const saved = await this.modifierGroupRepository.findOneOrFail({
			where: { id: group.id },
			relations: { options: true },
		});
		return toModifierGroupResponse(saved);
	}

	/** Removes a group and detaches it from every product; past orders keep their snapshots. */
	async deleteModifierGroup(
		membership: ResolvedMembership,
		id: string
	): Promise<void> {
		const group = await this.modifierGroupRepository.findOne({
			where: { id, businessId: membership.businessId },
		});
		if (!group) throw new NotFoundException("Option group not found");
		await this.dataSource.transaction(async (manager) => {
			await manager.query(
				`DELETE FROM product_modifier_group WHERE modifier_group_id = $1`,
				[group.id]
			);
			await manager.softDelete(ModifierOption, { groupId: group.id });
			await manager.softDelete(ModifierGroup, { id: group.id });
		});
	}

	/** One default at most in a single-choice group, and no two options with the same name. */
	private assertModifierOptions(dto: CreateModifierGroupDto) {
		const names = dto.options.map((o) => o.name.toLowerCase());
		if (new Set(names).size !== names.length) {
			throw new BadRequestException("Two options in a group cannot share a name");
		}
		if (
			dto.selection === ModifierSelection.SINGLE &&
			dto.options.filter((o) => o.isDefault).length > 1
		) {
			throw new BadRequestException(
				"A single-choice group can have only one default"
			);
		}
	}

	async createModifierGroup(
		membership: ResolvedMembership,
		dto: CreateModifierGroupDto
	): Promise<ModifierGroupResponse> {
		this.assertModifierOptions(dto);
		const group = await this.modifierGroupRepository.save(
			this.modifierGroupRepository.create({
				businessId: membership.businessId,
				name: dto.name,
				selection: dto.selection,
				required: dto.required,
				options: dto.options.map((o, index) =>
					Object.assign(new ModifierOption(), {
						name: o.name,
						priceDelta: o.priceDelta,
						isDefault: o.isDefault ?? false,
						displayOrder: index,
					})
				),
			})
		);
		return toModifierGroupResponse(group);
	}

	// ---------------------------------------------------------------- products

	async findProducts(membership: ResolvedMembership): Promise<ProductResponse[]> {
		const products = await this.productRepository.find({
			where: { businessId: membership.businessId },
			relations: { modifierGroups: { options: true } },
			order: { name: "ASC" },
		});
		return products.map((p) => this.toResponse(p, membership));
	}

	async findProduct(
		membership: ResolvedMembership,
		id: string
	): Promise<ProductResponse> {
		return this.toResponse(await this.loadProduct(membership, id), membership);
	}

	async createProduct(
		membership: ResolvedMembership,
		dto: CreateProductDto
	): Promise<ProductResponse> {
		const product = this.productRepository.create({
			businessId: membership.businessId,
		});
		await this.applyProduct(membership, product, dto);
		await this.saveProduct(product);
		await this.productsChanged(membership);
		return this.findProduct(membership, product.id);
	}

	/**
	 * A manual stock change, recorded in the audit log with the before and after counts.
	 *
	 * The row is locked for the transaction, so a sale landing at the same moment is applied
	 * either wholly before or wholly after — a count of "20 on the shelf" never silently
	 * overwrites a checkout's decrement, and removing more than is there is refused.
	 */
	async adjustStock(
		membership: ResolvedMembership,
		id: string,
		dto: AdjustStockDto
	): Promise<ProductResponse> {
		await this.dataSource.transaction(async (manager) => {
			const product = await manager.findOne(Product, {
				where: { id, businessId: membership.businessId },
				lock: { mode: "pessimistic_write" },
			});
			if (!product) throw new NotFoundException("Product not found");
			if (!product.trackStock) {
				throw new BadRequestException("Product does not track stock");
			}

			const before = product.stock ?? 0;
			const after =
				dto.type === StockAdjustmentType.IN
					? before + dto.quantity
					: dto.type === StockAdjustmentType.OUT
						? before - dto.quantity
						: dto.quantity;
			if (dto.type !== StockAdjustmentType.COUNT && dto.quantity === 0) {
				throw new BadRequestException("Quantity must be at least 1");
			}
			if (after < 0) {
				throw new ConflictException(`Only ${before} in stock`);
			}

			await manager.update(Product, { id: product.id }, { stock: after });
			await this.notifications.stockChanged(
				manager,
				membership.businessId,
				product,
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
					entity: "product",
					entityId: product.id,
					payload: {
						type: dto.type,
						quantity: dto.quantity,
						before,
						after,
						note: dto.note || null,
					},
				})
			);
		});

		await this.productsChanged(membership);
		return this.findProduct(membership, id);
	}

	/**
	 * Stock adjustment history, newest first. It is read straight from the audit log, which
	 * `adjustStock` writes in the same transaction as the change — one source of truth.
	 */
	async findStockAdjustments(
		membership: ResolvedMembership,
		query: QueryStockAdjustmentsDto
	): Promise<PaginatedResponse<StockAdjustmentResponse>> {
		const qb = this.dataSource
			.getRepository(AuditLog)
			.createQueryBuilder("log")
			.where("log.businessId = :businessId", { businessId: membership.businessId })
			.andWhere("log.action = :action", { action: AuditAction.STOCK_ADJUSTED })
			.andWhere("log.entity = 'product'");
		if (query.productId) {
			qb.andWhere("log.entityId = :productId", { productId: query.productId });
		}
		if (query.type) {
			qb.andWhere("log.payload ->> 'type' = :type", { type: query.type });
		}

		const page = await paginate(
			qb,
			query,
			{ createdAt: "log.created_at" },
			{ expression: "log.created_at", order: OrderDirection.DESC }
		);

		// One lookup for the page's products, deleted ones included, so old rows keep a name.
		const ids = [...new Set(page.data.map((log) => log.entityId))];
		const products =
			ids.length === 0
				? []
				: await this.productRepository.find({
						where: { id: In(ids), businessId: membership.businessId },
						withDeleted: true,
					});
		const byId = new Map(products.map((p) => [p.id, p]));

		return page.map((log) => {
			const payload = log.payload as {
				type: StockAdjustmentType;
				quantity: number;
				before: number;
				after: number;
				note: string | null;
			};
			const product = byId.get(log.entityId);
			return {
				id: log.id,
				createdAt: log.createdAt,
				productId: log.entityId,
				productName: product?.name ?? "—",
				productUnit: product?.unit ?? "",
				art: product?.art ?? "cookie",
				productDeleted: !product || Boolean(product.deletedAt),
				type: payload.type,
				quantity: payload.quantity,
				before: payload.before,
				after: payload.after,
				change: payload.after - payload.before,
				note: payload.note ?? null,
				actorName: log.actorName,
			};
		});
	}

	async updateProduct(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateProductDto
	): Promise<ProductResponse> {
		const product = await this.loadProduct(membership, id);
		const previousImage = product.imagePath;
		await this.applyProduct(membership, product, dto);
		await this.saveProduct(product);
		await this.productsChanged(membership);
		if (previousImage && previousImage !== product.imagePath) {
			void this.storageService.remove(previousImage);
		}
		return this.findProduct(membership, id);
	}

	/** Soft delete: past orders keep pointing at it, and the SKU is freed (partial index). */
	async deleteProduct(membership: ResolvedMembership, id: string): Promise<void> {
		const product = await this.loadProduct(membership, id);
		await this.productRepository.softRemove(product);
		await this.productsChanged(membership);
	}

	private async applyProduct(
		membership: ResolvedMembership,
		product: Product,
		dto: UpdateProductDto
	): Promise<void> {
		const { modifierGroupIds, categoryId, imagePath, ...fields } = dto;

		if (categoryId !== undefined) {
			if (categoryId !== null) await this.loadCategory(membership, categoryId);
			product.categoryId = categoryId;
		}

		if (imagePath !== undefined) {
			if (imagePath !== null)
				this.storageService.assertOwnedPath(membership.businessId, imagePath);
			product.imagePath = imagePath;
		}

		if (modifierGroupIds !== undefined) {
			const groups =
				modifierGroupIds.length === 0
					? []
					: await this.modifierGroupRepository.find({
							where: { id: In(modifierGroupIds), businessId: membership.businessId },
						});
			if (groups.length !== new Set(modifierGroupIds).size) {
				throw new BadRequestException("Unknown modifier group");
			}
			product.modifierGroups = groups;
		}

		Object.assign(product, fields);

		if (
			product.trackStock &&
			(product.stock === null || product.stock === undefined)
		) {
			product.stock = 0;
		}
	}

	private async saveProduct(product: Product): Promise<void> {
		try {
			await this.productRepository.save(product);
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "23505"
			) {
				throw new ConflictException("SKU is already used by another product");
			}
			throw error;
		}
	}

	private async loadCategory(
		membership: ResolvedMembership,
		id: string
	): Promise<Category> {
		const category = await this.categoryRepository.findOne({
			where: { id, businessId: membership.businessId },
		});
		if (!category) throw new NotFoundException("Category not found");
		return category;
	}

	private async loadProduct(
		membership: ResolvedMembership,
		id: string
	): Promise<Product> {
		const product = await this.productRepository.findOne({
			where: { id, businessId: membership.businessId },
			relations: { modifierGroups: { options: true } },
		});
		if (!product) throw new NotFoundException("Product not found");
		return product;
	}

	private categoryFields(c: Category) {
		return {
			id: c.id,
			name: c.name,
			icon: c.icon,
			displayOrder: c.displayOrder,
			isActive: c.isActive,
			sendToKitchen: c.sendToKitchen,
		};
	}

	/**
	 * Cost is the shop's margin, not something a cashier needs to ring up a sale — and the
	 * POS reads this same endpoint, so without this a cashier could read every cost price
	 * from the browser's network tab. Only members who can edit products receive it.
	 */
	private toResponse(
		product: Product,
		membership: ResolvedMembership
	): ProductResponse {
		const response = toProductResponse(product, (path) =>
			this.storageService.publicUrl(path)
		);
		return membership.permissions.includes(Permission.PRODUCTS_WRITE)
			? response
			: { ...response, cost: null };
	}
}
