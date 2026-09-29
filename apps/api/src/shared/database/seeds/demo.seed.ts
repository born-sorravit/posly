import { AuditLog } from "@/models/audit/entities/audit-log.entity";
import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Category } from "@/models/catalog/entities/category.entity";
import { Customer } from "@/models/customers/entities/customer.entity";
import { Expense } from "@/models/expenses/entities/expense.entity";
import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { ModifierOption } from "@/models/catalog/entities/modifier-option.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { OrderItemModifier } from "@/models/orders/entities/order-item-modifier.entity";
import { Payment } from "@/models/orders/entities/payment.entity";
import { Subscription } from "@/models/subscriptions/entities/subscription.entity";
import { User } from "@/models/users/entities/user.entity";
import { computeOrderTotals } from "@/modules/orders/pricing";
import {
	DEMO_ACCOUNTS,
	DEMO_EMAIL_DOMAIN,
	DEMO_PASSWORD,
	DEMO_SHOPS,
	type DemoShop,
} from "@/shared/database/seeds/demo.data";
import { dataSourceOptions } from "@/shared/database/typeorm.config";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import { AuthProvider } from "@/shared/enums/auth-provider.enum";
import { ExpenseCategory } from "@/shared/enums/expense-category.enum";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import {
	ModifierSelection,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
} from "@/shared/enums/order.enum";
import { getLocalDateString } from "@/shared/utils/date.util";
import { Logger } from "@nestjs/common";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DataSource, type EntityManager, In, Like } from "typeorm";

/**
 * Demo shops with 30 days of sales history.
 *
 *   pnpm seed:demo            create them (refuses if they already exist)
 *   pnpm seed:demo -- --reset remove everything it created, then create it again
 *   pnpm seed:demo -- --remove remove everything it created
 *
 * Orders are generated, not rung up through the API, so they are inserted in bulk — but
 * every total comes from the same `computeOrderTotals` the checkout uses, and item and
 * modifier snapshots are filled exactly as a real sale fills them. The randomness is seeded,
 * so two runs on the same day produce the same shops.
 */

const logger = new Logger("DemoSeed");
const DAYS = 30;
const CHUNK = 400;

/** mulberry32: small, fast, deterministic. */
const rng = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d_2b_79_f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
	return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};

const pickWeighted = <T>(
	random: () => number,
	items: T[],
	weight: (item: T, i: number) => number
): T => {
	const weights = items.map(weight);
	let roll = random() * weights.reduce((a, b) => a + b, 0);
	for (const [i, item] of items.entries()) {
		roll -= weights[i];
		if (roll <= 0) return item;
	}
	return items[items.length - 1];
};

/** Regulars, so the customers page and the POS picker have someone to show. */
const REGULARS: [string, string | null][] = [
	["คุณพลอย", "0891112233"],
	["คุณเก่ง", "0815557788"],
	["Mr. James", null],
	["คุณแนน", "0862224455"],
	["คุณบีม", "0843336677"],
	["พี่ต่าย", "0829998811"],
	["คุณมายด์", "0871234567"],
	["น้องฟ้า", "0897654321"],
	["คุณโอ๊ต", "0834445566"],
	["ป้าศรี", "0856667788"],
];

const PAYMENT_MIX: Record<string, [PaymentMethod, number][]> = {
	CAFE: [
		[PaymentMethod.PROMPTPAY, 55],
		[PaymentMethod.CASH, 30],
		[PaymentMethod.CARD, 15],
	],
	BAKERY: [
		[PaymentMethod.PROMPTPAY, 50],
		[PaymentMethod.CASH, 45],
		[PaymentMethod.CARD, 5],
	],
	RETAIL: [
		[PaymentMethod.CASH, 60],
		[PaymentMethod.PROMPTPAY, 38],
		[PaymentMethod.OTHER, 2],
	],
};

