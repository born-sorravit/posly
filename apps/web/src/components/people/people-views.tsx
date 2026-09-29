"use client";

import { type Column, DataTable } from "@/components/common/controls";
import { ListSkeleton, PageContainer, PageHeader, StatusBadge, Surface } from "@/components/common/primitives";
import { UserAvatar } from "@/components/layout/user-menu";
import { Button } from "@posly/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@posly/ui/components/dialog";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@posly/ui/components/select";
import { useInviteMember, useMemberMutations, useMembers, usePinMutations, useRegenerateInvite } from "@/hooks/use-posly";
import { ConfirmDialog } from "@/components/common/controls";
import { useSubscription } from "@/components/providers/workspace-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { formatRelative, formatThaiDate } from "@posly/utils/format";
import type { Employee, MemberRole } from "@posly/types/domain";
import { Ban, Check, Copy, KeyRound, Link2, Mail, MoreHorizontal, RotateCcw, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { PermissionsDialog } from "@/components/people/permissions-dialog";
import { PinBadge, useSwitchUser } from "@/components/pin/switch-user";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_TONE: Record<MemberRole, "primary" | "info" | "success" | "neutral"> = {
	OWNER: "primary",
	MANAGER: "info",
	CASHIER: "success",
	STAFF: "neutral",
};

/** The one-time link, shown once: copy it, or send it straight to LINE. */
function InviteLinkPanel({ url, expiresAt }: { url: string; expiresAt: string }) {
	const t = useTranslations("employees");
	const [copied, setCopied] = useState(false);
	return (
		<div className="space-y-3 rounded-2xl bg-accent/50 p-4">
			<p className="font-medium text-sm">{t("linkReady")}</p>
			<div className="flex gap-2">
				<input
					readOnly
					value={url}
					onFocus={(e) => e.currentTarget.select()}
					className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 font-mono text-xs"
				/>
				<Button
					type="button"
					onClick={async () => {
						await navigator.clipboard.writeText(url).catch(() => undefined);
						setCopied(true);
					}}
				>
					{copied ? <Check /> : <Copy />}
					{copied ? t("copied") : t("copy")}
				</Button>
			</div>
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs">
					{t("linkHint", { date: formatThaiDate(expiresAt) })}
				</p>
				<Button asChild variant="outline" size="sm">
					<a
						href={`https://line.me/R/share?text=${encodeURIComponent(url)}`}
						target="_blank"
						rel="noreferrer"
					>
						LINE
					</a>
				</Button>
			</div>
		</div>
	);
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const t = useTranslations("employees");
	const tRole = useTranslations("roles");
	const [role, setRole] = useState<MemberRole>("CASHIER");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
	const invite = useInviteMember();

	const close = (next: boolean) => {
		if (!next) {
			setLink(null);
			setName("");
			setEmail("");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("inviteTitle")}</DialogTitle>
					<DialogDescription>{t("inviteHint")}</DialogDescription>
				</DialogHeader>
				{link ? (
					<InviteLinkPanel url={link.url} expiresAt={link.expiresAt} />
				) : (
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="invite-name">{t("name")}</Label>
						<Input id="invite-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="invite-email">{t("email")}</Label>
						<Input id="invite-email" maxLength={255} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
					</div>
					<div className="space-y-1.5">
						<Label>{t("role")}</Label>
						<Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
							<SelectTrigger className="h-11 data-[size=default]:h-11 w-full rounded-xl">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(["MANAGER", "CASHIER", "STAFF"] as const).map((r) => (
									<SelectItem key={r} value={r}>
										{tRole(r)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">{t(`roleHint.${role}` as "roleHint.CASHIER")}</p>
					</div>
				</div>
				)}
				<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
					<Button variant="outline" size="lg" onClick={() => close(false)}>
						{link ? t("done") : t("cancel")}
					</Button>
					{link ? null : (
					<Button
						size="lg"
						className="brand-gradient"
						disabled={!name.trim() || !email.trim() || invite.isPending}
						onClick={() =>
							invite.mutate(
								{ name: name.trim(), email: email.trim(), role },
								{
									onSuccess: (result) => {
										toast.success(t("invited"));
										setLink({ url: result.inviteUrl, expiresAt: result.expiresAt });
									},
									onError: (e) => toast.error(e.message),
								}
							)
						}
					>
						<Mail />
						{t("sendInvite")}
					</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Employees (plan §21): invite by email with a role; PIN login is the phase-3 affordance. */
export function EmployeesView() {
	const t = useTranslations("employees");
	const tRole = useTranslations("roles");
	const [inviting, setInviting] = useState(false);
	const [renewed, setRenewed] = useState<{ url: string; expiresAt: string } | null>(null);
	const members = useMembers();
	const regenerate = useRegenerateInvite();
	const { update, cancelInvite } = useMemberMutations();
	// Staff seats come from the plan; said on the button, before the invite dialog opens.
	const { limits, usage } = useSubscription();
	const seatsFull = limits.members !== null && usage.members >= limits.members;
	const [confirm, setConfirm] = useState<{ kind: "disable" | "cancel"; member: Employee } | null>(null);
	const [editingPerms, setEditingPerms] = useState<Employee | null>(null);
	const tPin = useTranslations("pin");
	const openSwitch = useSwitchUser((s) => s.setOpen);
	const pins = usePinMutations();

	const newLink = (e: Employee) =>
		regenerate.mutate(e.id, {
			onSuccess: (r) => setRenewed({ url: r.inviteUrl, expiresAt: r.expiresAt }),
			onError: (err) => toast.error(err.message),
		});
	const setRole = (e: Employee, role: MemberRole) =>
		update.mutate(
			{ memberId: e.id, role },
			{
				onSuccess: () =>
					toast.success(t("roleChanged", { name: e.name, role: tRole(role) }), {
						description: e.customPermissions ? t("roleResetNote") : undefined,
					}),
				onError: (err) => toast.error(err.message),
			}
		);
	const setActive = (e: Employee, active: boolean) =>
		update.mutate(
			{ memberId: e.id, status: active ? "ACTIVE" : "DISABLED" },
			{
				onSuccess: () => toast.success(active ? t("enabled", { name: e.name }) : t("disabled", { name: e.name })),
				onError: (err) => toast.error(err.message),
			}
		);

	const roleBadges = (e: Employee) => (
		<span className="flex flex-wrap items-center gap-1.5">
			<StatusBadge tone={ROLE_TONE[e.role]}>{tRole(e.role)}</StatusBadge>
			{e.hasPin ? <PinBadge /> : null}
			{e.customPermissions ? (
				<span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground text-xs">
					{t("customBadge")}
				</span>
			) : null}
		</span>
	);
	const statusBadge = (e: Employee) =>
		e.status === "INVITED" ? (
			<StatusBadge tone="warning" dot>
				{t("pending")}
			</StatusBadge>
		) : e.status === "DISABLED" ? (
			<StatusBadge tone="neutral" dot>
				{t("disabledBadge")}
			</StatusBadge>
		) : null;

	const columns: Column<Employee>[] = [
		{
			key: "name",
			header: t("name"),
			cell: (e) => (
				<span className="flex items-center gap-3">
					<UserAvatar name={e.name} />
					<span className="min-w-0">
						<span className="block font-medium">{e.name}</span>
						<span className="block truncate text-muted-foreground text-xs">{e.email}</span>
					</span>
				</span>
			),
		},
		{
			key: "role",
			header: t("role"),
			cell: (e) => roleBadges(e),
		},
		{
			key: "status",
			header: t("status"),
			hideBelow: "tablet",
			cell: (e) => statusBadge(e) ?? (
				<span className="text-muted-foreground text-sm" suppressHydrationWarning>
					{e.lastActiveAt ? formatRelative(e.lastActiveAt) : "—"}
				</span>
			),
		},
		{
			key: "orders",
			header: t("ordersToday"),
			align: "right",
			hideBelow: "tablet",
			cell: (e) => <span className="numeric">{e.ordersToday}</span>,
		},
		{
			key: "actions",
			header: "",
			align: "right",
			className: "w-12",
			// The owner is never managed from here: a shop must not lock out its owner.
			cell: (e) =>
				e.role === "OWNER" ? null : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" aria-label={t("actions", { name: e.name })}>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							{e.status === "INVITED" ? (
								<>
									<DropdownMenuItem onClick={() => newLink(e)}>
										<Link2 />
										{t("newLink")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "cancel", member: e })}>
										<UserX />
										{t("cancelInvite")}
									</DropdownMenuItem>
								</>
							) : (
								<>
									<DropdownMenuLabel className="font-normal text-muted-foreground text-xs">{t("changeRole")}</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={e.role} onValueChange={(role) => setRole(e, role as MemberRole)}>
										{(["MANAGER", "CASHIER", "STAFF"] as const).map((role) => (
											<DropdownMenuRadioItem key={role} value={role}>
												{tRole(role)}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
									{e.isYou ? null : (
										<DropdownMenuItem onClick={() => setEditingPerms(e)}>
											<ShieldCheck />
											{t("editPermissions")}
										</DropdownMenuItem>
									)}
									{e.hasPin && !e.isYou ? (
										<DropdownMenuItem
											onClick={() =>
												pins.clear.mutate(e.id, {
													onSuccess: () => toast.success(tPin("cleared", { name: e.name })),
													onError: (err) => toast.error(err.message),
												})
											}
										>
											<KeyRound />
											{tPin("clearFor")}
										</DropdownMenuItem>
									) : null}
									<DropdownMenuSeparator />
									{e.status === "DISABLED" ? (
										// Re-enabling takes a seat back, so it waits for one.
										<DropdownMenuItem disabled={seatsFull} onClick={() => setActive(e, true)}>
											<RotateCcw />
											<span className="flex flex-col">
												{t("enable")}
												{seatsFull ? (
													<span className="text-muted-foreground text-xs">
														{t("seatsFullShort", { limit: limits.members ?? 0 })}
													</span>
												) : null}
											</span>
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "disable", member: e })}>
											<Ban />
											{t("disable")}
										</DropdownMenuItem>
									)}
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<>
						<Button variant="outline" size="lg" onClick={() => openSwitch(true)}>
							<KeyRound />
							{tPin("switch")}
						</Button>
						<Tooltip>
							<TooltipTrigger asChild>
								{/* A span keeps the tooltip working while the button is disabled. */}
								<span tabIndex={seatsFull ? 0 : -1}>
									<Button
										size="lg"
										className="brand-gradient"
										disabled={seatsFull}
										onClick={() => setInviting(true)}
									>
										<UserPlus />
										{t("invite")}
									</Button>
								</span>
							</TooltipTrigger>
							{seatsFull ? (
								<TooltipContent side="bottom" className="max-w-64">
									{t("seatsFull", { limit: limits.members ?? 0 })}
								</TooltipContent>
							) : null}
						</Tooltip>
					</>
				}
			/>
			{limits.members !== null ? (
				<p className="text-muted-foreground text-sm">
					{t("seats", { used: usage.members, limit: limits.members })}
				</p>
			) : null}
			<Surface className="p-0">
				{members.isPending ? (
					<ListSkeleton rows={4} />
				) : (
					<DataTable
						columns={columns}
						rows={members.data ?? []}
						rowKey={(e) => e.id}
						// A phone: who on the left, their role on the right, the actions menu last. The
						// extras (pending, PIN, custom permissions) get a third line only when there are any.
						mobileRow={(e) => {
							const status = statusBadge(e);
							const hasExtras = status !== null || e.hasPin || e.customPermissions;
							return (
								<div className="flex items-center gap-3">
									<UserAvatar name={e.name} className="size-10" />
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm leading-tight">{e.name}</p>
										<p className="mt-0.5 truncate text-muted-foreground text-xs">{e.email}</p>
										{hasExtras ? (
											<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
												{status}
												{e.hasPin ? <PinBadge /> : null}
												{e.customPermissions ? (
													<span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground text-xs">
														{t("customBadge")}
													</span>
												) : null}
											</div>
										) : null}
									</div>
									<StatusBadge tone={ROLE_TONE[e.role]} className="shrink-0">
										{tRole(e.role)}
									</StatusBadge>
									{/* The owner has no menu; the slot keeps every role badge in one column. */}
									<div className="-mr-1.5 flex w-8 shrink-0 justify-center">
										{columns.find((c) => c.key === "actions")?.cell(e)}
									</div>
								</div>
							);
						}}
					/>
				)}
			</Surface>
			<InviteDialog open={inviting} onOpenChange={setInviting} />
			{editingPerms ? (
				<PermissionsDialog key={editingPerms.id} member={editingPerms} onClose={() => setEditingPerms(null)} />
			) : null}
			<ConfirmDialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
				destructive
				icon={confirm?.kind === "cancel" ? UserX : Ban}
				title={
					confirm?.kind === "cancel"
						? t("cancelInviteTitle", { name: confirm.member.name })
						: t("disableTitle", { name: confirm?.member.name ?? "" })
				}
				description={confirm?.kind === "cancel" ? t("cancelInviteHint") : t("disableHint")}
				confirmLabel={confirm?.kind === "cancel" ? t("cancelInvite") : t("disable")}
				cancelLabel={t("keep")}
				onConfirm={() => {
					if (!confirm) return;
					if (confirm.kind === "disable") setActive(confirm.member, false);
					else
						cancelInvite.mutate(confirm.member.id, {
							onSuccess: () => toast.success(t("inviteCancelled")),
							onError: (err) => toast.error(err.message),
						});
				}}
			/>
			<Dialog open={renewed !== null} onOpenChange={(o) => !o && setRenewed(null)}>
				<DialogContent className="gap-6 p-6 sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("newLink")}</DialogTitle>
						<DialogDescription>{t("newLinkHint")}</DialogDescription>
					</DialogHeader>
					{renewed ? <InviteLinkPanel url={renewed.url} expiresAt={renewed.expiresAt} /> : null}
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
