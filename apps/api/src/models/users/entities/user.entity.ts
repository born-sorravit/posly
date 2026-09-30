import { BaseEntity } from "@/models/base.entity";
import { AuthProvider } from "@/shared/enums/auth-provider.enum";
import { Column, Entity, Index } from "typeorm";

/**
 * A person, independent of any shop.
 *
 * Deliberately carries no shop role and no business: what someone may do in a shop is a
 * property of their membership in it (`BusinessMember`), and one user can belong to many.
 * The one exception is `isPlatformAdmin`, which is about Posly itself, not any shop.
 */
@Entity("user")
export class User extends BaseEntity {
	@Index("uq_user_email", { unique: true })
	@Column({ type: "varchar", length: 255 })
	email: string;

	/** Null for accounts that sign in with Google only. */
	@Column({
		name: "password_hash",
		type: "varchar",
		length: 255,
		nullable: true,
		select: false,
	})
	passwordHash: string | null;

	@Column({ type: "enum", enum: AuthProvider, default: AuthProvider.PASSWORD })
	provider: AuthProvider;

	/** The provider's own subject id (Google `sub`), unique per provider. */
	@Column({ name: "provider_id", type: "varchar", length: 255, nullable: true })
	providerId: string | null;

	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ name: "avatar_url", type: "varchar", length: 500, nullable: true })
	avatarUrl: string | null;

	@Column({ name: "is_verified", type: "boolean", default: false })
	isVerified: boolean;

	@Column({ type: "varchar", length: 5, default: "th" })
	locale: string;

	/** Can read the platform-wide admin monitor (apps/admin). Set with `pnpm admin:set`. */
	@Column({ name: "is_platform_admin", type: "boolean", default: false })
	isPlatformAdmin: boolean;
}
