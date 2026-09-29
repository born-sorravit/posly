import {
	AuthSessionResponse,
	AuthUserResponse,
	ChangePasswordDto,
	ForgotPasswordDto,
	GoogleLoginDto,
	LoginDto,
	PinLoginDto,
	RefreshDto,
	RegisterDto,
	ResetPasswordDto,
	UpdateProfileDto,
} from "@/modules/auth/dto/auth.dto";
import { AuthService } from "@/modules/auth/auth.service";
import { CurrentUser } from "@/shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { Public } from "@/shared/decorators/public.decorator";
import { MessagedResponse } from "@/shared/interceptors/response.interceptor";
import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	Patch,
	Post,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

/**
 * Credential endpoints are throttled far tighter than the global limit. Read from the
 * environment at import time because `@Throttle` takes a static object.
 */
const CREDENTIAL_THROTTLE = {
	default: {
		limit: Number.parseInt(process.env.AUTH_THROTTLE_LIMIT ?? "10", 10) || 10,
		ttl: 60_000,
	},
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Throttle(CREDENTIAL_THROTTLE)
	@Post("forgot-password")
	@HttpCode(200)
	@ApiOperation({
		summary:
			"Email a one-time reset link; the same answer whether or not the account exists",
	})
	async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ sent: true }> {
		await this.authService.forgotPassword(dto);
		return { sent: true };
	}

	@Public()
	@Throttle(CREDENTIAL_THROTTLE)
	@Post("reset-password")
	@HttpCode(200)
	@ApiOperation({
		summary:
			"Set a new password from a reset link; signs the account out everywhere",
	})
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ reset: true }> {
		await this.authService.resetPassword(dto);
		return { reset: true };
	}

	@Public()
	@Throttle(CREDENTIAL_THROTTLE)
	@Post("register")
	@ApiOperation({ summary: "Create an account and start a session" })
	@ApiOkResponse({ type: AuthSessionResponse })
	register(
		@Body() dto: RegisterDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.register(dto, userAgent);
	}

	@Public()
	@Throttle(CREDENTIAL_THROTTLE)
	@Post("login")
	@HttpCode(200)
	@ApiOperation({ summary: "Exchange credentials for a session" })
	@ApiOkResponse({ type: AuthSessionResponse })
	login(
		@Body() dto: LoginDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.login(dto, userAgent);
	}

	@Public()
	@Throttle(CREDENTIAL_THROTTLE)
	@Post("google")
	@HttpCode(200)
	@ApiOperation({ summary: "Sign in (or sign up) with a Google ID token" })
	@ApiOkResponse({ type: AuthSessionResponse })
	google(
		@Body() dto: GoogleLoginDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.loginWithGoogle(dto.idToken, userAgent);
	}

	@Public()
	@Post("refresh")
	@HttpCode(200)
	@ApiOperation({ summary: "Rotate a refresh token for a new session" })
	@ApiOkResponse({ type: AuthSessionResponse })
	refresh(
		@Body() dto: RefreshDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.refresh(dto.refreshToken, userAgent);
	}

	@Public()
	@Post("logout")
	@HttpCode(200)
	@ApiOperation({ summary: "Revoke a refresh token", description: "Idempotent." })
	async logout(@Body() dto: RefreshDto): Promise<MessagedResponse<null>> {
		await this.authService.logout(dto.refreshToken);
		return new MessagedResponse(null, "Signed out");
	}

	@Get("me")
	@ApiBearerAuth()
	@ApiOperation({ summary: "The signed-in account" })
	@ApiOkResponse({ type: AuthUserResponse })
	me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
		return this.authService.me(user.id);
	}

	@Patch("me")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Update the signed-in account" })
	@ApiOkResponse({ type: AuthUserResponse })
	updateProfile(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: UpdateProfileDto
	): Promise<AuthUserResponse> {
		return this.authService.updateProfile(user.id, dto);
	}

	@Throttle(CREDENTIAL_THROTTLE)
	@Post("pin-login")
	@HttpCode(200)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Hand this till to another member of the shop, by their PIN",
	})
	@ApiOkResponse({ type: AuthSessionResponse })
	pinLogin(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: PinLoginDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.pinLogin(user.id, dto, userAgent);
	}

	@Throttle(CREDENTIAL_THROTTLE)
	@Post("change-password")
	@HttpCode(200)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Change the password; every other session is revoked" })
	@ApiOkResponse({ type: AuthSessionResponse })
	changePassword(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: ChangePasswordDto,
		@Headers("user-agent") userAgent?: string
	): Promise<AuthSessionResponse> {
		return this.authService.changePassword(user.id, dto, userAgent);
	}
}
