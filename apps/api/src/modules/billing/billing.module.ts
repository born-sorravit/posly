import {
	BillingController,
	BillingWebhookController,
} from "@/modules/billing/billing.controller";
import { BillingService } from "@/modules/billing/billing.service";
import { stripeProvider } from "@/modules/billing/stripe.provider";
import { Global, Module } from "@nestjs/common";

/** Global: the shop detail reports whether online payment is available. */
@Global()
@Module({
	controllers: [BillingController, BillingWebhookController],
	providers: [stripeProvider, BillingService],
	exports: [BillingService],
})
export class BillingModule {}
