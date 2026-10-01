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
import {
	ChevronDown,
	CircleHelp,
	KeyRound,
	LogOut,
	type LucideIcon,
	MonitorSmartphone,
	Settings,
	UserRound,
	Users,
} from "lucide-react";
import { SetPinDialog, useSwitchUser } from "@/components/pin/switch-user";
import { useRoster } from "@/hooks/use-posly";
import { nameColorIndex, nameInitial } from "@posly/utils/format";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * One colour per person, picked from the name: role already has its badge, and colouring by
 * role would make every cashier the same circle. All deep enough for white text in both themes.
 */
const AVATAR_COLORS = [
	"from-indigo-500 to-violet-600",
	"from-sky-500 to-blue-600",
	"from-teal-500 to-emerald-600",
	"from-rose-500 to-pink-600",
	"from-amber-500 to-orange-600",
	"from-fuchsia-500 to-purple-600",
	"from-cyan-500 to-teal-600",
	"from-lime-600 to-green-700",
] as const;

/**
 * The same hues, quiet: a wash of the colour behind a darker letter, the way `IconChip` tints
 * an icon. For lists — a table of twenty bright gradients shouts over the names beside them.
 * Index for index with AVATAR_COLORS, so a person keeps their hue in either style.
 */
const AVATAR_SOFT = [
	"bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
	"bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
	"bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
	"bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
	"bg-amber-500/14 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
	"bg-fuchsia-500/12 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
	"bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
	"bg-lime-600/14 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
] as const;

export function UserAvatar({ name, soft = false, className }: { name: string; soft?: boolean; className?: string }) {
	const index = nameColorIndex(name, AVATAR_COLORS.length);
	return (
		<span
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-full font-medium text-sm",
				soft ? AVATAR_SOFT[index] : ["bg-gradient-to-br text-white", AVATAR_COLORS[index]],
				className
			)}
			aria-hidden
		>
			{nameInitial(name)}
		</span>
	);
}

type MenuAction = {
	key: string;
	icon: LucideIcon;
	label: string;
	href?: "/profile" | "/settings";
	onSelect?: () => void;
	danger?: boolean;
};

/**
 * The signed-in person, with their role in the shop currently open.
 *
 * A dropdown everywhere except the header on a phone, where it is a bottom drawer: the
 * avatar sits in the top corner, but the thumb is at the bottom, and a drawer's rows are
 * big enough to hit.
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
	const [drawerOpen, setDrawerOpen] = useState(false);
	const openSwitch = useSwitchUser((s) => s.setOpen);
	const myPin = useRoster(settingPin).data?.find((p) => p.isYou)?.hasPin ?? false;
	const wide = useMediaQuery(TABLET_UP);
	const asDrawer = variant === "avatar" && !wide;

	const name = user?.name ?? "";
	const email = user?.email ?? "";

	// One list for both presentations; each inner array is a group between separators.
	const groups: MenuAction[][] = [
		[
			{ key: "profile", icon: UserRound, label: t("profile"), href: "/profile" },
			{ key: "settings", icon: Settings, label: t("settings"), href: "/settings" },
			{ key: "switch", icon: Users, label: tPin("switch"), onSelect: () => openSwitch(true) },
			{ key: "pin", icon: KeyRound, label: tPin("setMine"), onSelect: () => setSettingPin(true) },
		],
		[
			{ key: "tour", icon: CircleHelp, label: t("tour"), onSelect: () => startTour("app") },
			...(installMode
				? [
						{
							key: "install",
							icon: MonitorSmartphone,
							label: t("install"),
							onSelect: () => (installMode === "prompt" ? void install() : setIosHelp(true)),
						},
					]
				: []),
		],
		[
			{
				key: "signOut",
				icon: LogOut,
				label: t("signOut"),
				danger: true,
				onSelect: async () => {
					await signOut();
					// The next person on this tablet must not see this account's cache.
					queryClient.clear();
					router.push("/login");
					router.refresh();
				},
			},
		],
	];

	const trigger = (
		<button
			type="button"
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
						<span className="block truncate text-muted-foreground text-xs">{tRole(business.role)}</span>
					</span>
					<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
				</>
			) : null}
		</button>
	);

	const dialogs = (
		<>
			<IosInstallDialog open={iosHelp} onOpenChange={setIosHelp} />
			<SetPinDialog open={settingPin} onOpenChange={setSettingPin} hasPin={myPin} />
		</>
	);

	if (asDrawer) {
		return (
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetTrigger asChild>{trigger}</SheetTrigger>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="gap-0 rounded-t-3xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					<span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
					<div className="flex items-center gap-3 px-3 pb-4">
						<UserAvatar name={name} className="size-11 text-base" />
						<div className="min-w-0 flex-1">
							<SheetTitle className="truncate font-semibold text-base">{name}</SheetTitle>
							<SheetDescription className="truncate text-xs">
								{email} · {tRole(business.role)}
							</SheetDescription>
						</div>
					</div>
					{groups.map((group) => (
						<div key={group[0].key} className="border-t py-2">
							{group.map(({ key, icon: Icon, label, href, onSelect, danger }) => {
								const className = cn(
									"flex h-12 w-full items-center gap-3.5 rounded-xl px-3 text-left font-medium text-[15px] transition-colors active:bg-muted",
									danger && "text-danger"
								);
								const content = (
									<>
										<Icon className={cn("size-5", danger ? "text-danger" : "text-muted-foreground")} />
										{label}
									</>
								);
								return href ? (
									<Link key={key} href={href} className={className} onClick={() => setDrawerOpen(false)}>
										{content}
									</Link>
								) : (
									<button
										key={key}
										type="button"
										className={className}
										onClick={() => {
											setDrawerOpen(false);
											void onSelect?.();
										}}
									>
										{content}
									</button>
								);
							})}
						</div>
					))}
				</SheetContent>
				{dialogs}
			</Sheet>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent
				side={variant === "row" ? "top" : "bottom"}
				align={variant === "row" ? "end" : "start"}
				className="w-56"
			>
				<DropdownMenuLabel className="font-normal">
					<p className="truncate font-medium text-sm">{name}</p>
					<p className="truncate text-muted-foreground text-xs">{email}</p>
				</DropdownMenuLabel>
				{groups.map((group) => (
					<Fragment key={group[0].key}>
						<DropdownMenuSeparator />
						{group.map(({ key, icon: Icon, label, href, onSelect }) =>
							href ? (
								<DropdownMenuItem key={key} asChild>
									<Link href={href}>
										<Icon className="size-4" />
										{label}
									</Link>
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem key={key} onClick={() => void onSelect?.()}>
									<Icon className="size-4" />
									{label}
								</DropdownMenuItem>
							)
						)}
					</Fragment>
				))}
			</DropdownMenuContent>
			{dialogs}
		</DropdownMenu>
	);
}