async function removeDemo(dataSource: DataSource): Promise<void> {
	const users = await dataSource
		.getRepository(User)
		.find({ where: { email: Like(`%@${DEMO_EMAIL_DOMAIN}`) } });
	if (users.length === 0) return;
	const userIds = users.map((u) => u.id);

	const members = await dataSource
		.getRepository(BusinessMember)
		.find({ where: { userId: In(userIds) } });
	const businessIds = [...new Set(members.map((m) => m.businessId))];

	await dataSource.transaction(async (m) => {
		if (businessIds.length > 0) {
			// Children first: orders and catalogue rows reference the business without cascades.
			for (const table of ["audit_log", "payment"]) {
				await m.query(`DELETE FROM "${table}" WHERE business_id = ANY($1)`, [
					businessIds,
				]);
			}
			await m.query(`DELETE FROM "order" WHERE business_id = ANY($1)`, [
				businessIds,
			]);
			await m.query(
				`DELETE FROM product_modifier_group WHERE product_id IN (SELECT id FROM product WHERE business_id = ANY($1))`,
				[businessIds]
			);
			// Customers, expenses, notifications, members and branches cascade with the business.
			for (const table of ["product", "category", "modifier_group"]) {
				await m.query(`DELETE FROM "${table}" WHERE business_id = ANY($1)`, [
					businessIds,
				]);
			}
			await m.query(`DELETE FROM business WHERE id = ANY($1)`, [businessIds]);
		}
		await m.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
	});
	logger.log(
		`Removed ${businessIds.length} demo shops and ${userIds.length} demo accounts`
	);
}

async function createAccounts(m: EntityManager): Promise<Map<string, User>> {
	const passwordHash = await hash(DEMO_PASSWORD, 10);
	const users = new Map<string, User>();
	for (const account of DEMO_ACCOUNTS) {
		const user = await m.save(
			m.create(User, {
				email: account.email,
				name: account.name,
				passwordHash,
				provider: AuthProvider.PASSWORD,
				isVerified: true,
				locale: "th",
			})
		);
		users.set(account.key, user);
	}
	return users;
}

interface Menu {
	product: Product;
	groups: ModifierGroup[];
}

