import { normaliseEmail, trimmed } from "@/shared/dto/transform.util";
import { DEMO_ROLES, type DemoRole } from "@/shared/utils/demo.util";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsEmail,
	IsIn,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

export class RegisterDto {
	@ApiProperty({ example: "owner@sunnycafe.co" })
	@IsEmail()
	@MaxLength(255)
	// Stored lowercase so "Owner@…" and "owner@…" cannot become two accounts.
	@Transform(normaliseEmail)
	email: string;

	@ApiProperty({ minLength: 8, maxLength: 128 })
	@IsString()
	@MinLength(8)
	@MaxLength(128)
	password: string;

	@ApiProperty({ example: "คุณแนน" })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name: string;

	@ApiPropertyOptional({ enum: ["th", "en"], default: "th" })
	@IsOptional()
	@IsIn(["th", "en"])
	locale?: string;
}

export class LoginDto {
	@ApiProperty()
	@IsEmail()
	@Transform(normaliseEmail)
	email: string;

	@ApiProperty()
	@IsString()
	@MinLength(1)
	password: string;
}

export class DemoLoginDto {
	@ApiProperty({ enum: DEMO_ROLES, example: "owner" })
	@IsIn(DEMO_ROLES)
	role: DemoRole;
}

export class GoogleLoginDto {
	@ApiProperty({
		description: "The ID token (JWT) returned by Google Identity Services",
	})
	@IsString()
	@MinLength(1)
	idToken: string;
}

export class RefreshDto {
	@ApiProperty({
		description: "The opaque refresh token returned by login or refresh",
	})
	@IsString()
	@MinLength(1)
	refreshToken: string;
}

export class UpdateProfileDto {
	@ApiPropertyOptional({ example: "คุณแนน" })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name?: string;

	@ApiPropertyOptional({ enum: ["th", "en"] })
	@IsOptional()
	@IsIn(["th", "en"])
	locale?: string;
}

export class ChangePasswordDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	currentPassword: string;

	@ApiProperty({ minLength: 8, maxLength: 128 })
	@IsString()
	@MinLength(8)
	@MaxLength(128)
	newPassword: string;
}

export class AuthUserResponse {
	@ApiProperty() id: string;
	@ApiProperty() email: string;
	@ApiProperty() name: string;
	@ApiProperty({ nullable: true }) avatarUrl: string | null;
	@ApiProperty() provider: string;
	@ApiProperty() isVerified: boolean;
	@ApiProperty() locale: string;
	@ApiProperty({ description: "A shared demo account; some actions are refused." })
	isDemo: boolean;
}

export class AuthSessionResponse {
	@ApiProperty() accessToken: string;
	@ApiProperty({ description: "Opaque; store it somewhere JavaScript cannot read." })
	refreshToken: string;
	@ApiProperty({ description: "Access-token lifetime in seconds." })
	expiresIn: number;
	@ApiProperty({ type: AuthUserResponse }) user: AuthUserResponse;
}

export class ForgotPasswordDto {
	@ApiProperty({ example: "owner@example.com" })
	@IsEmail()
	@MaxLength(255)
	@Transform(normaliseEmail)
	email: string;
}

export class ResetPasswordDto {
	@ApiProperty({ description: "The token from the emailed link" })
	@IsString()
	@MinLength(20)
	@MaxLength(128)
	token: string;

	@ApiProperty({ minLength: 8 })
	@IsString()
	@MinLength(8)
	@MaxLength(128)
	newPassword: string;
}

export class PinLoginDto {
	@ApiProperty({ description: "The shop this till is signed in to" })
	@IsUUID()
	businessId: string;

	@ApiProperty({ description: "Who is taking over the till" })
	@IsUUID()
	memberId: string;

	@ApiProperty({ example: "4071" })
	@IsString()
	@Matches(/^\d{4,6}$/)
	pin: string;
}
