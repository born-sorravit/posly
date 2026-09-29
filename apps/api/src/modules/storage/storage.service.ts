import type { StorageConfig } from "@/config/configuration";
import {
	IMAGE_CONTENT_TYPES,
	type UploadPurpose,
	type UploadTicketResponse,
} from "@/modules/storage/dto/upload.dto";
import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

const EXTENSIONS: Record<(typeof IMAGE_CONTENT_TYPES)[number], string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

/**
 * Supabase Storage over its REST API — no SDK, three endpoints.
 *
 * Every object path starts with the business id (`<businessId>/products/<uuid>.webp`), and
 * the id comes from the verified membership, never from the client. A path the client sends
 * back later (on product save) is accepted only if it carries that same prefix, so one shop
 * cannot attach another shop's file.
 */
@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name);
	private readonly config: StorageConfig;

	constructor(configService: ConfigService) {
		this.config = configService.getOrThrow<StorageConfig>("storage");
	}

	get isConfigured(): boolean {
		return Boolean(this.config.supabaseUrl && this.config.serviceRoleKey);
	}

	async createUploadTicket(
		businessId: string,
		purpose: UploadPurpose,
		contentType: (typeof IMAGE_CONTENT_TYPES)[number],
		size: number
	): Promise<UploadTicketResponse> {
		if (!this.isConfigured) {
			throw new ServiceUnavailableException("Image uploads are not configured");
		}
		if (size > this.config.maxUploadBytes) {
			throw new BadRequestException(
				`Image is larger than ${Math.round(this.config.maxUploadBytes / 1024 / 1024)} MB`
			);
		}

		const folder = purpose === "business-logo" ? "logo" : "products";
		const path = `${businessId}/${folder}/${randomUUID()}.${EXTENSIONS[contentType]}`;

		const response = await fetch(
			`${this.config.supabaseUrl}/storage/v1/object/upload/sign/${this.config.bucket}/${path}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.config.serviceRoleKey}`,
					apikey: this.config.serviceRoleKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}),
			}
		).catch(() => null);

		if (!response?.ok) {
			this.logger.error(
				`Signed upload URL failed: ${response?.status ?? "network"}`
			);
			throw new ServiceUnavailableException("Could not prepare the upload");
		}

		// Supabase answers with a path relative to /storage/v1, token included.
		const { url } = (await response.json()) as { url: string };

		return {
			uploadUrl: `${this.config.supabaseUrl}/storage/v1${url}`,
			path,
			publicUrl: this.publicUrl(path),
		};
	}

	publicUrl(path: string): string {
		return `${this.config.supabaseUrl}/storage/v1/object/public/${this.config.bucket}/${path}`;
	}

	/** Guards a client-supplied path before it is saved onto a product or business. */
	assertOwnedPath(businessId: string, path: string): void {
		if (!path.startsWith(`${businessId}/`) || path.includes("..")) {
			throw new BadRequestException("Invalid image path");
		}
	}

	/** Best effort: a leftover image costs a few KB, a failed save costs the user's edit. */
	async remove(path: string): Promise<void> {
		if (!this.isConfigured) return;
		await fetch(
			`${this.config.supabaseUrl}/storage/v1/object/${this.config.bucket}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${this.config.serviceRoleKey}`,
					apikey: this.config.serviceRoleKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ prefixes: [path] }),
			}
		).catch((error: unknown) => {
			this.logger.warn(`Could not delete ${path}: ${String(error)}`);
		});
	}
}
