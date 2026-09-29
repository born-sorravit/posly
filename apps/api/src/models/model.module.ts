import { AuditLogRepository } from "@/models/audit/audit-log.repository";
import { RefreshTokenRepository } from "@/models/auth/refresh-token.repository";
import { CategoryRepository } from "@/models/catalog/category.repository";
import { ModifierGroupRepository } from "@/models/catalog/modifier-group.repository";
import { ProductRepository } from "@/models/catalog/product.repository";
import { OrderRepository } from "@/models/orders/order.repository";
import { CustomerRepository } from "@/models/customers/customer.repository";
import { ExpenseRepository } from "@/models/expenses/expense.repository";
import { NotificationRepository } from "@/models/notifications/notification.repository";
import { BranchRepository } from "@/models/branches/branch.repository";
import { BusinessMemberRepository } from "@/models/businesses/business-member.repository";
import { BusinessRepository } from "@/models/businesses/business.repository";
import { SubscriptionPlanRepository } from "@/models/subscriptions/subscription-plan.repository";
import { SubscriptionRepository } from "@/models/subscriptions/subscription.repository";
import { UsersRepository } from "@/models/users/user.repository";
import { Global, Module } from "@nestjs/common";

/**
 * Data layer. Entities and repositories live under `src/models/<domain>/`; feature modules
 * under `src/modules/<feature>/` inject these without re-declaring them, because this
 * module is `@Global()`.
 */
const repositories = [
	// Users
	UsersRepository,
	// Auth
	RefreshTokenRepository,
	// Tenancy
	BusinessRepository,
	BusinessMemberRepository,
	BranchRepository,
	// Catalog
	CategoryRepository,
	ProductRepository,
	ModifierGroupRepository,
	// Sales
	OrderRepository,
	AuditLogRepository,
	// Back office
	ExpenseRepository,
	CustomerRepository,
	NotificationRepository,
	// Billing
	SubscriptionPlanRepository,
	SubscriptionRepository,
];

@Global()
@Module({
	providers: [...repositories],
	exports: [...repositories],
})
export class ModelModule {}
