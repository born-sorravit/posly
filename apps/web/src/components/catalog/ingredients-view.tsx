"use client";

import { ConfirmDialog, type Column, DataTable, PageTabs, Segmented } from "@/components/common/controls";
import { StockBadge } from "@/components/common/order-badges";
import { previewAverageCost } from "@/components/catalog/stock-adjust-dialog";
import {
	EmptyState,
	PageContainer,
	PageHeader,
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { IngredientRowsSkeleton } from "@/components/catalog/inventory-skeletons";
import { Button } from "@posly/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@posly/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Switch } from "@posly/ui/components/switch";
import { useIngredientMutations, useIngredients } from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import type { IngredientDto, StockAdjustmentType } from "@/lib/api/posly";
import { stockStatus } from "@/lib/stock";
import { formatNumber } from "@posly/utils/format";
import { formatBaht, fromBaht } from "@posly/utils/money";
import { Carrot, Lock, MoreHorizontal, Package, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

/** "สินค้า / วัตถุดิบ": the two halves of stock, one page each. */
export function InventoryTabs() {
	const t = useTranslations("ingredients");
	return (
		<PageTabs
			tabs={[
				{ href: "/inventory", label: t("tabProducts"), icon: Package },
				{ href: "/inventory/ingredients", label: t("tabIngredients"), icon: Carrot },
			]}
		/>
	);
}

/** Satang per unit can be a fraction ("฿0.50 / กรัม", "฿0.0475 / มล."): keep what matters. */
const perUnit = (unitCost: number) =>
	unitCost >= 100 || Number.isInteger(unitCost) ? formatBaht(Math.round(unitCost)) : `฿${Number((unitCost / 100).toPrecision(3))}`;

const parse = (value: string) => {
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : null;
};

/** Add or edit an ingredient: what it is called, what it is measured in, and what it costs as bought. */
function IngredientDialog({ editing, onClose }: { editing: IngredientDto | null; onClose: () => void }) {
	const t = useTranslations("ingredients");
	const { create, update } = useIngredientMutations();
	const [name, setName] = useState(editing?.name ?? "");
	const [unit, setUnit] = useState(editing?.unit ?? "");
	const [price, setPrice] = useState(editing?.purchasePrice != null ? String(editing.purchasePrice / 100) : "");
	const [qty, setQty] = useState(editing ? String(editing.purchaseQty) : "");
	const [trackStock, setTrackStock] = useState(editing?.trackStock ?? false);
	const [stock, setStock] = useState("");
	const [lowStockAt, setLowStockAt] = useState(editing?.lowStockAt != null ? String(editing.lowStockAt) : "");
	const pending = create.isPending || update.isPending;
	const presets = t.raw("unitPresets") as string[];
	// Recipes hold amounts in this unit; changing it would change what they mean.
	const unitLocked = (editing?.usedBy ?? 0) > 0;

	const priceSatang = fromBaht(parse(price) ?? 0);
	const qtyValue = parse(qty) ?? 0;
	const valid = name.trim() !== "" && unit.trim() !== "" && qtyValue > 0;

	const save = () => {
		const input = {
			name: name.trim(),
			unit: unit.trim(),
			purchasePrice: priceSatang,
			purchaseQty: Math.round(qtyValue * 1000) / 1000,
			trackStock,
			lowStockAt: trackStock ? parse(lowStockAt) : null,
			// Opening stock only: later changes go through "ปรับสต็อก", which keeps a history.
			...(editing ? {} : { stock: trackStock ? (parse(stock) ?? 0) : null }),
		};
		const done = {
			onSuccess: (i: IngredientDto) => {
				toast.success(t("saved", { name: i.name }));
				onClose();
			},
			onError: (e: Error) => toast.error(e.message),
		};
		if (editing) update.mutate({ ingredientId: editing.id, ...input }, done);
		else create.mutate(input, done);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[92svh] gap-6 overflow-y-auto p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
					<DialogDescription>{t("dialogHint")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !pending) save();
					}}
				>
					<div className="space-y-2">
						<Label htmlFor="ing-name">{t("name")}</Label>
						<Input
							id="ing-name"
							// biome-ignore lint/a11y/noAutofocus: the dialog opens for this field
							autoFocus
							maxLength={80}
							value={name}
							placeholder={t("namePlaceholder")}
							onChange={(e) => setName(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ing-unit">{t("unit")}</Label>
						<Input
							id="ing-unit"
							maxLength={20}
							value={unit}
							placeholder={t("unitPlaceholder")}
							readOnly={unitLocked}
							onChange={(e) => setUnit(e.target.value)}
							className={unitLocked ? "h-11 rounded-xl bg-muted/50" : "h-11 rounded-xl"}
						/>
						{unitLocked ? (
							<p className="text-muted-foreground text-xs">{t("unitLocked")}</p>
						) : (
						<div className="flex flex-wrap gap-1.5">
							{presets.map((preset) => (
								<button
									key={preset}
									type="button"
									onClick={() => setUnit(preset)}
									className={
										unit.trim() === preset
											? "h-8 rounded-md bg-accent px-2.5 font-medium text-accent-foreground text-xs"
											: "h-8 rounded-md bg-muted/70 px-2.5 text-muted-foreground text-xs hover:text-foreground"
									}
								>
									{preset}
								</button>
							))}
						</div>
						)}
					</div>
					<div className="space-y-2">
						<Label>{t("bought")}</Label>
						<div className="grid grid-cols-2 gap-2">
							<label className="grid gap-1">
								<span className="px-1 text-muted-foreground text-xs">{t("price")}</span>
								<Input
									inputMode="decimal"
									maxLength={10}
									placeholder="0.00"
									value={price}
									onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
									className="numeric h-11 rounded-xl text-right"
								/>
							</label>
							<label className="grid gap-1">
								<span className="px-1 text-muted-foreground text-xs">{t("qty", { unit: unit.trim() || t("unitFallback") })}</span>
								<Input
									inputMode="decimal"
									maxLength={10}
									placeholder="1000"
									value={qty}
									onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
									className="numeric h-11 rounded-xl text-right"
								/>
							</label>
						</div>
						<p className="text-muted-foreground text-xs">
							{qtyValue > 0 && unit.trim()
								? t("perUnitHint", { cost: perUnit(priceSatang / qtyValue), unit: unit.trim() })
								: t("boughtHint")}
						</p>
					</div>

					<label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-3.5 py-3">
						<span>
							<span className="block font-medium text-sm">{t("trackStock")}</span>
							<span className="block text-muted-foreground text-xs">{t("trackStockHint")}</span>
						</span>
						<Switch checked={trackStock} onCheckedChange={setTrackStock} />
					</label>
					{trackStock ? (
						<div className="grid grid-cols-2 gap-2">
							{editing ? null : (
								<label className="grid gap-1">
									<span className="px-1 text-muted-foreground text-xs">{t("openingStock")}</span>
									<Input
										inputMode="decimal"
										maxLength={12}
										placeholder="0"
										value={stock}
										onChange={(e) => setStock(e.target.value.replace(/[^\d.]/g, ""))}
										className="numeric h-11 rounded-xl text-right"
									/>
								</label>
							)}
							<label className="grid gap-1">
								<span className="px-1 text-muted-foreground text-xs">{t("lowStockAt")}</span>
								<Input
									inputMode="decimal"
									maxLength={12}
									placeholder={t("optional")}
									value={lowStockAt}
									onChange={(e) => setLowStockAt(e.target.value.replace(/[^\d.]/g, ""))}
									className="numeric h-11 rounded-xl text-right"
								/>
							</label>
						</div>
					) : null}

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

/** Received, written off or counted — decimals allowed, since ingredients are weighed. */
function IngredientStockDialog({ ingredient, onClose }: { ingredient: IngredientDto; onClose: () => void }) {
	const t = useTranslations("inventory");
	const ti = useTranslations("ingredients");
	const { adjust } = useIngredientMutations();
	const canPrice = useActiveBusiness().can("products:write");
	const [paidText, setPaidText] = useState("");
	const [type, setType] = useState<StockAdjustmentType>("IN");
	const [quantity, setQuantity] = useState("");
	const [note, setNote] = useState("");
	const before = ingredient.stock ?? 0;
	const amount = parse(quantity) ?? 0;
	const after = Math.round((type === "IN" ? before + amount : type === "OUT" ? before - amount : amount) * 1000) / 1000;
	const valid = quantity !== "" && (type === "COUNT" || amount > 0) && (type !== "OUT" || after >= 0);
	const paid = canPrice && type === "IN" && paidText !== "" ? fromBaht(Number.parseFloat(paidText) || 0) : null;
	const newUnitCost =
		paid !== null && amount > 0 ? previewAverageCost(before, ingredient.purchasePrice ? ingredient.unitCost : null, amount, paid / amount) : null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[92svh] gap-6 overflow-y-auto p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("adjustTitle")}</DialogTitle>
					<DialogDescription>{ingredient.name}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (!valid || adjust.isPending) return;
						adjust.mutate(
							{
								ingredientId: ingredient.id,
								type,
								quantity: Math.round(amount * 1000) / 1000,
								note: note.trim() || undefined,
								...(paid !== null ? { totalCost: paid } : {}),
							},
							{
								onSuccess: () => {
									toast.success(ti("adjusted", { name: ingredient.name }));
									onClose();
								},
								onError: (err) => toast.error(err.message),
							}
						);
					}}
				>
					<Segmented
						className="w-full [&>*]:flex-1"
						value={type}
						onChange={setType}
						options={[
							{ value: "IN", label: t("typeIn") },
							{ value: "OUT", label: t("typeOut") },
							{ value: "COUNT", label: t("typeCount") },
						]}
					/>
					<div className="space-y-2">
						<Label htmlFor="ing-qty">
							{type === "IN" ? t("quantityIn") : type === "OUT" ? t("quantityOut") : t("quantityCount")}
						</Label>
						<div className="relative">
							<Input
								id="ing-qty"
								inputMode="decimal"
								maxLength={12}
								placeholder="0"
								value={quantity}
								onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))}
								className="numeric h-11 rounded-xl pr-16"
							/>
							<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3.5 max-w-14 truncate text-muted-foreground text-sm">
								{ingredient.unit}
							</span>
						</div>
						<p className="numeric text-muted-foreground text-xs">
							{ti("beforeAfter", { before: formatNumber(before), after: formatNumber(after), unit: ingredient.unit })}
						</p>
					</div>
					{canPrice && type === "IN" ? (
						<div className="space-y-2">
							<Label htmlFor="ing-paid">
								{ti("paid")} <span className="font-normal text-muted-foreground">({ti("optional")})</span>
							</Label>
							<Input
								id="ing-paid"
								inputMode="decimal"
								maxLength={10}
								placeholder="0.00"
								value={paidText}
								onChange={(e) => setPaidText(e.target.value.replace(/[^\d.]/g, ""))}
								className="numeric h-11 rounded-xl"
							/>
							<p className="text-muted-foreground text-xs">
								{newUnitCost !== null
									? ti("paidPreview", {
											before: ingredient.unitCost !== null && ingredient.purchasePrice ? perUnit(ingredient.unitCost) : "—",
											after: perUnit(newUnitCost),
											unit: ingredient.unit,
										})
									: ti("paidHint")}
							</p>
						</div>
					) : null}
					<div className="space-y-2">
						<Label htmlFor="ing-note">{t("note")}</Label>
						<Input
							id="ing-note"
							maxLength={200}
							value={note}
							placeholder={t("notePlaceholder")}
							onChange={(e) => setNote(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</div>
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button type="button" variant="outline" size="lg" onClick={onClose}>
							{ti("cancel")}
						</Button>
						<Button type="submit" size="lg" className="brand-gradient" disabled={!valid || adjust.isPending}>
							{ti("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Ingredients (Inventory feature): what recipes are made of, what each costs as bought, and —
 * when tracked — how much is left. Sales take from them by recipe but never stop over one.
 */
export function IngredientsView() {
	const t = useTranslations("ingredients");
	const ti = useTranslations("inventory");
	const enabled = useFeature("INVENTORY");
	const { can } = useActiveBusiness();
	const canEdit = can("products:write");
	const canAdjust = can("inventory:write");
	const ingredients = useIngredients(enabled);
	const { remove } = useIngredientMutations();
	const [dialog, setDialog] = useState<{ editing: IngredientDto | null } | null>(null);
	const [adjusting, setAdjusting] = useState<IngredientDto | null>(null);
	const [deleting, setDeleting] = useState<IngredientDto | null>(null);

	if (!enabled) {
		return (
			<PageContainer>
				<EmptyState
					icon={Lock}
					title={ti("lockedTitle")}
					description={t("lockedHint")}
					action={
						<Button asChild size="lg" className="brand-gradient">
							<Link href="/settings/subscription">{ti("upgrade")}</Link>
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	const rows = ingredients.data ?? [];
	const stockCell = (i: IngredientDto) =>
		i.trackStock ? (
			<span className="numeric font-medium">
				{formatNumber(i.stock ?? 0)} {i.unit}
			</span>
		) : (
			<span className="text-muted-foreground">
				{/* The table's status column says it; the phone row has only this cell. */}
				<span className="tablet:hidden">{t("notTracked")}</span>
				<span className="hidden tablet:inline">—</span>
			</span>
		);
	// As bought ("฿95 / 2,000 มล."), which is what the shop recognises; the price per unit
	// is often a fraction of a baht, so it sits underneath as the detail.
	const boughtCell = (i: IngredientDto) =>
		i.purchasePrice !== null && i.purchasePrice > 0 ? (
			<span className="numeric">
				<span className="block">
					{t("boughtFor", {
						price: formatBaht(i.purchasePrice),
						qty: formatNumber(i.purchaseQty),
						unit: i.unit,
					})}
				</span>
				{i.purchaseQty !== 1 && i.unitCost !== null ? (
					<span className="block text-muted-foreground text-xs">
						{t("perUnitHint", { cost: perUnit(i.unitCost), unit: i.unit })}
					</span>
				) : null}
			</span>
		) : (
			<span className="text-muted-foreground">—</span>
		);
	const menu = (i: IngredientDto) =>
		canEdit || (canAdjust && i.trackStock) ? (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={t("actions", { name: i.name })}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{canAdjust && i.trackStock ? (
						// The row shows its own button from tablet up.
						<DropdownMenuItem className="tablet:hidden" onClick={() => setAdjusting(i)}>
							<PackagePlus />
							{ti("adjust")}
						</DropdownMenuItem>
					) : null}
					{canEdit ? (
						<>
							<DropdownMenuItem onClick={() => setDialog({ editing: i })}>
								<Pencil />
								{t("edit")}
							</DropdownMenuItem>
							<DropdownMenuItem variant="destructive" onClick={() => setDeleting(i)}>
								<Trash2 />
								{t("delete")}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		) : null;

	const columns: Column<IngredientDto>[] = [
		{
			key: "name",
			header: t("name"),
			cell: (i) => (
				<span className="min-w-0">
					<span className="block truncate font-medium">{i.name}</span>
					<span className="block text-muted-foreground text-xs">{i.usedBy ? t("usedBy", { count: i.usedBy }) : t("unused")}</span>
				</span>
			),
		},
		...(canEdit
			? [
					{ key: "cost", header: t("bought"), align: "right" as const, cell: boughtCell },
				]
			: []),
		{ key: "stock", header: ti("current"), align: "right", cell: stockCell },
		{
			key: "status",
			header: ti("status"),
			hideBelow: "tablet",
			cell: (i) =>
				i.trackStock ? (
					<StockBadge status={stockStatus(i)} />
				) : (
					<StatusBadge tone="neutral">{t("notTracked")}</StatusBadge>
				),
		},
		{
			key: "actions",
			header: "",
			align: "right",
			cell: (i) => (
				<span className="inline-flex items-center gap-1">
					{canAdjust && i.trackStock ? (
						<Button variant="outline" size="sm" className="hidden tablet:inline-flex" onClick={() => setAdjusting(i)}>
							{ti("adjust")}
						</Button>
					) : null}
					{menu(i)}
				</span>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					canEdit ? (
						<Button size="lg" className="brand-gradient" onClick={() => setDialog({ editing: null })}>
							<Plus />
							{t("add")}
						</Button>
					) : undefined
				}
			/>
			<InventoryTabs />
			{ingredients.isPending ? (
				<Surface className="overflow-hidden p-0">
					<IngredientRowsSkeleton cost={canEdit} />
				</Surface>
			) : rows.length === 0 ? (
				<Surface>
					<EmptyState icon={Carrot} title={t("empty")} description={t("emptyHint")} />
				</Surface>
			) : (
				<Surface className="overflow-hidden p-0">
					<DataTable
						columns={columns}
						rows={rows}
						rowKey={(i) => i.id}
						mobileRow={(i) => (
							<div className="flex items-center gap-3 text-sm">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{i.name}</p>
									<p className="text-muted-foreground text-xs">
										{canEdit && i.purchasePrice ? `${t("boughtFor", { price: formatBaht(i.purchasePrice), qty: formatNumber(i.purchaseQty), unit: i.unit })} · ` : ""}
										{i.usedBy ? t("usedBy", { count: i.usedBy }) : t("unused")}
									</p>
								</div>
								<div className="flex items-center gap-2 text-right">
									<span className="grid justify-items-end gap-1">
										{stockCell(i)}
										{i.trackStock ? <StockBadge status={stockStatus(i)} /> : null}
									</span>
									{menu(i)}
								</div>
							</div>
						)}
					/>
				</Surface>
			)}
			<p className="text-muted-foreground text-xs leading-relaxed">{t("footnote")}</p>

			{dialog ? <IngredientDialog key={dialog.editing?.id ?? "new"} editing={dialog.editing} onClose={() => setDialog(null)} /> : null}
			{adjusting ? <IngredientStockDialog key={adjusting.id} ingredient={adjusting} onClose={() => setAdjusting(null)} /> : null}
			<ConfirmDialog
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				destructive
				icon={Trash2}
				title={t("deleteTitle", { name: deleting?.name ?? "" })}
				description={deleting?.usedBy ? t("deleteBlocked", { count: deleting.usedBy }) : t("deleteHint")}
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
