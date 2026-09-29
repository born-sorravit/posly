import {
	isMediaPath,
	READ_URL_TTL_SECONDS,
	StorageService,
} from "@/modules/storage/storage.service";
import { Public } from "@/shared/decorators/public.decorator";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";

/**
 * Stable, public image URLs over a private bucket.
 *
 * Answers with a redirect to a presigned GET rather than the bytes, so files come straight
 * from the bucket (whose egress is free) and never through this instance. Object paths hold
 * a random UUID, so knowing one is the same as having been shown the image.
 */
@ApiTags("storage")
@Controller("media")
export class MediaController {
	constructor(private readonly storageService: StorageService) {}

	@Public()
	// One catalogue page loads dozens of images, often through Vercel's shared optimizer IPs.
	@SkipThrottle()
	@Get("*path")
	@ApiOperation({ summary: "Redirect to a product image or store logo" })
	async show(
		@Param("path") segments: string[] | string,
		@Res() res: Response
	): Promise<void> {
		// Express 5 hands a `*path` wildcard over as its segments.
		const path = Array.isArray(segments) ? segments.join("/") : segments;
		if (!isMediaPath(path)) throw new NotFoundException();

		const url = await this.storageService.signedReadUrl(path);
		// Cached for less than the presigned URL lives, so a cached redirect never points at
		// an expired signature.
		res.setHeader(
			"Cache-Control",
			`public, max-age=${Math.floor(READ_URL_TTL_SECONDS * 0.8)}`
		);
		res.redirect(302, url);
	}
}
