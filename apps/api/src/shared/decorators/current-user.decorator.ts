import { ExecutionContext, createParamDecorator } from "@nestjs/common";

/**
 * The verified access-token payload attached by `JwtStrategy`.
 *
 * Identity only. What this person may do depends on which business they are acting in, and
 * that is resolved per request by `BusinessAccessGuard` into `CurrentMembership`.
 */
export interface AuthenticatedUser {
	id: string;
	email: string;
}

export const CurrentUser = createParamDecorator(
	(data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
		const request = context
			.switchToHttp()
			.getRequest<{ user?: AuthenticatedUser }>();
		const user = request.user;
		return data && user ? user[data] : user;
	}
);
