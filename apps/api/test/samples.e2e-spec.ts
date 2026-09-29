import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("sample menus", () => {
	let app: INestApplication;
	let token: string;

	beforeAll(async () => {
		app = await bootApp();
		({ token } = await ownerWithShop(app));
	});
	afterAll(async () => {
		await app.close();
	});

	const names = (preview: { products: { name: string }[] }[]) =>
		preview.flatMap((c) => c.products.map((p) => p.name));

	it("previews a menu that fits the shop type, and needs a signed-in user", async () => {
		const restaurant = await api(app)
			.get("/api/v1/catalog/samples/RESTAURANT")
			.set(auth(token))
			.expect(200);
		expect(names(restaurant.body.data)).toEqual(
			expect.arrayContaining(["ข้าวกะเพรา", "ผัดไทยกุ้งสด", "ต้มยำกุ้ง"])
		);
		expect(names(restaurant.body.data)).not.toContain("Americano");

		const cafe = await api(app)
			.get("/api/v1/catalog/samples/CAFE")
			.set(auth(token))
			.expect(200);
		expect(names(cafe.body.data)).toContain("Latte");

		const retail = await api(app)
			.get("/api/v1/catalog/samples/RETAIL")
			.set(auth(token))
			.expect(200);
		expect(names(retail.body.data)).toContain("น้ำดื่ม 600ml");

		await api(app)
			.get("/api/v1/catalog/samples/SPACESHIP")
			.set(auth(token))
			.expect(400);
		await api(app).get("/api/v1/catalog/samples/CAFE").expect(401);
	});

	it("seeds exactly the previewed menu for a restaurant", async () => {
		const shop = await api(app)
			.post("/api/v1/businesses")
			.set(auth(token))
			.send({ name: "ร้านข้าวแกง", businessType: "RESTAURANT" })
			.expect(201);
		const base = `/api/v1/businesses/${shop.body.data.id}`;
		await api(app).post(`${base}/catalog/sample`).set(auth(token)).expect(200);

		const preview = await api(app)
			.get("/api/v1/catalog/samples/RESTAURANT")
			.set(auth(token));
		const products = await api(app)
			.get(`${base}/products`)
			.set(auth(token))
			.expect(200);
		expect(products.body.data.map((p: { name: string }) => p.name).sort()).toEqual(
			names(preview.body.data).sort()
		);

		const kaprao = products.body.data.find(
			(p: { name: string }) => p.name === "ข้าวกะเพรา"
		);
		expect(kaprao).toMatchObject({ art: "rice", unit: "จาน", trackStock: false });
		expect(kaprao.modifierGroups.map((g: { name: string }) => g.name)).toEqual(
			expect.arrayContaining(["เนื้อสัตว์", "ความเผ็ด", "เพิ่มเติม"])
		);
	});
});
