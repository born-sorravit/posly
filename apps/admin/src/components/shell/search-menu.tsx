"use client";

import { StatusBadge } from "@/components/common/primitives";
import { useDebounced } from "@/hooks/use-debounced";
import { useAdmin } from "@/lib/admin-api";
import { ORDER_STATUS, PLAN_LABEL } from "@/lib/labels";
import type { AdminSearchResponse } from "@/lib/types";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@posly/ui/components/command";
import { formatDateTime } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import {
	Activity,
	BellRing,
	CreditCard,
	LayoutGrid,
	type LucideIcon,
	Megaphone,
	ReceiptText,
	Search,
	Server,
	Store,
	TrendingUp,
	UserRound,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGES: { href: string; label: string; icon: LucideIcon }[] = [
	{ href: "/", label: "ภาพรวม", icon: LayoutGrid },
	{ href: "/attention", label: "ต้องดูแล", icon: BellRing },
	{ href: "/growth", label: "การเติบโต", icon: TrendingUp },
	{ href: "/businesses", label: "ร้านค้า", icon: Store },
	{ href: "/users", label: "ผู้ใช้", icon: Users },
	{ href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
	{ href: "/announcements", label: "ประกาศ", icon: Megaphone },
	{ href: "/activity", label: "กิจกรรม", icon: Activity },
	{ href: "/system", label: "สถานะระบบ", icon: Server },
];

/**
 * ⌘K / Ctrl+K from any page: pages, then shops, accounts and orders from the API (by name,
 * email, id, or "#123" for an order number). Mirrors apps/web's command menu.
 */
export function SearchMenu() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const q = useDebounced(query.trim(), 250);
	const results = useAdmin<AdminSearchResponse>("search", { q }, 0, { enabled: q.length > 0 });
	const data = q ? results.data : undefined;

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const go = (href: string) => {
		setOpen(false);
		setQuery("");
		router.push(href);
	};

	const pages = PAGES.filter((p) => !query.trim() || p.label.toLowerCase().includes(query.trim().toLowerCase()));
	const nothing =
		q && data && !pages.length && !data.businesses.length && !data.users.length && !data.orders.length;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="surface group hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl px-3 text-muted-foreground text-sm transition-shadow hover:shadow-md tablet:flex"
			>
				<Search className="size-4" />
				<span className="flex-1 truncate text-left">ค้นหาร้าน ผู้ใช้ หรือออเดอร์…</span>
				<kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">⌘ K</kbd>
			</button>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="ค้นหา"
				className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground tablet:hidden"
			>
				<Search className="size-5" />
			</button>

			<CommandDialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setQuery("");
				}}
				title="ค้นหา"
				description="ค้นหาร้าน ผู้ใช้ ออเดอร์ และหน้า"
			>
				{/* The API does the matching, so cmdk's own filter is off. */}
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="ชื่อร้าน อีเมล เลขออเดอร์ (#123) หรือรหัส"
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{nothing ? <CommandEmpty>ไม่พบ “{q}”</CommandEmpty> : null}
						{pages.length ? (
							<CommandGroup heading="หน้า">
								{pages.map(({ href, label, icon: Icon }) => (
									<CommandItem key={href} value={`page:${href}`} onSelect={() => go(href)}>
										<Icon />
										{label}
									</CommandItem>
								))}
							</CommandGroup>
						) : null}

						{data?.businesses.length ? (
							<>
								<CommandSeparator />
								<CommandGroup heading="ร้านค้า">
									{data.businesses.map((b) => (
										<CommandItem key={b.id} value={`shop:${b.id}`} onSelect={() => go(`/businesses/${b.id}`)}>
											<Store />
											<span className="min-w-0 flex-1 truncate">{b.name}</span>
											{b.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
											<span className="truncate text-muted-foreground text-xs">
												{b.plan ? (PLAN_LABEL[b.plan] ?? b.plan) : ""} · {b.ownerEmail ?? "—"}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						) : null}

						{data?.users.length ? (
							<>
								<CommandSeparator />
								<CommandGroup heading="ผู้ใช้">
									{data.users.map((u) => (
										<CommandItem key={u.id} value={`user:${u.id}`} onSelect={() => go(`/users/${u.id}`)}>
											<UserRound />
											<span className="min-w-0 flex-1 truncate">{u.name}</span>
											<span className="truncate text-muted-foreground text-xs">{u.email}</span>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						) : null}

						{data?.orders.length ? (
							<>
								<CommandSeparator />
								<CommandGroup heading="ออเดอร์">
									{data.orders.map((o) => {
										const status = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
										return (
											<CommandItem key={o.id} value={`order:${o.id}`} onSelect={() => go(`/businesses/${o.businessId}`)}>
												<ReceiptText />
												<span className="numeric">#{o.number}</span>
												<span className="min-w-0 flex-1 truncate">{o.businessName}</span>
												<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
												<span className="numeric text-muted-foreground text-xs">
													{formatBaht(o.total)} · {formatDateTime(o.createdAt)}
												</span>
											</CommandItem>
										);
									})}
								</CommandGroup>
							</>
						) : null}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
