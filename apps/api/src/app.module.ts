import configuration, { getEnvFilePath } from "@/config/configuration";
import { ModelModule } from "@/models/model.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { BranchesModule } from "@/modules/branches/branches.module";
import { BusinessesModule } from "@/modules/businesses/businesses.module";
import { CatalogModule } from "@/modules/catalog/catalog.module";
import { MembersModule } from "@/modules/members/members.module";
import { OrdersModule } from "@/modules/orders/orders.module";
import { ReportsModule } from "@/modules/reports/reports.module";
import { CustomersModule } from "@/modules/customers/customers.module";
import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { BillingModule } from "@/modules/billing/billing.module";
import { KitchenModule } from "@/modules/kitchen/kitchen.module";
import { RealtimeModule } from "@/modules/realtime/realtime.module";
import { HealthController } from "@/modules/health/health.controller";
import { QueueModule } from "@/modules/queue/queue.module";
import { StorageModule } from "@/modules/storage/storage.module";
import { SubscriptionsModule } from "@/modules/subscriptions/subscriptions.module";
import { CacheModule } from "@/shared/cache/cache.module";
import { MailModule } from "@/shared/mail/mail.service";
import { DatabaseModule } from "@/shared/database/database.module";
import { BusinessAccessGuard } from "@/shared/guards/business-access.guard";
import { FeatureGuard } from "@/shared/guards/feature.guard";
import { JwtAuthGuard } from "@/shared/guards/jwt-auth.guard";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [configuration],
			envFilePath: getEnvFilePath(),
			cache: true,
		}),
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => [
				{
					ttl: config.get<number>("security.throttle.ttlSeconds", 60) * 1000,
					limit: config.get<number>("security.throttle.limit", 120),
				},
			],
		}),
		ScheduleModule.forRoot(),
		DatabaseModule,
		CacheModule,
		MailModule,
		ModelModule,
		QueueModule,
		StorageModule,
		SubscriptionsModule,
		AuthModule,
		BusinessesModule,
		BranchesModule,
		MembersModule,
		CatalogModule,
		OrdersModule,
		ReportsModule,
		ExpensesModule,
		NotificationsModule,
		BillingModule,
		KitchenModule,
		RealtimeModule,
		CustomersModule,
	],
	controllers: [HealthController],
	providers: [
		// Order matters: throttle before any crypto work, then who you are, then which
		// business you may act in and with what permissions.
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: BusinessAccessGuard },
		// Last: needs the membership the access guard resolved.
		{ provide: APP_GUARD, useClass: FeatureGuard },
	],
})
export class AppModule {}
