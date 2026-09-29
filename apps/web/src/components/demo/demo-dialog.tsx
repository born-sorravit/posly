"use client";

import { useSession } from "@/components/providers/session-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { friendlyMessage } from "@/lib/api/backend";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@posly/ui/components/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@posly/ui/components/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Crown, Loader2, type LucideIcon, ShoppingCart, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

type DemoRole = "owner" | "manager" | "cashier";

const ROLES: { role: DemoRole; icon: LucideIcon; home: "/dashboard" | "/pos" }[] = [
	{ role: "owner", icon: Crown, home: "/dashboard" },
	{ role: "manager", icon: UserCog, home: "/dashboard" },
	{ role: "cashier", icon: ShoppingCart, home: "/pos" },
];

/**
 * "Try the demo": pick a role, get signed in to the matching shared demo account. The
 * trigger is whatever button the caller passes, so the landing page keeps its own styling.
 */
export function DemoDialog({ children }: { children: ReactNode }) {
	const t = useTranslations("demo");
	const router = useRouter();
	const queryClient = useQueryClient();
	const { refresh } = useSession();
	const [pending, setPending] = useState<DemoRole | null>(null);
	const [error, setError] = useState<string | null>(null);

	const start = async (role: DemoRole, home: string) => {
		setPending(role);
		setError(null);
		const response = await fetch("/api/auth/demo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ role }),
		}).catch(() => null);

		if (!response?.ok) {
			const payload = (await response?.json().catch(() => null)) as { message?: string } | null;
			setError(response ? friendlyMessage(response.status, payload?.message) : t("unreachable"));
			setPending(null);
			return;
		}

		// Whatever this browser cached for another account must not show in the demo shop.
		queryClient.clear();
		await refresh();
		router.replace(home);
		router.refresh();
	};

	return (
		<Dialog onOpenChange={() => setError(null)}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("subtitle")}</DialogDescription>
				</DialogHeader>

				{error ? (
					<Alert variant="destructive">
						<AlertCircle className="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				<div className="grid gap-2">
					{ROLES.map(({ role, icon: Icon, home }) => (
						<button
							key={role}
							type="button"
							disabled={pending !== null}
							onClick={() => start(role, home)}
							className={cn(
								"group flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
								"hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
								pending === role && "border-primary opacity-100"
							)}
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Icon className="size-5" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-medium">{t(`roles.${role}.title`)}</span>
								<span className="block text-muted-foreground text-xs">{t(`roles.${role}.body`)}</span>
							</span>
							{pending === role ? (
								<Loader2 className="size-4 animate-spin text-primary" />
							) : (
								<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
							)}
						</button>
					))}
				</div>

				<p className="text-muted-foreground text-xs">
					{t("note")}{" "}
					<Link href="/register" className="font-medium text-primary hover:underline">
						{t("signup")}
					</Link>
				</p>
			</DialogContent>
		</Dialog>
	);
}
