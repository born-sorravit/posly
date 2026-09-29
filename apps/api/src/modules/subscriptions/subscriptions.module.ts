import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { PlansController } from "@/modules/subscriptions/plans.controller";
import { Global, Module } from "@nestjs/common";

/** Global: checkout, members, branches and the feature guard all consult entitlements. */
@Global()
@Module({
	controllers: [PlansController],
	providers: [EntitlementsService],
	exports: [EntitlementsService],
})
export class SubscriptionsModule {}
