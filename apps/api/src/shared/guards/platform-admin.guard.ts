import { UsersRepository } from "@/models/users/user.repository";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { PLATFORM_ADMIN_KEY } from "@/shared/decorators/platform-admin.decorator";
import {
	CanActivate,
	ExecutionContext,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/**
 * Gate for `@PlatformAdmin()` routes. Registered globally, after `JwtAuthGuard`.
 *
 * The flag is read from the database on every request rather than carried in the JWT, so
 * revoking it (`pnpm admin:set -- <email> off`) takes effect at once instead of when the
 * token expires. Anyone else gets a **404**, the same as an unknown route, so the admin
 * surface is not advertised.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly usersRepository: UsersRepository
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const required = this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!required) return true;

		const user = context
			.switchToHttp()
			.getRequest<{ user?: AuthenticatedUser }>().user;
		const admin = user
			? await this.usersRepository.exists({
					where: { id: user.id, isPlatformAdmin: true },
				})
			: false;
		if (!admin) throw new NotFoundException();
		return true;
	}
}
