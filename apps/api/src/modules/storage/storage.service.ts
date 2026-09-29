import type { AppConfig, StorageConfig } from "@/config/configuration";
import {
	IMAGE_CONTENT_TYPES,
	type UploadPurpose,
	type UploadTicketResponse,
} from "@/modules/storage/dto/upload.dto";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutBucketCorsCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	BadRequestException,
	Injectable,
	Logger,
	OnModuleInit,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

const EXTENSIONS: Record<(typeof IMAGE_CONTENT_TYPES)[number], string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** How long a redirect from `/media/<path>` stays valid; the redirect is cached for less. */
export const READ_URL_TTL_SECONDS = 60 * 60;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** The only shape `createUploadTicket` ever mints, so `/media` serves nothing else. */
const MEDIA_PATH = new RegExp(`^${UUID}/(products|logo)/${UUID}\\.(jpg|png|webp)$`);

export const isMediaPath = (path: string): boolean => MEDIA_PATH.test(path);

/**
 * An S3-compatible bucket (Railway Storage Buckets) through the AWS SDK.
 *
 * Every object path starts with the business id (`<businessId>/products/<uuid>.webp`), and
 * the id comes from the verified membership, never from the client. A path the client sends
 * back later (on product save) is accepted only if it carries that same prefix, so one shop
 * cannot attach another shop's file.
 *
 * The bucket is private: `publicUrl` points at this API's `/media/<path>`, a stable URL that
 * can live in a receipt email, and that route redirects to a short-lived presigned GET.
 */
@Injectable()
export class StorageService implements OnModuleInit {
	private readonly logger = new Logger(StorageService.name);
	private readonly config: StorageConfig;
	private readonly app: AppConfig;
	private readonly client: S3Client | null;

	constructor(configService: ConfigService) {
		this.config = configService.getOrThrow<StorageConfig>("storage");
		this.app = configService.getOrThrow<AppConfig>("app");
		this.client = this.isConfigured
			? new S3Client({
					endpoint: this.config.endpoint,
					region: this.config.region,
					forcePathStyle: this.config.forcePathStyle,
					credentials: {
						accessKeyId: this.config.accessKeyId,
						secretAccessKey: this.config.secretAccessKey,
					},
					// Otherwise the SDK signs a CRC32 checksum into every presigned PUT, which a
					// browser's plain PUT cannot match.
					requestChecksumCalculation: "WHEN_REQUIRED",
					responseChecksumValidation: "WHEN_REQUIRED",
				})
			: null;
	}

	get isConfigured(): boolean {
		return Boolean(
			this.config.endpoint &&
				this.config.bucket &&
				this.config.accessKeyId &&
				this.config.secretAccessKey
		);
	}

	/**
	 * The browser PUTs straight to the bucket, which a bucket refuses cross-origin without a
	 * CORS rule. Setting it on boot keeps it in step with CORS_ORIGINS; a failure only warns,
	 * since the rule may have been set by hand instead (see docs/deployment.md).
	 */
	async onModuleInit(): Promise<void> {
		if (!this.client) return;
		await this.client
			.send(
				new PutBucketCorsCommand({
					Bucket: this.config.bucket,
					CORSConfiguration: {
						CORSRules: [
							{
								AllowedOrigins: this.app.corsOrigins,
								AllowedMethods: ["PUT", "GET", "HEAD"],
								AllowedHeaders: ["Content-Type"],
								MaxAgeSeconds: 3600,
							},
						],
					},
				})
			)
			.catch((error: unknown) => {
				this.logger.warn(`Could not set the bucket's CORS rule: ${String(error)}`);
			});
	}

	async createUploadTicket(
		businessId: string,
		purpose: UploadPurpose,
		contentType: (typeof IMAGE_CONTENT_TYPES)[number],
		size: number
	): Promise<UploadTicketResponse> {
		if (!this.client) {
			throw new ServiceUnavailableException("Image uploads are not configured");
		}
		if (size > this.config.maxUploadBytes) {
			throw new BadRequestException(
				`Image is larger than ${Math.round(this.config.maxUploadBytes / 1024 / 1024)} MB`
			);
		}

		const folder = purpose === "business-logo" ? "logo" : "products";
		const path = `${businessId}/${folder}/${randomUUID()}.${EXTENSIONS[contentType]}`;

		// Content-Length is signed too, so the bucket itself holds the size limit.
		const uploadUrl = await getSignedUrl(
			this.client,
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: path,
				ContentType: contentType,
				ContentLength: size,
			}),
			{ expiresIn: UPLOAD_URL_TTL_SECONDS }
		).catch((error: unknown) => {
			this.logger.error(`Presigned upload URL failed: ${String(error)}`);
			throw new ServiceUnavailableException("Could not prepare the upload");
		});

		return { uploadUrl, path, publicUrl: this.publicUrl(path) };
	}

	publicUrl(path: string): string {
		return `${this.config.publicBaseUrl}/${this.app.apiPrefix}/v1/media/${path}`;
	}

	/** A short-lived GET for one object; `/media/<path>` redirects here. */
	signedReadUrl(path: string): Promise<string> {
		if (!this.client) {
			throw new ServiceUnavailableException("Image storage is not configured");
		}
		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.config.bucket, Key: path }),
			{ expiresIn: READ_URL_TTL_SECONDS }
		);
	}

	/** Guards a client-supplied path before it is saved onto a product or business. */
	assertOwnedPath(businessId: string, path: string): void {
		if (!path.startsWith(`${businessId}/`) || path.includes("..")) {
			throw new BadRequestException("Invalid image path");
		}
	}

	/** Best effort: a leftover image costs a few KB, a failed save costs the user's edit. */
	async remove(path: string): Promise<void> {
		if (!this.client) return;
		await this.client
			.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: path }))
			.catch((error: unknown) => {
				this.logger.warn(`Could not delete ${path}: ${String(error)}`);
			});
	}
}
