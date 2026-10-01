"use client";

import { ConfirmDialog } from "@/components/common/controls";
import { EmptyState, SectionTitle, Surface } from "@/components/common/primitives";
import { TableQrDialog, usePrintQr } from "@/components/tables/table-qr";
import { useTableMutations, useTables } from "@/hooks/use-posly";
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
import { MoreHorizontal, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2, UtensilsCrossed } from "lucide-react";
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
	const pending = create.isPending || update.isPending;
	const valid = name.trim().length > 0;

	const save = () => {
		const input = { name: name.trim(), zone: zone.trim() || null };
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
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
							{t("cancel")}
						</Button>
						<Button type="submit" size="lg" className="brand-gradient" disabled={!valid || pending}>
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

	return (
		<>
			<Surface>
				<SectionTitle
					action={
						list.length > 0 ? (
							<div className="flex gap-2">
								<Button variant="outline" onClick={() => print(list.filter((x) => x.isActive))}>
									<Printer />
									<span className="hidden tablet:inline">{t("printAll")}</span>
								</Button>
								<Button className="brand-gradient" onClick={() => setDialog({ editing: null })}>
									<Plus />
									{t("add")}
								</Button>
							</div>
						) : null
					}
				>
					{t("title")}
				</SectionTitle>
				<p className="-mt-2 mb-4 text-muted-foreground text-sm">{t("description")}</p>

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
									<span className="block truncate text-muted-foreground text-xs">{table.zone ?? "—"}</span>
								</span>
								{table.isActive ? null : <StatusBadge tone="neutral">{t("inactive")}</StatusBadge>}
								<Switch
									checked={table.isActive}
									aria-label={t("active")}
									title={t("activeHint")}
									onCheckedChange={(isActive) => update.mutate({ tableId: table.id, isActive }, { onError })}
								/>
								<Button variant="ghost" size="icon" aria-label={t("qr")} onClick={() => setShowing(table)}>
									<QrCode />
								</Button>
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
										<DropdownMenuItem onClick={() => setConfirm({ kind: "rotate", table })}>
											<RefreshCw />
											{t("rotate")}
										</DropdownMenuItem>
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
