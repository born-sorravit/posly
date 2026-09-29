import { SetMetadata } from "@nestjs/common";

export const DEMO_BLOCKED_KEY = "demoBlocked";

/**
 * Refuses the route to a signed-in demo account (`DemoGuard`). For anything that would spoil
 * the shared demo for the next visitor and is not undone by the nightly reset — passwords,
 * people, billing, the shop's own details — or that reaches outside Posly, like email.
 */
export const DemoBlocked = () => SetMetadata(DEMO_BLOCKED_KEY, true);
