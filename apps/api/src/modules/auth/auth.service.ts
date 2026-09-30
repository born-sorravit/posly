import { PasswordReset } from "@/models/auth/entities/password-reset.entity";
import { MailService } from "@/shared/mail/mail.service";

const RESET_TTL_MINUTES = 30;

const escapeHtml = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] as string
	);
import { RefreshToken } from "@/models/auth/entities/refresh-token.entity";
import { RefreshTokenRepository } from "@/models/auth/refresh-token.repository";
import { User } from "@/models/users/entities/user.entity";
import { UsersRepository } from "@/models/users/user.repository";
import {
	AuthSessionResponse,
	AuthUserResponse,
	ChangePasswordDto,
	ForgotPasswordDto,
	LoginDto,
	PinLoginDto,
	RegisterDto,
	ResetPasswordDto,
	UpdateProfileDto,
} from "@/modules/auth/dto/auth.dto";
import { GoogleIdentity } from "@/modules/auth/google-identity.service";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { AccessTokenPayload } from "@/modules/auth/strategies/jwt.strategy";
import { AuthProvider } from "@/shared/enums/auth-provider.enum";
import { PASSWORD_MESSAGES, passwordProblem } from "@/shared/utils/password.util";
import {
	DEMO_ROLE_EMAILS,
	type DemoRole,
	isDemoEmail,
} from "@/shared/utils/demo.util";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GoneException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { DataSource, IsNull, LessThan } from "typeorm";

/**
 * A real bcrypt hash of a value nobody knows.
 *
 * Login compares against this when the email is unknown (or the account has no password), so
 * every failed login costs the same ~100ms. Without it, response timing tells an attacker
 * which addresses have accounts.
 */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8e3F6M/lJ2ZPnO4QxQZ7QK9RJZ0vJe";

const INVALID_CREDENTIALS = "Incorrect email or password";

/**
 * How long a just-rotated refresh token keeps working, to absorb concurrent requests from a
 * browser that fired several at once. 0 makes rotation strictly single-use.
 */
const ROTATION_GRACE_MS = Number.parseInt(
	process.env.REFRESH_ROTATION_GRACE_MS ?? "15000",
	10
);

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 5;

const USER_WITH_HASH = {
	id: true,
	email: true,
	name: true,
	avatarUrl: true,
	provider: true,
	isVerified: true,
	locale: true,
	passwordHash: true,
} as const;

