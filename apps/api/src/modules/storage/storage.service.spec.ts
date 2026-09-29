import type { AppConfig, StorageConfig } from "@/config/configuration";
import { isMediaPath, StorageService } from "@/modules/storage/storage.service";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

const BUSINESS_ID = "3f1c2a4e-9b7d-4c1e-8a2f-5d6e7f8a9b0c";
const OBJECT_ID = "8a2f5d6e-7f8a-4b0c-9b7d-3f1c2a4e4c1e";

const STORAGE: StorageConfig = {
	endpoint: "https://t3.storageapi.dev",
	region: "auto",
	bucket: "posly-test",
	accessKeyId: "key",
	secretAccessKey: "secret",
	forcePathStyle: false,
	publicBaseUrl: "https://api.posly.test",
	maxUploadBytes: 5 * 1024 * 1024,
};

const APP = { apiPrefix: "api", corsOrigins: ["https://posly.test"] } as AppConfig;

const build = (storage: Partial<StorageConfig> = {}) =>
	new StorageService({
		getOrThrow: (key: string) =>
			key === "storage" ? { ...STORAGE, ...storage } : APP,
	} as unknown as ConfigService);

describe("isMediaPath", () => {
	it("accepts the paths upload tickets mint", () => {
		expect(isMediaPath(`${BUSINESS_ID}/products/${OBJECT_ID}.webp`)).toBe(true);
		expect(isMediaPath(`${BUSINESS_ID}/logo/${OBJECT_ID}.png`)).toBe(true);
	});

	it.each([
		`${BUSINESS_ID}/products/${OBJECT_ID}.svg`,
		`${BUSINESS_ID}/other/${OBJECT_ID}.jpg`,
		`${BUSINESS_ID}/products/../logo/${OBJECT_ID}.jpg`,
		`${BUSINESS_ID}/products/${OBJECT_ID}.jpg/extra`,
		"anything.jpg",
	])("rejects %s", (path) => {
		expect(isMediaPath(path)).toBe(false);
	});
});

describe("StorageService", () => {
	it("serves images through this API's stable /media URL", () => {
		expect(build().publicUrl(`${BUSINESS_ID}/logo/${OBJECT_ID}.png`)).toBe(
			`https://api.posly.test/api/v1/media/${BUSINESS_ID}/logo/${OBJECT_ID}.png`
		);
	});

	it("presigns a PUT for the business's folder with no checksum a browser cannot send", async () => {
		const ticket = await build().createUploadTicket(
			BUSINESS_ID,
			"product-image",
			"image/webp",
			1024
		);

		expect(ticket.path).toMatch(new RegExp(`^${BUSINESS_ID}/products/.+\\.webp$`));
		expect(isMediaPath(ticket.path)).toBe(true);

		const url = new URL(ticket.uploadUrl);
		expect(url.host).toBe("posly-test.t3.storageapi.dev");
		expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
		expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
		expect(
			[...url.searchParams.keys()].some((k) => k.startsWith("x-amz-checksum"))
		).toBe(false);
	});

	it("refuses a file over the limit before signing anything", async () => {
		await expect(
			build().createUploadTicket(
				BUSINESS_ID,
				"business-logo",
				"image/png",
				6 * 1024 * 1024
			)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("reports uploads as unavailable without bucket credentials", async () => {
		const service = build({ endpoint: "", accessKeyId: "" });
		expect(service.isConfigured).toBe(false);
		await expect(
			service.createUploadTicket(BUSINESS_ID, "product-image", "image/png", 1024)
		).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
