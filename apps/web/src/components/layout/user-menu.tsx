"use client";

import { useSession } from "@/components/providers/session-provider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useTourStore } from "@/stores/tour-store";
import { IosInstallDialog, useInstallApp } from "@/components/pwa/pwa";
import { ChevronDown, CircleHelp, KeyRound, LogOut, MonitorSmartphone, Settings, UserRound, Users } from "lucide-react";
import { SetPinDialog, useSwitchUser } from "@/components/pin/switch-user";
import { useRoster } from "@/hooks/use-posly";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function UserAvatar({ name, className }: { name: string; className?: string }) {
	return (
		<span
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/60 font-medium text-primary-foreground text-sm",
				className
			)}
			aria-hidden
		>
			{name.replace(/^คุณ/, "").trim().charAt(0).toUpperCase() || "?"}
		</span>
	);
}

/**
 * The signed-in person, with their role in the shop currently open.
 */
export function UserMenu({
	variant = "row",
}: {
	/** `row` for the sidebar foot, `avatar` for the header. */
	variant?: "row" | "avatar";
}) {
	const t = useTranslations("userMenu");
	const tPin = useTranslations("pin");
	const { user, signOut } = useSession();
	const router = useRouter();
	const { business } = useActiveBusiness();
	const tRole = useTranslations("roles");
	const queryClient = useQueryClient();
	const startTour = useTourStore((s) => s.start);
	const { mode: installMode, install } = useInstallApp();
	const [iosHelp, setIosHelp] = useState(false);
	const [settingPin, setSettingPin] = useState(false);
	const openSwitch = useSwitchUser((s) => s.setOpen);
	const myPin = useRoster(settingPin).data?.find((p) => p.isYou)?.hasPin ?? false;

	const name = user?.name ?? "";
	const email = user?.email ?? "";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-tour="user-menu"
				className={cn(
					"flex items-center gap-3 rounded-xl text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
					variant === "row" ? "w-full p-2" : "rounded-full p-0.5"
				)}
				aria-label={t("label")}
			>
				<UserAvatar name={name} />
				{variant === "row" ? (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-sm leading-tight">{name}</span>
							<span className="block truncate text-muted-foreground text-xs">
								{tRole(business.role)}
							</span>
						</span>
						<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
					</>
				) : null}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side={variant === "row" ? "top" : "bottom"}
				align={variant === "row" ? "end" : "start"}
				className="w-56"
			>
				<DropdownMenuLabel className="font-normal">
					<p className="truncate font-medium text-sm">{name}</p>
					<p className="truncate text-muted-foreground text-xs">{email}</p>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/settings/general">
						<UserRound className="size-4" />
						{t("profile")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/settings">
						<Settings className="size-4" />
						{t("settings")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => openSwitch(true)}>
					<Users className="size-4" />
					{tPin("switch")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setSettingPin(true)}>
					<KeyRound className="size-4" />
					{tPin("setMine")}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => startTour("app")}>
					<CircleHelp className="size-4" />
					{t("tour")}
				</DropdownMenuItem>
				{installMode ? (
					<DropdownMenuItem onClick={() => (installMode === "prompt" ? void install() : setIosHelp(true))}>
						<MonitorSmartphone className="size-4" />
						{t("install")}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={async () => {
						await signOut();
						// The next person on this tablet must not see this account's cache.
						queryClient.clear();
						router.push("/login");
						router.refresh();
					}}
				>
					<LogOut className="size-4" />
					{t("signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
			<IosInstallDialog open={iosHelp} onOpenChange={setIosHelp} />
			<SetPinDialog open={settingPin} onOpenChange={setSettingPin} hasPin={myPin} />
		</DropdownMenu>
	);
}