async function createShop(
	m: EntityManager,
	shop: DemoShop,
	users: Map<string, User>,
	seed: number
): Promise<{
	orders: number;
	customers: number;
	expenses: number;
	business: Business;
}> {
	const random = rng(seed);

	const business = await m.save(
		m.create(Business, {
			name: shop.name,
			businessType: shop.businessType,
			phone: shop.phone,
			address: shop.address,
			taxId: shop.taxId,
			promptPayId: shop.promptPayId,
			vatBasisPoints: shop.vatBasisPoints,
			pricesIncludeVat: shop.pricesIncludeVat,
			onboardedAt: new Date(Date.now() - (DAYS + 3) * 86_400_000),
		})
	);

	// Demo shops show the paid features; more than one branch needs Business.
	await m.save(
		m.create(Subscription, {
			businessId: business.id,
			planCode: shop.branches.length > 1 ? PlanCode.BUSINESS : PlanCode.PRO,
			status: SubscriptionStatus.ACTIVE,
			startDate: new Date(),
			endDate: null,
		})
	);

	const branches = await m.save(
		shop.branches.map((name, i) =>
			m.create(Branch, {
				businessId: business.id,
				name,
				isDefault: i === 0,
				phone: shop.phone,
			})
		)
	);

	const members = await m.save(
		shop.members.map((member) => {
			const user = users.get(member.account) as User;
			return m.create(BusinessMember, {
				businessId: business.id,
				userId: user.id,
				email: user.email,
				displayName: member.displayName,
				role: member.role,
				status: MemberStatus.ACTIVE,
			});
		})
	);
	// A staff invite still waiting, so the employees page shows that state too.
	await m.save(
		m.create(BusinessMember, {
			businessId: business.id,
			userId: null,
			email: `new-staff-${business.id.slice(0, 6)}@example.com`,
			displayName: "พนักงานใหม่",
			role: MemberRole.STAFF,
			status: MemberStatus.INVITED,
			inviteExpiresAt: new Date(Date.now() + 5 * 86_400_000),
		})
	);

	const groups = new Map<string, ModifierGroup>();
	for (const [i, g] of shop.catalog.groups.entries()) {
		groups.set(
			g.key,
			await m.save(
				m.create(ModifierGroup, {
					businessId: business.id,
					name: g.name,
					selection: g.selection,
					required: g.required,
					displayOrder: i,
					options: g.options.map((o, j) =>
						m.create(ModifierOption, {
							name: o.name,
							priceDelta: o.priceDelta,
							isDefault: o.isDefault ?? false,
							displayOrder: j,
						})
					),
				})
			)
		);
	}

	const menu: Menu[] = [];
	for (const [i, c] of shop.catalog.categories.entries()) {
		const category = await m.save(
			m.create(Category, {
				businessId: business.id,
				name: c.name,
				icon: c.icon,
				displayOrder: i + 1,
			})
		);
		for (const p of c.products) {
			const productGroups = (p.groups ?? [])
				.map((key) => groups.get(key))
				.filter((g): g is ModifierGroup => Boolean(g));
			const product = await m.save(
				m.create(Product, {
					businessId: business.id,
					categoryId: category.id,
					name: p.name,
					price: p.price,
					cost: p.cost,
					art: p.art,
					unit: p.unit,
					trackStock: p.stock !== undefined,
					stock: p.stock ?? null,
					// A quarter of the shelf, at least six — so a few items start the demo "low".
					lowStockAt:
						p.stock !== undefined ? Math.max(6, Math.round(p.stock * 0.25)) : null,
					modifierGroups: productGroups,
				})
			);
			menu.push({ product, groups: productGroups });
		}
	}

	const customers = await m.save(
		REGULARS.map(([name, phone]) =>
			m.create(Customer, {
				businessId: business.id,
				name,
				phone,
				email: phone ? null : "james@example.com",
				note: null,
			})
		)
	);

	// ------------------------------------------------------------------ sales history
	const sellers = members.filter((mem) => mem.role !== MemberRole.STAFF);
	const mix = PAYMENT_MIX[shop.businessType] ?? PAYMENT_MIX.CAFE;
	const [open, close] = shop.hours;
	const hours = Array.from({ length: close - open }, (_, i) => open + i);
	const nowBangkokHour = Number(
		new Intl.DateTimeFormat("en-GB", {
			hour: "numeric",
			hour12: false,
			timeZone: "Asia/Bangkok",
		}).format(new Date())
	);

	const orders: Record<string, unknown>[] = [];
	const items: Record<string, unknown>[] = [];
	const modifiers: Record<string, unknown>[] = [];
	const payments: Record<string, unknown>[] = [];
	const audits: Record<string, unknown>[] = [];
	const timeline: { at: Date; build: (n: number) => void }[] = [];

	for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
		const date = getLocalDateString(new Date(Date.now() - dayOffset * 86_400_000));
		const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
		const weekend = weekday === 0 || weekday === 6;
		// A gentle upward trend over the month, busier weekends, and ±20% day-to-day noise.
		const trend = 0.85 + (0.3 * (DAYS - dayOffset)) / DAYS;
		let count = Math.round(
			shop.ordersPerDay * trend * (weekend ? 1.3 : 1) * (0.8 + random() * 0.4)
		);
		const openHours =
			dayOffset === 0 ? hours.filter((h) => h <= nowBangkokHour) : hours;
		if (openHours.length === 0) continue;
		if (dayOffset === 0)
			count = Math.round((count * openHours.length) / hours.length);

		for (let n = 0; n < count; n++) {
			const hour = pickWeighted(random, openHours, (h) => shop.peak(h));
			const minute = Math.floor(random() * 60);
			const second = Math.floor(random() * 60);
			const at = new Date(
				`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+07:00`
			);
			if (at.getTime() > Date.now()) continue;

			const lineCount = pickWeighted(
				random,
				[1, 2, 3, 4],
				(_, i) => [5, 3, 1.5, 0.5][i]
			);
			const lines = Array.from({ length: lineCount }, () => {
				// Earlier menu items sell more — every menu has its best sellers.
				const entry = pickWeighted(random, menu, (_, i) => 1 / (1 + i * 0.25));
				const chosen = entry.groups.flatMap((group) => {
					const options = [...group.options].sort(
						(a, b) => a.displayOrder - b.displayOrder
					);
					if (group.selection === ModifierSelection.SINGLE) {
						if (!group.required && random() < 0.7) return [];
						const fallback = options.find((o) => o.isDefault) ?? options[0];
						return [
							random() < 0.6
								? fallback
								: options[Math.floor(random() * options.length)],
						];
					}
					return options.filter(() => random() < 0.12);
				});
				const unitPrice =
					entry.product.price + chosen.reduce((s, o) => s + o.priceDelta, 0);
				return {
					entry,
					chosen,
					groupName: (optionId: string) =>
						entry.groups.find((g) => g.options.some((o) => o.id === optionId))
							?.name ?? "",
					quantity: random() < 0.15 ? 2 : 1,
					unitPrice,
					unitCost: entry.product.cost ?? 0,
				};
			});

			const discount = random() < 0.05 ? 1000 : 0;
			const totals = computeOrderTotals(
				lines,
				discount,
				shop.vatBasisPoints,
				shop.pricesIncludeVat
			);
			const method = pickWeighted(random, mix, ([, w]) => w)[0];
			const received =
				method === PaymentMethod.CASH
					? pickWeighted(
							random,
							[
								totals.total,
								Math.ceil(totals.total / 10_000) * 10_000,
								Math.ceil(totals.total / 50_000) * 50_000,
								100_000,
							].filter((v) => v >= totals.total),
							() => 1
						)
					: null;
			const roll = random();
			const status =
				roll < 0.015
					? OrderStatus.REFUNDED
					: roll < 0.025
						? OrderStatus.CANCELLED
						: OrderStatus.PAID;
			const seller = pickWeighted(random, sellers, (s) =>
				s.role === MemberRole.CASHIER ? 3 : 1
			);
			const branch =
				branches.length > 1 && random() < 0.35 ? branches[1] : branches[0];
			// About one sale in six names a regular, the first few far more often.
			const customer =
				random() < 0.17
					? pickWeighted(random, customers, (_, i) => 1 / (1 + i * 0.6))
					: null;

			timeline.push({
				at,
				build: (number) => {
					const orderId = randomUUID();
					orders.push({
						id: orderId,
						businessId: business.id,
						branchId: branch.id,
						memberId: seller.id,
						employeeName: seller.displayName,
						customerId: customer?.id ?? null,
						customerName: customer?.name ?? null,
						number,
						clientOrderId: randomUUID(),
						status,
						...totals,
						vatBasisPoints: shop.vatBasisPoints,
						pricesIncludeVat: shop.pricesIncludeVat,
						paidAt: at,
						createdAt: at,
						updatedAt: at,
					});
					for (const [i, line] of lines.entries()) {
						const itemId = randomUUID();
						items.push({
							id: itemId,
							orderId,
							productId: line.entry.product.id,
							name: line.entry.product.name,
							art: line.entry.product.art,
							quantity: line.quantity,
							unitPrice: line.unitPrice,
							unitCost: line.unitCost,
							lineTotal: line.unitPrice * line.quantity,
							note: null,
							// Keeps the line order stable, like a real cart.
							createdAt: new Date(at.getTime() + i),
							updatedAt: at,
						});
						for (const option of line.chosen) {
							modifiers.push({
								orderItemId: itemId,
								optionId: option.id,
								groupName: line.groupName(option.id),
								optionName: option.name,
								priceDelta: option.priceDelta,
								createdAt: at,
								updatedAt: at,
							});
						}
					}
					payments.push({
						businessId: business.id,
						orderId,
						method,
						status:
							status === OrderStatus.PAID
								? PaymentStatus.SUCCESS
								: PaymentStatus.REFUNDED,
						amount: totals.total,
						received,
						change: received === null ? null : received - totals.total,
						reference: null,
						createdAt: at,
						updatedAt: at,
					});
					if (status !== OrderStatus.PAID) {
						const actor =
							members.find((mem) => mem.role !== MemberRole.CASHIER) ?? members[0];
						audits.push({
							businessId: business.id,
							memberId: actor.id,
							actorName: actor.displayName,
							action:
								status === OrderStatus.REFUNDED
									? AuditAction.ORDER_REFUNDED
									: AuditAction.ORDER_CANCELLED,
							entity: "order",
							entityId: orderId,
							payload: {
								reason:
									status === OrderStatus.REFUNDED ? "ลูกค้าขอคืนเงิน" : "กดผิดรายการ",
								total: totals.total,
							},
							createdAt: new Date(at.getTime() + 6 * 60_000),
							updatedAt: at,
						});
					}
				},
			});
		}
	}

	// Numbers follow time, exactly as the checkout's sequence would have issued them.
	timeline.sort((a, b) => a.at.getTime() - b.at.getTime());
	timeline.forEach((entry, i) => entry.build(i + 1));

	const insert = async (entity: unknown, rows: Record<string, unknown>[]) => {
		for (let i = 0; i < rows.length; i += CHUNK) {
			await m
				.createQueryBuilder()
				.insert()
				.into(entity as typeof Order)
				.values(rows.slice(i, i + CHUNK) as never)
				.execute();
		}
	};
	await insert(Order, orders);
	await insert(OrderItem, items);
	await insert(OrderItemModifier, modifiers);
	await insert(Payment, payments);
	await insert(AuditLog, audits);
	await m.update(Business, { id: business.id }, { orderSeq: orders.length });

	// The kitchen screen: everything cooks, the last few sales are still in the kitchen, and
	// everything before them was served ten minutes after it was rung up.
	await m.query(
		`UPDATE order_item SET to_kitchen = true, prepared_at = created_at + interval '8 minutes'
		  WHERE order_id IN (SELECT id FROM "order" WHERE business_id = $1)`,
		[business.id]
	);
	await m.query(
		`UPDATE "order" SET
		   kitchen_status = (CASE
		     WHEN created_at > now() - interval '8 minutes' THEN 'NEW'
		     WHEN created_at > now() - interval '20 minutes' THEN 'PREPARING'
		     WHEN created_at > now() - interval '30 minutes' THEN 'READY'
		     ELSE 'SERVED' END)::order_kitchen_status_enum,
		   kitchen_updated_at = LEAST(now(), created_at + interval '10 minutes')
		 WHERE business_id = $1`,
		[business.id]
	);
	await m.query(
		`UPDATE order_item SET prepared_at = NULL
		  WHERE order_id IN (SELECT id FROM "order" WHERE business_id = $1 AND kitchen_status IN ('NEW', 'PREPARING'))`,
		[business.id]
	);

	// ------------------------------------------------------------------ expenses
	// Sized from the month's gross profit, so every shop keeps a believable net margin —
	// a minimart's thin markup cannot carry a cafe's rent share.
	const grossProfit = orders
		.filter((o) => o.status === OrderStatus.PAID)
		.reduce((sum, o) => sum + (o.total as number) - (o.totalCost as number), 0);
	const owner = members.find((mem) => mem.role === MemberRole.OWNER) ?? members[0];
	const round10 = (satang: number) => Math.round(satang / 1000) * 1000;
	const dayAgo = (days: number) =>
		getLocalDateString(new Date(Date.now() - days * 86_400_000));
	const bills: [ExpenseCategory, number, string, number][] = [
		[ExpenseCategory.RENT, 0.18, "ค่าเช่าร้านเดือนนี้", DAYS - 2],
		[ExpenseCategory.UTILITIES, 0.05, "ค่าไฟ", DAYS - 6],
		[ExpenseCategory.UTILITIES, 0.01, "ค่าน้ำ", DAYS - 6],
		[ExpenseCategory.EQUIPMENT, 0.03, "ซ่อมเครื่อง / อุปกรณ์", 11],
		[ExpenseCategory.OTHER, 0.01, "ถุงและบรรจุภัณฑ์", 4],
	];
	// Stock bought every few days.
	for (let day = DAYS - 3; day >= 1; day -= 4) {
		bills.push([
			ExpenseCategory.INGREDIENTS,
			0.012 + random() * 0.008,
			"ซื้อวัตถุดิบ",
			day,
		]);
	}
	await m.save(
		bills.map(([category, share, note, days]) =>
			m.create(Expense, {
				businessId: business.id,
				category,
				amount: Math.max(1000, round10(grossProfit * share)),
				note,
				spentOn: dayAgo(days),
				memberId: owner.id,
				recordedBy: owner.displayName,
			})
		)
	);

	return {
		orders: orders.length,
		customers: customers.length,
		expenses: bills.length,
		business,
	};
}

