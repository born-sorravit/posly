"use client";

import { ConfirmDialog } from "@/components/common/controls";
import { EmptyState, SectionTitle, Surface } from "@/components/common/primitives";
import { TableQrDialog, usePrintQr } from "@/components/tables/table-qr";
import { useTableMutations, useTables, useUpdateBusiness } from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { useSubscription } from "@/components/providers/workspace-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { TableDto } from "@/lib/api/posly";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Skeleton } from "@posly/ui/components/skeleton";
import { Switch } from "@posly/ui/components/switch";
import { StatusBadge } from "@/components/common/primitives";
import { Loader2, Lock, MoreHorizontal, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

function TableDialog({
	editing,
	open,
	onOpenChange,
	suggestedName,
}: {
	editing: TableDto | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	suggestedName: string;
}) {
	const t = useTranslations("tableSettings");
	const { create, update } = useTableMutations();
	const [name, setName] = useState(editing?.name ?? suggestedName);
	const [zone, setZone] = useState(editing?.zone ?? "");
	const [seats, setSeats] = useState(editing?.seats ? String(editing.seats) : "");
	const seatCount = seats === "" ? null : Number(seats);
	const pending = create.isPending || update.isPending;
	const valid = name.trim().length > 0 && (seatCount === null || (seatCount >= 1 && seatCount <= 99));

	const save = () => {
		const input = { name: name.trim(), zone: zone.trim() || null, seats: seatCount };
		const done = {
			onSuccess: () => {
				toast.success(t("saved"));
				onOpenChange(false);
			},
			onError: (e: Error) => toast.error(e.message),
		};
		if (editing) update.mutate({ tableId: editing.id, ...input }, done);
		else create.mutate(input, done);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
					<DialogDescription>{t("formDescription")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !pending) save();
					}}
				>
					<div className="space-y-2.5">
						<Label htmlFor="table-name">{t("name")}</Label>
						<Input
							id="table-name"
							// biome-ignore lint/a11y/noAutofocus: the dialog opens for this field
							autoFocus
							maxLength={40}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("namePlaceholder")}
							className="h-11 rounded-xl"
						/>
					</div>
					<div className="grid grid-cols-[1fr_7rem] gap-3">
						<div className="space-y-2.5">
							<Label htmlFor="table-zone">{t("zone")}</Label>
							<Input
								id="table-zone"
								maxLength={40}
								value={zone}
								onChange={(e) => setZone(e.target.value)}
								placeholder={t("zonePlaceholder")}
								className="h-11 rounded-xl"
							/>
						</div>
						<div className="space-y-2.5">
							<Label htmlFor="table-seats">{t("seats")}</Label>
							<Input
								id="table-seats"
								inputMode="numeric"
								maxLength={2}
								value={seats}
								onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").replace(/^0+/, ""))}
								placeholder={t("seatsPlaceholder")}
								className="numeric h-11 rounded-xl text-center"
							/>
						</div>
					</div>
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
							{t("cancel")}
						</Button>
						<Button type="submit" size="lg" className="brand-gradient" disabled={!valid || pending}>
							{pending ? <Loader2 className="animate-spin" /> : null}
							{t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** "โต๊ะ 7" after "โต๊ะ 6": most shops number their tables, so the next name is usually a guess away. */
const nextName = (tables: TableDto[]) => {
	const numbers = tables.map((t) => /^(.*?)(\d+)$/.exec(t.name)).filter((m): m is RegExpExecArray => m !== null);
	const last = numbers.at(-1);
	if (!last) return tables.length === 0 ? "โต๊ะ 1" : "";
	const highest = Math.max(...numbers.filter((m) => m[1] === last[1]).map((m) => Number(m[2])));
	return `${last[1]}${highest + 1}`;
};

/**
 * Settings → Tables: the shop's tables and their QR codes. Each code is permanent and only
 * takes orders while staff have the table open, so printing once is enough.
 */
export function TableSettings() {
	const t = useTranslations("tableSettings");
	const tables = useTables();
	const { update, remove, rotateQr } = useTableMutations();
	const { print, portal } = usePrintQr();
	const [dialog, setDialog] = useState<{ editing: TableDto | null } | null>(null);
	const [showing, setShowing] = useState<TableDto | null>(null);
	const [confirm, setConfirm] = useState<{ kind: "delete" | "rotate"; table: TableDto } | null>(null);
	const list = tables.data ?? [];
	const onError = (e: Error) => toast.error(e.message);
	const { business, can } = useActiveBusiness();
	const updateBusiness = useUpdateBusiness();
	const [selfOpen, setSelfOpen] = useState(business.tableSelfOpen);
	const tTables = useTranslations("tables");
	const hasTables = useFeature("TABLES");
	// Starter has tables without guests ordering: no QR to print or open tables with.
	const hasQr = useFeature("QR_ORDERING");
	const { limits } = useSubscription();
	const atLimit = limits.tables !== null && list.length >= limits.tables;

	if (!hasTables) {
		return (
			<Surface>
				<EmptyState
					icon={Lock}
					title={tTables("lockedTitle")}
					description={tTables("lockedHint")}
					action={
						<Button asChild size="lg" className="brand-gradient">
							<Link href="/settings/subscription">{tTables("upgrade")}</Link>
						</Button>
					}
				/>
			</Surface>
		);
	}

	return (
		<>
			<Surface>
				<SectionTitle
					action={
						list.length > 0 ? (
							<div className="flex gap-2">
								{hasQr ? (
									<Button variant="outline" onClick={() => print(list.filter((x) => x.isActive))}>
										<Printer />
										<span className="hidden tablet:inline">{t("printAll")}</span>
									</Button>
								) : null}
								<Button className="brand-gradient" disabled={atLimit} onClick={() => setDialog({ editing: null })}>
									<Plus />
									{t("add")}
								</Button>
							</div>
						) : null
					}
				>
					{t("title")}
				</SectionTitle>
				<p className="-mt-2 mb-4 text-muted-foreground text-sm">
					{hasQr ? t("description") : t("descriptionNoQr")}
					{limits.tables !== null ? (
						<span className="numeric ml-1 font-medium text-foreground">
							· {t("usage", { used: list.length, limit: limits.tables })}
						</span>
					) : null}
				</p>
				{atLimit ? (
					<p className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-warning/12 px-4 py-3 text-sm">
						{t("limitReached")}
						<Button asChild variant="outline" size="sm">
							<Link href="/settings/subscription">{t("qrUpsellAction")}</Link>
						</Button>
					</p>
				) : null}
				{!hasQr ? (
					<p className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
						<span className="flex items-center gap-2">
							<QrCode className="size-4 text-primary" />
							{t("qrUpsell")}
						</span>
						<Button asChild variant="outline" size="sm">
							<Link href="/settings/subscription">{t("qrUpsellAction")}</Link>
						</Button>
					</p>
				) : null}
				<label
					className={cn(
						"mb-4 flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3",
						!hasQr && "hidden"
					)}
				>
					<span>
						<span className="block font-medium text-sm">{t("selfOpen")}</span>
						<span className="block text-muted-foreground text-xs">{t("selfOpenHint")}</span>
					</span>
					<Switch
						checked={selfOpen}
						disabled={!can("business:manage")}
						onCheckedChange={(on) => {
							setSelfOpen(on);
							updateBusiness.mutate(
								{ tableSelfOpen: on },
								{
									onSuccess: () => toast.success(t("saved")),
									onError: (e) => {
										setSelfOpen(!on);
										toast.error(e.message);
									},
								}
							);
						}}
					/>
				</label>

				{tables.isPending ? (
					<div className="grid gap-2">
						{Array.from({ length: 4 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<Skeleton key={i} className="h-14 w-full rounded-xl" />
						))}
					</div>
				) : list.length === 0 ? (
					<EmptyState
						icon={UtensilsCrossed}
						title={t("empty")}
						description={t("emptyHint")}
						className="py-10"
						action={
							<Button size="lg" className="brand-gradient h-11 w-full tablet:h-9 tablet:w-auto" onClick={() => setDialog({ editing: null })}>
								<Plus />
								{t("add")}
							</Button>
						}
					/>
				) : (
					<ul className="grid gap-2">
						{list.map((table) => (
							<li key={table.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-xs">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
									<UtensilsCrossed className="size-[18px]" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium text-sm">{table.name}</span>
									<span className="block truncate text-muted-foreground text-xs">
										{[table.zone, table.seats ? t("seatsCount", { count: table.seats }) : null].filter(Boolean).join(" · ") || "—"}
									</span>
								</span>
								{table.isActive ? null : <StatusBadge tone="neutral">{t("inactive")}</StatusBadge>}
								<Switch
									checked={table.isActive}
									aria-label={t("active")}
									title={t("activeHint")}
									onCheckedChange={(isActive) => update.mutate({ tableId: table.id, isActive }, { onError })}
								/>
								{hasQr ? (
									<Button variant="ghost" size="icon" aria-label={t("qr")} onClick={() => setShowing(table)}>
										<QrCode />
									</Button>
								) : null}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" aria-label={t("actions")}>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setDialog({ editing: table })}>
											<Pencil />
											{t("edit")}
										</DropdownMenuItem>
										{hasQr ? (
											<DropdownMenuItem onClick={() => setConfirm({ kind: "rotate", table })}>
												<RefreshCw />
												{t("rotate")}
											</DropdownMenuItem>
										) : null}
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "delete", table })}>
											<Trash2 />
											{t("delete")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						))}
					</ul>
				)}
			</Surface>

			{dialog ? (
				<TableDialog
					key={dialog.editing?.id ?? "new"}
					open
					editing={dialog.editing}
					suggestedName={nextName(list)}
					onOpenChange={(open) => !open && setDialog(null)}
				/>
			) : null}
			<TableQrDialog table={showing} onOpenChange={(open) => !open && setShowing(null)} />
			<ConfirmDialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
				destructive={confirm?.kind === "delete"}
				icon={confirm?.kind === "rotate" ? RefreshCw : undefined}
				title={
					confirm
						? t(confirm.kind === "delete" ? "deleteTitle" : "rotateTitle", { table: confirm.table.name })
						: null
				}
				description={confirm ? t(confirm.kind === "delete" ? "deleteBody" : "rotateBody") : null}
				confirmLabel={confirm?.kind === "rotate" ? t("rotate") : t("delete")}
				cancelLabel={t("cancel")}
				onConfirm={() => {
					if (!confirm) return;
					if (confirm.kind === "delete")
						remove.mutate(confirm.table.id, { onSuccess: () => toast.success(t("deleted")), onError });
					else
						rotateQr.mutate(confirm.table.id, {
							onSuccess: (table) => {
								toast.success(t("rotated"));
								setShowing(table);
							},
							onError,
						});
				}}
			/>
			{portal}
		</>
	);
}
