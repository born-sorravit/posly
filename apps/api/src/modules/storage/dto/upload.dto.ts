import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, Min } from "class-validator";

export const UPLOAD_PURPOSES = ["product-image", "business-logo"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const IMAGE_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export class CreateUploadDto {
	@ApiProperty({ enum: UPLOAD_PURPOSES })
	@IsIn(UPLOAD_PURPOSES)
	purpose: UploadPurpose;

	@ApiProperty({ enum: IMAGE_CONTENT_TYPES })
	@IsIn(IMAGE_CONTENT_TYPES)
	contentType: (typeof IMAGE_CONTENT_TYPES)[number];

	@ApiProperty({
		description: "File size in bytes, checked against the upload limit",
	})
	@IsInt()
	@Min(1)
	size: number;
}

export class UploadTicketResponse {
	@ApiProperty({ description: "PUT the file body here, with the same Content-Type" })
	uploadUrl: string;

	@ApiProperty({
		description: "Object path; send this back when saving the product/logo",
	})
	path: string;

	@ApiProperty({ description: "Where the image will be served once uploaded" })
	publicUrl: string;
}
