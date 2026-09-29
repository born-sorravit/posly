"use client";

import { DemoBanner } from "@/components/demo/demo-banner";
import { SwitchUserScreen } from "@/components/pin/switch-user";
import { RealtimeBridge } from "@/components/realtime/realtime";
import { RouteGate } from "@/components/common/permission-gate";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandMenu } from "@/components/layout/command-menu";
import { FullscreenToggle } from "@/components/layout/fullscreen-toggle";
import { ProductTour } from "@/components/tour/product-tour";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import { RotateCcw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { BusinessSummaryDto } from "@/lib/api/posly";
import type { ReactNode } from "react";

/** The shell's own shape while the shop is being resolved — no spinner, no layout jump. */
function ShellSkeleton() {
	return (
		<div className="flex min-h-svh">
			<div className="hidden w-64 space-y-3 bg-sidebar p-4 desktop:block">
				<Skeleton className="h-9 w-32 rounded-xl" />
				{Array.from({ length: 8 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					<Skeleton key={i} className="h-9 w-full rounded-xl" />
				))}
			</div>
			<div className="flex-1 space-y-6 p-6">
				<Skeleton className="h-10 w-full max-w-md rounded-xl" />
				<Skeleton className="h-32 w-full rounded-3xl" />
			</div>
		</div>
	);
}

function ShellError({ retry }: { retry: () => void }) {
	const t = useTranslations("errors");
	return (
		<div className="flex min-h-svh items-center justify-center px-4">
			<EmptyState
				icon={WifiOff}
				title={t("workspace")}
				description={t("hint")}
				action={
					<Button size="lg" onClick={retry}>
						<RotateCcw />
						{t("retry")}
					</Button>
				}
			/>
		</div>
	);
}

/**
 * Sidebar + topbar + content (plan §7).
 *
 * The rail is persistent from 1280px; tablets get it as a sheet so the POS keeps the full
 * width, and phones get a bottom tab bar instead — a different layout, not a shrunk one.
 */
export function AppShell({
	children,
	initialBusinesses,
}: {
	children: ReactNode;
	initialBusinesses: BusinessSummaryDto[];
}) {
	useOnlineStatus();

	return (
		<WorkspaceProvider
			initialBusinesses={initialBusinesses}
			fallback={<ShellSkeleton />}
			errorFallback={(retry) => <ShellError retry={retry} />}
		>
			<div className="flex min-h-svh">
				<AppSidebar />
				<div className="flex min-w-0 flex-1 flex-col">
					<DemoBanner />
					<AppHeader />
					{/* Bottom padding clears the mobile tab bar. */}
					<main className="flex min-h-0 flex-1 flex-col pb-24 tablet:pb-0">
						<RouteGate>{children}</RouteGate>
					</main>
				</div>
				<MobileBottomNav />
				<CommandMenu />
				<FullscreenToggle />
				<ProductTour />
				<SwitchUserScreen />
				<RealtimeBridge />
			</div>
		</WorkspaceProvider>
	);
}
