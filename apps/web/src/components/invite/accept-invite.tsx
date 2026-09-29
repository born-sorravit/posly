"use client";

import { EmptyState } from "@/components/common/primitives";
import { BrandMark } from "@/components/layout/brand";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/posly";
import { formatThaiDate } from "@posly/utils/format";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useQuery } from "@tanstack/react-query";
import { LinkIcon, Loader2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

/**
 * What an employee sees when they open the link the owner sent.
 *
 * Signed out: sign in or register, and come straight back here (`?next=`). Signed in: one
 * button joins. The token is the only proof — the email the owner typed is a label.
 */
export function AcceptInvite({ token }: { token: string }) {
	const t = useTranslations("invite");
	const tRole = useTranslations("roles");
	const { user } = useSession();
	const setBusiness = useWorkspaceStore((s) => s.setBusiness);
	const [joining, setJoining] = useState(false);
	const preview = useQuery({
		queryKey: ["invite", token],
		queryFn: ({ signal }) => api.invites.preview(token, signal),
		retry: false,
	});
	const next = `/invite/${token}`;

	const join = async () => {
		setJoining(true);
		try {
			const joined = await api.invites.accept(token);
			setBusiness(joined.businessId);
			toast.success(t("joined", { business: joined.businessName }));
			// Full navigation on purpose: the client router may hold the app layout's earlier
			// "no shop → onboarding" redirect, and the layout must re-read this account's shops.
			// eslint-disable-next-line @next/next/no-location-assign-relative-destination
			window.location.assign("/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("invalid"));
			setJoining(false);
		}
	};

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
			<BrandMark />
			<div className="w-full max-w-sm surface rounded-3xl p-6 tablet:p-8">
				{preview.isPending ? (
					<div className="space-y-3">
						<Skeleton className="mx-auto size-14 rounded-2xl" />
						<Skeleton className="h-6 w-3/4" />
						<Skeleton className="h-11 w-full rounded-xl" />
					</div>
				) : preview.isError || !preview.data ? (
					<EmptyState icon={LinkIcon} title={t("invalid")} description={t("invalidHint")} className="py-4" />
				) : (
					<div className="space-y-6 text-center">
						<span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
							<Store className="size-7" />
						</span>
						<div className="space-y-1">
							<h1 className="font-semibold text-xl">{t("title")}</h1>
							<p className="text-muted-foreground text-sm">
								{t("body", {
									name: preview.data.invitedName,
									business: preview.data.businessName,
									role: tRole(preview.data.role),
								})}
							</p>
							<p className="text-muted-foreground text-xs">
								{t("expires", { date: formatThaiDate(preview.data.expiresAt) })}
							</p>
						</div>

						{user ? (
							<div className="space-y-2">
								<Button size="lg" className="brand-gradient h-11 w-full rounded-xl" disabled={joining} onClick={() => void join()}>
									{joining ? <Loader2 className="size-4 animate-spin" /> : null}
									{t("join")}
								</Button>
								<p className="text-muted-foreground text-xs">{t("signedInAs", { email: user.email })}</p>
							</div>
						) : (
							<div className="grid gap-2">
								<Button asChild size="lg" className="brand-gradient h-11 rounded-xl">
									<Link href={{ pathname: "/register", query: { next } }}>{t("registerToJoin")}</Link>
								</Button>
								<Button asChild variant="outline" size="lg" className="h-11 rounded-xl">
									<Link href={{ pathname: "/login", query: { next } }}>{t("signInToJoin")}</Link>
								</Button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
