/**
 * The public "try it" accounts. Every demo account lives on this domain, which is how the
 * seed finds what to remove and how the API tells a demo session from a real one — no column
 * needed, and the seed can recreate the users under new ids every night.
 */
export const DEMO_EMAIL_DOMAIN = "demo.posly";

export const DEMO_ROLES = ["owner", "manager", "cashier"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** Which seeded account the landing page's role picker signs into. All three share Sunny Cafe. */
export const DEMO_ROLE_EMAILS: Record<DemoRole, string> = {
	owner: `nan@${DEMO_EMAIL_DOMAIN}`,
	manager: `ton@${DEMO_EMAIL_DOMAIN}`,
	cashier: `mind@${DEMO_EMAIL_DOMAIN}`,
};

export const isDemoEmail = (email: string | null | undefined): boolean =>
	!!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
