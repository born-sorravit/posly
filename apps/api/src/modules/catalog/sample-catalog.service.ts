import { BusinessRepository } from "@/models/businesses/business.repository";
import { Category } from "@/models/catalog/entities/category.entity";
import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { ModifierOption } from "@/models/catalog/entities/modifier-option.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { SAMPLE_CATALOGS } from "@/modules/catalog/sample-catalog";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class SampleCatalogService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly businessRepository: BusinessRepository
	) {}

	/** One transaction: a half-seeded menu is worse than none. */
	async seed(membership: ResolvedMembership): Promise<{ products: number }> {
		const business = await this.businessRepository.findOne({
			where: { id: membership.businessId },
		});
		if (!business) throw new NotFoundException("Business not found");

		const sample = SAMPLE_CATALOGS[business.businessType];

		return this.dataSource.transaction(async (manager) => {
			const existing = await manager.count(Product, {
				where: { businessId: business.id },
			});
			if (existing > 0) {
				throw new ConflictException("This business already has products");
			}

			const groups = new Map<string, ModifierGroup>();
			for (const [index, g] of sample.groups.entries()) {
				const group = await manager.save(
					manager.create(ModifierGroup, {
						businessId: business.id,
						name: g.name,
						selection: g.selection,
						required: g.required,
						displayOrder: index,
						options: g.options.map((o, i) =>
							manager.create(ModifierOption, {
								name: o.name,
								priceDelta: o.priceDelta,
								isDefault: o.isDefault ?? false,
								displayOrder: i,
							})
						),
					})
				);
				groups.set(g.key, group);
			}

			let count = 0;
			for (const [index, c] of sample.categories.entries()) {
				const category = await manager.save(
					manager.create(Category, {
						businessId: business.id,
						name: c.name,
						icon: c.icon,
						displayOrder: index + 1,
					})
				);
				for (const p of c.products) {
					await manager.save(
						manager.create(Product, {
							businessId: business.id,
							categoryId: category.id,
							name: p.name,
							price: p.price,
							cost: p.cost,
							art: p.art,
							unit: p.unit,
							trackStock: p.stock !== undefined,
							stock: p.stock ?? null,
							lowStockAt:
								p.stock !== undefined ? Math.max(1, Math.round(p.stock / 4)) : null,
							modifierGroups: (p.groups ?? [])
								.map((key) => groups.get(key))
								.filter((g): g is ModifierGroup => Boolean(g)),
						})
					);
					count++;
				}
			}

			return { products: count };
		});
	}
}