@Injectable()
export class AuthService {
	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly refreshTokenRepository: RefreshTokenRepository,
		private readonly googleIdentity: GoogleIdentity,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly dataSource: DataSource
	) {}

	async register(
		dto: RegisterDto,
		userAgent?: string
	): Promise<AuthSessionResponse> {
		// The demo domain belongs to the seed. Without this, the gap in the nightly reset —
		// accounts removed, not yet recreated — would let anyone claim nan@demo.posly.
		if (isDemoEmail(dto.email)) {
			throw new BadRequestException("This email address cannot be used");
		}
		const rounds = this.configService.get<number>("security.bcryptRounds", 10);
		const user = this.usersRepository.create({
			email: dto.email,
			passwordHash: await hash(dto.password, rounds),
			provider: AuthProvider.PASSWORD,
			name: dto.name,
			locale: dto.locale ?? "th",
			isVerified: false,
		});

		try {
			await this.usersRepository.save(user);
		} catch (error) {
			// Let the unique index decide, not a prior SELECT: check-then-insert races.
			if (this.isUniqueViolation(error)) {
				throw new ConflictException("An account with this email already exists");
			}
			throw error;
		}

		return this.issueSession(user, userAgent);
	}

	async login(dto: LoginDto, userAgent?: string): Promise<AuthSessionResponse> {
		// `passwordHash` is `select: false` on the entity, so it has to be asked for.
		const user = await this.usersRepository.findOne({
			where: { email: dto.email },
			select: USER_WITH_HASH,
		});

		const matches = await compare(dto.password, user?.passwordHash ?? DUMMY_HASH);

		// One message for "no such account", "wrong password" and "this is a Google account":
		// distinguishing them turns the form into an account-enumeration oracle.
		if (!user?.passwordHash || !matches) {
			throw new UnauthorizedException(INVALID_CREDENTIALS);
		}

		return this.issueSession(user, userAgent);
	}

	/**
	 * Signs in with a Google ID token, creating the account on first use.
	 *
	 * An existing password account with the same verified email is linked rather than
	 * duplicated — Google has verified the address, which is the same proof a verification
	 * email would give.
	 */
	async loginWithGoogle(
		idToken: string,
		userAgent?: string
	): Promise<AuthSessionResponse> {
		const identity = await this.googleIdentity.verify(idToken);

		let user = await this.usersRepository.findOne({
			where: { email: identity.email },
		});

		if (!user) {
			user = this.usersRepository.create({
				email: identity.email,
				passwordHash: null,
				provider: AuthProvider.GOOGLE,
				providerId: identity.sub,
				name: identity.name,
				avatarUrl: identity.picture,
				isVerified: true,
				locale: "th",
			});
			await this.usersRepository.save(user);
		} else if (!user.providerId) {
			await this.usersRepository.update(user.id, {
				providerId: identity.sub,
				isVerified: true,
				avatarUrl: user.avatarUrl ?? identity.picture,
			});
		}

		return this.issueSession(user, userAgent);
	}

	/**
	 * Exchanges a refresh token for a new session, rotating the token. The presented token is
	 * revoked, so a replayed token is useless and a stolen one dies at the next real refresh.
	 */
	async refresh(token: string, userAgent?: string): Promise<AuthSessionResponse> {
		const stored = await this.refreshTokenRepository.findOne({
			where: { tokenHash: this.hashToken(token) },
			relations: { user: true },
		});

		if (!stored || stored.expiresAt.getTime() <= Date.now()) {
			throw new UnauthorizedException("Invalid or expired refresh token");
		}

		if (stored.revokedAt && !this.isWithinRotationGrace(stored)) {
			throw new UnauthorizedException("Invalid or expired refresh token");
		}

		if (!stored.revokedAt) {
			// Retire the presented token, and with it the siblings concurrent refreshes were
			// handed inside the grace window: the client kept this one, so those were never
			// stored and would otherwise stay valid for the whole TTL. Only siblings older than
			// the grace window — a sibling minted this very moment may be the one a racing
			// request is about to store, and it is cleared at the following rotation instead.
			await this.refreshTokenRepository.update(stored.id, {
				revokedAt: new Date(),
				revokedReason: "rotated",
			});
			await this.refreshTokenRepository
				.createQueryBuilder()
				.update()
				// Not "rotated": nobody holds these, so a late arrival gets no grace.
				.set({ revokedAt: () => "now()", revokedReason: "superseded" })
				.where("family_id = :familyId AND revoked_at IS NULL", {
					familyId: stored.familyId,
				})
				.andWhere("created_at < now() - make_interval(secs => :graceSeconds)", {
					graceSeconds: ROTATION_GRACE_MS / 1000,
				})
				.execute();
		}

		return this.issueSession(stored.user, userAgent, stored.familyId);
	}

	private isWithinRotationGrace(stored: RefreshToken): boolean {
		if (stored.revokedReason !== "rotated" || !stored.revokedAt) return false;
		return Date.now() - stored.revokedAt.getTime() <= ROTATION_GRACE_MS;
	}

	/** Idempotent: signing out with an already-dead token is still a successful sign-out. */
	/**
	 * Quick switch at a shared till (plan §21): someone already signed in to this shop hands
	 * the till to another member, who proves it is them with their PIN. The result is an
	 * ordinary session for that member's own account — every permission check that follows is
	 * theirs, and every order carries their name.
	 *
	 * The caller must be an active member of the same shop, so a PIN can never be tried from
	 * outside it; five wrong PINs lock that member's PIN for five minutes.
	 */
	async pinLogin(
		callerUserId: string,
		dto: PinLoginDto,
		userAgent?: string
	): Promise<AuthSessionResponse> {
		const members = this.dataSource.getRepository(BusinessMember);
		const caller = await members.findOne({
			where: {
				businessId: dto.businessId,
				userId: callerUserId,
				status: MemberStatus.ACTIVE,
			},
		});
		if (!caller)
			throw new ForbiddenException("This till is not signed in to that shop");

		const target = await members.findOne({
			where: {
				id: dto.memberId,
				businessId: dto.businessId,
				status: MemberStatus.ACTIVE,
			},
			select: {
				id: true,
				userId: true,
				pinHash: true,
				pinFailedAttempts: true,
				pinLockedUntil: true,
				hiddenFromSwitch: true,
			},
		});
		// Hidden from the switch screen means no handover at all, not just an unlisted name.
		if (!target?.userId || !target.pinHash || target.hiddenFromSwitch) {
			throw new UnauthorizedException("PIN is not set for this person");
		}
		if (target.pinLockedUntil && target.pinLockedUntil.getTime() > Date.now()) {
			throw new HttpException(
				{
					message: "Too many wrong PINs; try again later",
					details: { lockedUntil: target.pinLockedUntil.toISOString() },
				},
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		if (!(await compare(dto.pin, target.pinHash))) {
			// The demo shop is shared: counting wrong guesses would let one visitor lock it for all.
			const targetUser = await this.usersRepository.findOne({
				where: { id: target.userId },
				select: { id: true, email: true },
			});
			if (isDemoEmail(targetUser?.email)) {
				throw new UnauthorizedException({ message: "Wrong PIN" });
			}
			// Counted in one statement, so two tills guessing at once cannot both slip under it.
			// TypeORM's postgres driver answers an UPDATE … RETURNING with [rows, affected].
			const [rows] = (await this.dataSource.query(
				`UPDATE business_member
				    SET pin_failed_attempts = pin_failed_attempts + 1,
				        pin_locked_until = CASE WHEN pin_failed_attempts + 1 >= $2
				                                THEN now() + make_interval(mins => $3) END
				  WHERE id = $1
				RETURNING pin_failed_attempts`,
				[target.id, PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES]
			)) as [{ pin_failed_attempts: number }[], number];
			const left = Math.max(
				0,
				PIN_MAX_ATTEMPTS - (rows[0]?.pin_failed_attempts ?? PIN_MAX_ATTEMPTS)
			);
			throw new UnauthorizedException({
				message: "Wrong PIN",
				details: { attemptsLeft: left },
			});
		}

		await members.update(
			{ id: target.id },
			{ pinFailedAttempts: 0, pinLockedUntil: null }
		);
		const user = await this.usersRepository.findOne({
			where: { id: target.userId },
		});
		if (!user) throw new UnauthorizedException("Account no longer exists");
		return this.issueSession(user, userAgent);
	}

	async logout(token: string): Promise<void> {
		const stored = await this.refreshTokenRepository.findOne({
			where: { tokenHash: this.hashToken(token) },
			select: { id: true, familyId: true },
		});
		if (!stored) return;
		// The whole sign-in, so a sibling from a concurrent refresh cannot outlive the logout.
		// `IsNull()`, not `undefined`: TypeORM drops undefined keys from a where clause.
		await this.refreshTokenRepository.update(
			{ familyId: stored.familyId, revokedAt: IsNull() },
			{ revokedAt: new Date(), revokedReason: "logout" }
		);
	}

	async me(userId: string): Promise<AuthUserResponse> {
		const user = await this.usersRepository.findOne({ where: { id: userId } });
		if (!user) {
			throw new UnauthorizedException("Account no longer exists");
		}
		return this.toUserResponse(user);
	}

	async updateProfile(
		userId: string,
		dto: UpdateProfileDto
	): Promise<AuthUserResponse> {
		const user = await this.usersRepository.findOne({ where: { id: userId } });
		if (!user) {
			throw new UnauthorizedException("Account no longer exists");
		}

		// Only the keys actually sent: a PATCH that omits `locale` must not blank it.
		const changes: Partial<User> = {};
		if (dto.name !== undefined) changes.name = dto.name;
		if (dto.locale !== undefined) changes.locale = dto.locale;

		if (Object.keys(changes).length > 0) {
			await this.usersRepository.update(user.id, changes);
			Object.assign(user, changes);
		}

		return this.toUserResponse(user);
	}

	/**
	 * Changes the password and ends every other session — a shop owner changing it may be
	 * doing so because a tablet walked out the door. Revoke first, then issue, so the new
	 * token is not caught by the revoke.
	 */
	async changePassword(
		userId: string,
		dto: ChangePasswordDto,
		userAgent?: string
	): Promise<AuthSessionResponse> {
		const user = await this.usersRepository.findOne({
			where: { id: userId },
			select: USER_WITH_HASH,
		});
		if (!user) {
			throw new UnauthorizedException("Account no longer exists");
		}
		if (!user.passwordHash) {
			throw new BadRequestException("This account signs in with Google");
		}

		if (!(await compare(dto.currentPassword, user.passwordHash))) {
			throw new UnauthorizedException("Current password is incorrect");
		}
		if (await compare(dto.newPassword, user.passwordHash)) {
			throw new BadRequestException(
				"The new password must be different from the current one"
			);
		}
		this.assertNotPersonal(dto.newPassword, user);

		const rounds = this.configService.get<number>("security.bcryptRounds", 10);
		await this.usersRepository.update(user.id, {
			passwordHash: await hash(dto.newPassword, rounds),
		});

		await this.refreshTokenRepository.update(
			{ userId: user.id, revokedAt: IsNull() },
			{ revokedAt: new Date(), revokedReason: "password" }
		);

		return this.issueSession(user, userAgent);
	}

	/**
	 * Emails a one-time reset link (30 minutes). Answers the same whether or not the address
	 * has an account, so the form cannot be used to find out who is a customer. A Google-only
	 * account gets the link too: resetting gives it a password alongside Google.
	 */
	/**
	 * Signs a visitor in to one of the seeded demo accounts without a password. The accounts
	 * are shared and recreated nightly; `DemoGuard` refuses what would spoil them for the next
	 * visitor.
	 */
	async demoLogin(role: DemoRole, userAgent?: string): Promise<AuthSessionResponse> {
		if (!this.configService.get<boolean>("demo.enabled", false)) {
			throw new NotFoundException("Demo is not available");
		}
		const user = await this.usersRepository.findOne({
			where: { email: DEMO_ROLE_EMAILS[role] },
		});
		// Not seeded yet, or the nightly reset is between removing and recreating.
		if (!user) throw new ServiceUnavailableException("บัญชีทดลองยังไม่พร้อม");
		return this.issueSession(user, userAgent);
	}

	async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
		// Nobody receives mail at the demo domain, and a reset would lock out every visitor.
		if (isDemoEmail(dto.email)) return;
		const user = await this.usersRepository.findOne({ where: { email: dto.email } });
		if (!user) return;

		const resets = this.dataSource.getRepository(PasswordReset);
		// Only the newest link works: asking again retires the earlier ones.
		await resets.update(
			{ userId: user.id, usedAt: IsNull() },
			{ usedAt: new Date() }
		);

		const token = randomBytes(32).toString("base64url");
		await resets.save(
			resets.create({
				userId: user.id,
				tokenHash: createHash("sha256").update(token).digest("hex"),
				expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
				usedAt: null,
			})
		);

		const web = this.configService
			.get<string>("app.publicWebUrl", "http://localhost:3000")
			.replace(/\/+$/, "");
		const link = `${web}/reset-password/${token}`;
		await this.mailService.send({
			to: user.email,
			subject: "ตั้งรหัสผ่านใหม่สำหรับ Posly",
			text: `สวัสดีคุณ${user.name}\n\nกดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ ${RESET_TTL_MINUTES} นาที และใช้ได้ครั้งเดียว):\n${link}\n\nถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
			html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#111827">
<h2 style="margin:0 0 12px">ตั้งรหัสผ่านใหม่</h2>
<p>สวัสดีคุณ${escapeHtml(user.name)}</p>
<p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์ใช้ได้ ${RESET_TTL_MINUTES} นาทีและใช้ได้ครั้งเดียว</p>
<p style="margin:24px 0"><a href="${link}" style="background:#635bff;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">ตั้งรหัสผ่านใหม่</a></p>
<p style="color:#6b7280;font-size:13px">ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>
</div>`,
		});
	}

	/**
	 * Sets a new password from a reset link and signs the account out everywhere — whoever
	 * had the old password must not keep a session. The link works once.
	 */
	async resetPassword(dto: ResetPasswordDto): Promise<void> {
		const resets = this.dataSource.getRepository(PasswordReset);
		const reset = await resets.findOne({
			where: { tokenHash: createHash("sha256").update(dto.token).digest("hex") },
		});
		if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
			throw new GoneException("This reset link has expired or was already used");
		}

		// Checked before claiming, so a refused password does not use up the link.
		const owner = await this.usersRepository.findOne({
			where: { id: reset.userId },
		});
		if (owner) this.assertNotPersonal(dto.newPassword, owner);

		// Claim the link first: of two submissions racing, only one updates this row.
		const claimed = await resets.update(
			{ id: reset.id, usedAt: IsNull() },
			{ usedAt: new Date() }
		);
		if (!claimed.affected)
			throw new GoneException("This reset link has expired or was already used");

		const rounds = this.configService.get<number>("security.bcryptRounds", 10);
		await this.usersRepository.update(reset.userId, {
			passwordHash: await hash(dto.newPassword, rounds),
		});
		await this.refreshTokenRepository.update(
			{ userId: reset.userId, revokedAt: IsNull() },
			{ revokedAt: new Date(), revokedReason: "password" }
		);
	}

	/** Housekeeping for expired rows; safe to call from a scheduled job. */
	async pruneExpiredTokens(): Promise<number> {
		const result = await this.refreshTokenRepository.delete({
			expiresAt: LessThan(new Date()),
		});
		return result.affected ?? 0;
	}

	/** `familyId` continues a sign-in (a refresh); without it this is a new one. */
	private async issueSession(
		user: User,
		userAgent?: string,
		familyId?: string
	): Promise<AuthSessionResponse> {
		const payload: AccessTokenPayload = { sub: user.id, email: user.email };
		const accessToken = await this.jwtService.signAsync(payload);

		// Opaque and high-entropy: nothing to verify, nothing to forge, only its hash stored.
		const refreshToken = randomBytes(48).toString("base64url");
		const ttlDays = this.configService.get<number>("security.refreshTtlDays", 30);

		await this.refreshTokenRepository.insert({
			tokenHash: this.hashToken(refreshToken),
			userId: user.id,
			expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
			userAgent: userAgent?.slice(0, 255) ?? null,
			...(familyId ? { familyId } : {}),
		});

		return {
			accessToken,
			refreshToken,
			expiresIn: this.accessTokenSeconds(),
			user: this.toUserResponse(user),
		};
	}

	private toUserResponse(user: User): AuthUserResponse {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatarUrl ?? null,
			provider: user.provider,
			isVerified: user.isVerified,
			locale: user.locale,
			isDemo: isDemoEmail(user.email),
			isPlatformAdmin: user.isPlatformAdmin ?? false,
		};
	}

	/** The DTO cannot see the account, so the name-and-email rule is applied here. */
	private assertNotPersonal(
		password: string,
		user: Pick<User, "email" | "name">
	): void {
		if (
			passwordProblem(password, { email: user.email, name: user.name }) ===
			"personal"
		) {
			throw new BadRequestException(PASSWORD_MESSAGES.personal);
		}
	}

	/** SHA-256 is right here, not bcrypt: the input is already 48 random bytes. */
	private hashToken(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	private accessTokenSeconds(): number {
		const raw = this.configService.get<string>("security.jwt.expiresIn", "15m");
		const match = /^(\d+)([smhd])$/.exec(raw.trim());
		if (!match) return 900;

		const value = Number.parseInt(match[1], 10);
		const unit = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2]] ?? 60;
		return value * unit;
	}

	private isUniqueViolation(error: unknown): boolean {
		return (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "23505"
		);
	}
}
