import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { DEMO_BLOCKED_KEY } from "@/shared/decorators/demo-blocked.decorator";
import { isDemoEmail } from "@/shared/utils/demo.util";
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const DEMO_BLOCKED_MESSAGE = "บัญชีทดลองไม่สามารถทำรายการนี้ได้";

@Injectable()
export class DemoGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const blocked = this.reflector.getAllAndOverride<boolean>(DEMO_BLOCKED_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!blocked) return true;

		const user = context.switchToHttp().getRequest().user as
			| AuthenticatedUser
			| undefined;
		if (isDemoEmail(user?.email)) throw new ForbiddenException(DEMO_BLOCKED_MESSAGE);
		return true;
	}
}
