import { DemoGuard } from "@/shared/guards/demo.guard";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const build = (options: { blocked?: boolean; email?: string }) => {
	const reflector = {
		getAllAndOverride: (key: string) =>
			key === "demoBlocked" ? options.blocked : undefined,
	};
	const request = {
		user: options.email ? { id: "user-1", email: options.email } : undefined,
	};
	const context = {
		getHandler: () => undefined,
		getClass: () => undefined,
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;
	return { guard: new DemoGuard(reflector as unknown as Reflector), context };
};

describe("DemoGuard", () => {
	it("lets a demo account through a route that is not marked", () => {
		const { guard, context } = build({ email: "nan@demo.posly" });
		expect(guard.canActivate(context)).toBe(true);
	});

	it("refuses a demo account on a marked route", () => {
		const { guard, context } = build({ blocked: true, email: "Nan@Demo.Posly" });
		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it("lets a real account through a marked route", () => {
		const { guard, context } = build({
			blocked: true,
			email: "owner@demo.posly.co",
		});
		expect(guard.canActivate(context)).toBe(true);
	});

	it("lets an anonymous request through, leaving it to the auth guard", () => {
		const { guard, context } = build({ blocked: true });
		expect(guard.canActivate(context)).toBe(true);
	});
});