const run = async (): Promise<void> => {
	const args = new Set(process.argv.slice(2));
	const dataSource = new DataSource(dataSourceOptions);
	await dataSource.initialize();

	try {
		if (args.has("--reset") || args.has("--remove")) await removeDemo(dataSource);
		if (args.has("--remove")) return;

		const existing = await dataSource
			.getRepository(User)
			.count({ where: { email: Like(`%@${DEMO_EMAIL_DOMAIN}`) } });
		if (existing > 0) {
			logger.warn("Demo data already exists. Run with --reset to recreate it.");
			return;
		}

		const users = await dataSource.transaction((m) => createAccounts(m));
		for (const [i, shop] of DEMO_SHOPS.entries()) {
			const { orders, customers, expenses } = await dataSource.transaction((m) =>
				createShop(m, shop, users, 1000 + i)
			);
			logger.log(
				`${shop.name} (${shop.businessType}): ${orders} orders over ${DAYS} days, ${customers} customers, ${expenses} expenses`
			);
		}

		logger.log(`Password for every demo account: ${DEMO_PASSWORD}`);
		for (const account of DEMO_ACCOUNTS) {
			const shops = DEMO_SHOPS.filter((s) =>
				s.members.some((m) => m.account === account.key)
			)
				.map(
					(s) =>
						`${s.name} (${s.members.find((m) => m.account === account.key)?.role})`
				)
				.join(", ");
			logger.log(`  ${account.email.padEnd(24)} ${shops}`);
		}
	} finally {
		await dataSource.destroy();
	}
};

run().catch((error) => {
	new Logger("DemoSeed").error(
		error instanceof Error ? (error.stack ?? error.message) : String(error)
	);
	process.exit(1);
});
