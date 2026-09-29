import { AppModule } from "@/app.module";
import { ResponseFormatInterceptor } from "@/shared/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "@/shared/filters/global.filter";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { DataSource } from "typeorm";

const urls = new WeakMap<INestApplication, string>();

/**
 * Configures an app exactly as main.ts does (minus Swagger) and has it listen on one
 * loopback port for the whole suite.
 *
 * Handing supertest the bare server instead makes it start and stop a throwaway listener
 * per request (`listen(0)` on `::`, requests to `127.0.0.1`). Under a full run that churn
 * occasionally answered a request with another request's response — a register that
 * "returned 200", a lookup that "returned 403". One long-lived listener removes it.
 */
export async function startApp(app: INestApplication): Promise<INestApplication> {
	app.setGlobalPrefix("api", { exclude: ["healthcheck"] });
	app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	app.useGlobalInterceptors(new ResponseFormatInterceptor());
	app.useGlobalFilters(new GlobalExceptionFilter());
	await app.listen(0, "127.0.0.1");
	const address = app.getHttpServer().address() as { port: number };
	urls.set(app, `http://127.0.0.1:${address.port}`);
	return app;
}

export async function bootApp(): Promise<INestApplication> {
	const moduleRef = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();
	return startApp(moduleRef.createNestApplication({ rawBody: true }));
}

/** The suite's base URL, e.g. for `fetch` against a streaming endpoint. */
export const baseUrl = (app: INestApplication) => {
	const url = urls.get(app);
	if (!url) throw new Error("App was not started with startApp()");
	return url;
};

export const api = (app: INestApplication) => request(baseUrl(app));

/**
 * Puts a shop on a plan directly — there is no API for it until billing exists. Tests for
 * plan limits use FREE; everything else defaults to PRO so limits stay out of the way.
 */
export async function setPlan(
	app: INestApplication,
	businessId: string,
	plan: "FREE" | "STARTER" | "PRO" | "BUSINESS",
	endDate: Date | null = null
) {
	await app
		.get(DataSource)
		.query(
			`UPDATE subscription SET plan_code = $2, status = 'ACTIVE', end_date = $3 WHERE business_id = $1`,
			[businessId, plan, endDate]
		);
}

/** A fresh account with its own business, seeded with the sample cafe menu. */
export async function ownerWithShop(
	app: INestApplication,
	plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" = "PRO"
) {
	const email = `owner-${randomUUID()}@e2e.test`;
	const register = await api(app)
		.post("/api/v1/auth/register")
		.send({ email, password: "Passw0rd!x", name: "Owner" })
		.expect(201);
	const token = register.body.data.accessToken as string;

	const business = await api(app)
		.post("/api/v1/businesses")
		.set("Authorization", `Bearer ${token}`)
		.send({ name: "E2E Cafe", businessType: "CAFE" })
		.expect(201);
	const businessId = business.body.data.id as string;
	if (plan !== "FREE") await setPlan(app, businessId, plan);

	await api(app)
		.post(`/api/v1/businesses/${businessId}/catalog/sample`)
		.set("Authorization", `Bearer ${token}`)
		.expect(200);

	const products = await api(app)
		.get(`/api/v1/businesses/${businessId}/products`)
		.set("Authorization", `Bearer ${token}`)
		.expect(200);

	return { email, token, businessId, products: products.body.data as ProductRow[] };
}

export interface ProductRow {
	id: string;
	name: string;
	price: number;
	stock: number | null;
	trackStock: boolean;
	modifierGroups: {
		id: string;
		name: string;
		required: boolean;
		options: { id: string; name: string; priceDelta: number }[];
		defaultOptionId: string | null;
	}[];
}

/** Default option for every required group — what the POS pre-selects. */
export const defaults = (p: ProductRow) =>
	p.modifierGroups
		.filter((g) => g.required)
		.map((g) => g.defaultOptionId ?? g.options[0].id);
