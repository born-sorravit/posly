import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/** Injection token for the Stripe client; null when STRIPE_SECRET_KEY is not set. */
export const STRIPE = Symbol("STRIPE");

export type StripeClient = Stripe;

export const stripeProvider = {
	provide: STRIPE,
	inject: [ConfigService],
	useFactory: (config: ConfigService): Stripe | null => {
		const key = config.get<string>("billing.stripeSecretKey");
		return key
			? new Stripe(key, {
					appInfo: { name: "Posly" },
					// Stripe-mock and tests point this elsewhere; production leaves it unset.
					...(process.env.STRIPE_API_HOST
						? {
								host: process.env.STRIPE_API_HOST,
								port: Number(process.env.STRIPE_API_PORT ?? 443),
								protocol: (process.env.STRIPE_API_PROTOCOL ?? "https") as
									| "http"
									| "https",
							}
						: {}),
				})
			: null;
	},
};
