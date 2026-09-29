"use client";

import { ConfirmDialog, Segmented } from "@/components/common/controls";
import { EmptyState, PageContainer, PageHeader, StatusBadge, Surface } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Skeleton } from "@posly/ui/components/skeleton";
import { Switch } from "@posly/ui/components/switch";
import { useModifierGroupMutations, useModifierGroups } from "@/hooks/use-posly";
import type { ModifierGroupDto } from "@/lib/api/posly";
import { formatBaht, fromBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

interface DraftOption {
	/** Stable per row for React; `id` is the saved option's, kept so carts holding it still work. */
	key: string;
	id?: string;
	name: string;
	price: string;
	isDefault: boolean;
}

let draftSeq = 0;
const blankOption = (): DraftOption => ({ key: `new-${++draftSeq}`, name: "", price: "", isDefault: false });

/** Create or edit one group: its name, how it is chosen, and its options in order. */
function GroupDialog({ editing, onClose }: { editing: ModifierGroupDto | null; onClose: () => void }) {
	const t = useTranslations("modifiers");
	const { create, update } = useModifierGroupMutations();
	const [name, setName] = useState(editing?.name ?? "");
	const [selection, setSelection] = useState<"SINGLE" | "MULTIPLE">(editing?.selection ?? "SINGLE");
	const [required, setRequired] = useState(editing?.required ?? false);
	const [options, setOptions] = useState<DraftOption[]>(
		editing
			? editing.options.map((o) => ({
					key: o.id,
					id: o.id,
					name: o.name,
					price: o.priceDelta ? String(o.priceDelta / 100) : "",
					isDefault: o.isDefault,
				}))
			: [blankOption(), blankOption()]
	);
	const pending = create.isPending || update.isPending;

	const filled = options.filter((o) => o.name.trim());
	const names = filled.map((o) => o.name.trim().toLowerCase());
	const duplicate = new Set(names).size !== names.length;
	const valid = name.trim().length > 0 && filled.length > 0 && !duplicate;

	const patch = (key: string, change: Partial<DraftOption>) =>
		setOptions((list) =>
			list.map((o) =>
				o.key === key
					? { ...o, ...change }
					: // A single-choice group has one default: choosing one clears the rest.
						change.isDefault && selection === "SINGLE"
						? { ...o, isDefault: false }
						: o
			)
		);
	const move = (index: number, by: number) =>
		setOptions((list) => {
			const next = [...list];
			const [row] = next.splice(index, 1);
			next.splice(index + by, 0, row);
			return next;
		});

	const save = () => {
		const input = {
			name: name.trim(),
			selection,
			required,
			options: filled.map((o) => ({
				id: o.id,
				name: o.name.trim(),
				priceDelta: fromBaht(Number.parseFloat(o.price) || 0),
				isDefault: selection === "SINGLE" && o.isDefault,
			})),
		};
		const done = {
			onSuccess: (g: ModifierGroupDto) => {
				toast.success(t("saved", { name: g.name }));
				onClose();
			},
			onError: (e: Error) => toast.error(e.message),
		};
		if (editing) update.mutate({ groupId: editing.id, ...input }, done);
		else create.mutate(input, done);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[92svh] gap-6 overflow-y-auto p-6 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
					<DialogDescription className="sr-only">{t("description")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-6"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !pending) save();
					}}
				>
					<div className="space-y-3">
						<Label htmlFor="mg-name">{t("name")}</Label>
						<Input
							id="mg-name"
							// biome-ignore lint/a11y/noAutofocus: the dialog opens for this field
							autoFocus
							value={name}
							maxLength={80}
							placeholder={t("namePlaceholder")}
							onChange={(e) => setName(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</div>

					<div className="space-y-3">
						<Label>{t("selection")}</Label>
						<Segmented
							className="w-full [&>*]:flex-1"
							value={selection}
							onChange={(next) => {
								setSelection(next);
								// Several defaults make sense only for multiple choice.
								if (next === "SINGLE") {
									let seen = false;
									setOptions((list) =>
										list.map((o) => {
											const keep = o.isDefault && !seen;
											if (o.isDefault) seen = true;
											return { ...o, isDefault: keep };
										})
									);
								}
							}}
							options={[
								{ value: "SINGLE", label: t("single") },
								{ value: "MULTIPLE", label: t("multiple") },
							]}
						/>
						<label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-3.5 py-3">
							<span>
								<span className="block font-medium text-sm">{t("required")}</span>
								<span className="block text-muted-foreground text-xs">{t("requiredHint")}</span>
							</span>
							<Switch checked={required} onCheckedChange={setRequired} />
						</label>
					</div>

					<div className="space-y-3">
						<Label>{t("options")}</Label>
						<div className="grid grid-cols-[1fr_7rem_auto] items-center gap-x-2 gap-y-2">
							<span className="px-1 text-muted-foreground text-xs">{t("optionName")}</span>
							<span className="px-1 text-muted-foreground text-xs">{t("priceDelta")}</span>
							<span />
							{options.map((o, index) => (
								<div key={o.key} className="contents">
									<Input
										aria-label={t("optionName")}
										value={o.name}
										maxLength={80}
										onChange={(e) => patch(o.key, { name: e.target.value })}
										className="h-10 rounded-lg"
									/>
									<Input
										aria-label={t("priceDelta")}
										inputMode="decimal"
										value={o.price}
										placeholder="0"
										onChange={(e) => patch(o.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
										className="numeric h-10 rounded-lg text-right"
									/>
									<span className="flex items-center gap-0.5">
										<button
											type="button"
											role={selection === "SINGLE" ? "radio" : "checkbox"}
											aria-checked={o.isDefault}
											onClick={() => patch(o.key, { isDefault: !o.isDefault })}
											className={cn(
												"h-8 rounded-md px-2 text-xs transition-colors",
												o.isDefault ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
											)}
										>
											{t("default")}
										</button>
										<Button type="button" variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
											<ArrowUp />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label={t("moveDown")}
											disabled={index === options.length - 1}
											onClick={() => move(index, 1)}
										>
											<ArrowDown />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label={t("removeOption")}
											disabled={options.length === 1}
											onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
											className="text-muted-foreground hover:text-danger"
										>
											<X />
										</Button>
									</span>
								</div>
							))}
						</div>
						{duplicate ? <p className="text-danger text-xs">{t("dupName")}</p> : null}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-primary"
							disabled={options.length >= 30}
							onClick={() => setOptions((list) => [...list, blankOption()])}
						>
							<Plus />
							{t("addOption")}
						</Button>
					</div>

					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button type="button" variant="outline" size="lg" onClick={onClose}>
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

/**
 * Option groups (plan §16): Size, Sweetness, Toppings. One group serves many products —
 * edit "Size" once and every drink using it follows. Attach groups in the product form.
 */
export function ModifiersView() {
	const t = useTranslations("modifiers");
	const groups = useModifierGroups();
	const { remove } = useModifierGroupMutations();
	const [dialog, setDialog] = useState<{ editing: ModifierGroupDto | null } | null>(null);
	const [deleting, setDeleting] = useState<ModifierGroupDto | null>(null);

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<Button
						size="lg"
						className="brand-gradient"
						data-tour="modifiers-add"
						onClick={() => setDialog({ editing: null })}
					>
						<Plus />
						{t("add")}
					</Button>
				}
			/>

			{groups.isPending ? (
				<div className="grid gap-4 tablet:grid-cols-2">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-40 rounded-2xl" />
					))}
				</div>
			) : (groups.data ?? []).length === 0 ? (
				<Surface data-tour="modifiers-list">
					<EmptyState icon={SlidersHorizontal} title={t("empty")} description={t("emptyHint")} />
				</Surface>
			) : (
				<div className="grid gap-4 tablet:grid-cols-2" data-tour="modifiers-list">
					{(groups.data ?? []).map((g) => (
						<Surface key={g.id} className="flex flex-col gap-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-semibold">{g.name}</p>
									<p className="mt-1 flex flex-wrap items-center gap-1.5">
										<StatusBadge tone="neutral">{g.selection === "SINGLE" ? t("single") : t("multiple")}</StatusBadge>
										{g.required ? <StatusBadge tone="primary">{t("required")}</StatusBadge> : null}
									</p>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon-sm" aria-label={t("actions", { name: g.name })}>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setDialog({ editing: g })}>
											<Pencil />
											{t("edit")}
										</DropdownMenuItem>
										<DropdownMenuItem variant="destructive" onClick={() => setDeleting(g)}>
											<Trash2 />
											{t("delete")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<ul className="flex flex-wrap gap-1.5">
								{g.options.map((o) => (
									<li
										key={o.id}
										className={cn(
											"rounded-lg px-2.5 py-1 text-sm",
											o.isDefault ? "bg-primary/10 font-medium text-primary" : "bg-muted/70"
										)}
									>
										{o.name}
										<span className="numeric ml-1.5 text-muted-foreground text-xs">
											{o.priceDelta > 0 ? `+${formatBaht(o.priceDelta)}` : ""}
										</span>
									</li>
								))}
							</ul>
							<button
								type="button"
								onClick={() => setDialog({ editing: g })}
								className="mt-auto text-left text-muted-foreground text-xs hover:text-foreground"
							>
								{g.productCount ? t("usedBy", { count: g.productCount }) : t("unused")}
							</button>
						</Surface>
					))}
				</div>
			)}

			{dialog ? <GroupDialog key={dialog.editing?.id ?? "new"} editing={dialog.editing} onClose={() => setDialog(null)} /> : null}
			<ConfirmDialog
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				destructive
				icon={Trash2}
				title={t("deleteTitle", { name: deleting?.name ?? "" })}
				description={t("deleteHint")}
				confirmLabel={t("delete")}
				cancelLabel={t("keep")}
				onConfirm={() =>
					deleting &&
					remove.mutate(deleting.id, {
						onSuccess: () => toast.success(t("deleted")),
						onError: (e) => toast.error(e.message),
					})
				}
			/>
		</PageContainer>
	);
}
