"use client";

import { Segmented } from "@/components/common/controls";
import { ProductThumb } from "@/components/common/product-thumb";
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
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@posly/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { useAdjustStock } from "@/hooks/use-posly";
import { formatNumber } from "@posly/utils/format";
import type { StockAdjustmentType } from "@/lib/api/posly";
import { stockStatus } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Product } from "@posly/types/domain";
import { ArrowRight, ChevronsUpDown, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const MAX = 1_000_000;

const nextStock = (type: StockAdjustmentType, before: number, quantity: number) =>
	type === "IN" ? before + quantity : type === "OUT" ? before - quantity : quantity;

const STOCK_INK = {
	IN_STOCK: "text-muted-foreground",
	LOW_STOCK: "text-warning",
	OUT_OF_STOCK: "text-danger",
	UNTRACKED: "text-muted-foreground",
} as const;

/** One product as a row: picture, name, and what is on the shelf in the stock colour. */
function ProductRow({ product }: { product: Product }) {
	const status = stockStatus(product);
	return (
		<>
			<ProductThumb art={product.art} imageUrl={product.imageUrl} name={product.name} className="size-8 shrink-0" rounded="rounded-md" />
			<span className="min-w-0 flex-1 truncate text-left font-medium">{product.name}</span>
			<span className={cn("numeric shrink-0 text-xs", STOCK_INK[status])}>
				{formatNumber(product.stock ?? 0)} {product.unit}
			</span>
		</>
	);
}

/**
 * A searchable product list. A shop's stock list runs to dozens of lines, so the picker
 * types to filter (name or SKU) rather than making the owner scroll a plain select.
 */
function ProductPicker({
	id,
	products,
	value,
	onChange,
}: {
	id: string;
	products: Product[];
	value: string;
	onChange: (id: string) => void;
}) {
	const t = useTranslations("inventory");
	const [open, setOpen] = useState(false);
	const selected = products.find((p) => p.id === value);
	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					role="combobox"
					aria-expanded={open}
					aria-controls={`${id}-list`}
					className="flex h-12 w-full items-center gap-3 rounded-lg border bg-card px-2.5 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20"
				>
					{selected ? <ProductRow product={selected} /> : <span className="flex-1 text-left text-muted-foreground">{t("chooseProduct")}</span>}
					<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-(--radix-popover-trigger-width) p-0"
				// After picking, the next thing to do is type the quantity.
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					document.getElementById("stock-quantity")?.focus();
				}}
			>
				<Command>
					<CommandInput placeholder={t("searchProduct")} />
					<CommandList id={`${id}-list`} className="max-h-80">
						<CommandEmpty>{t("noProductMatch")}</CommandEmpty>
						<CommandGroup>
							{products.map((p) => (
								<CommandItem
									key={p.id}
									value={p.id}
									keywords={[p.name, p.sku ?? ""]}
									data-checked={p.id === value}
									onSelect={() => {
										onChange(p.id);
										setOpen(false);
									}}
									className="gap-3 py-1.5"
								>
									<ProductRow product={p} />
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function StockAdjustForm({
	products,
	initialProductId,
	initialType,
	onDone,
}: {
	products: Product[];
	initialProductId: string | null;
	initialType: StockAdjustmentType;
	onDone: () => void;
}) {
	const t = useTranslations("inventory");
	const adjust = useAdjustStock();
	const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? "");
	const [type, setType] = useState<StockAdjustmentType>(initialType);
	const [text, setText] = useState(() => {
		const initial = products.find((p) => p.id === initialProductId);
		return initialType === "COUNT" && initial ? String(initial.stock ?? 0) : "";
	});
	const [note, setNote] = useState("");

	const product = products.find((p) => p.id === productId);
	const before = product?.stock ?? 0;
	const quantity = text === "" ? null : Math.min(Number.parseInt(text, 10), MAX);
	const after = quantity === null ? null : nextStock(type, before, quantity);
	const overdraw = after !== null && after < 0;
	const unchanged = after === before;
	const delta = after === null ? 0 : after - before;
	const canSave = Boolean(product) && quantity !== null && !overdraw && !unchanged && !adjust.isPending;

	const reasonsFor = (of: StockAdjustmentType) =>
		t.raw(of === "IN" ? "reasonsIn" : of === "OUT" ? "reasonsOut" : "reasonsCount") as string[];
	const reasons = reasonsFor(type);

	const changeType = (next: StockAdjustmentType) => {
		setType(next);
		// "รับจากซัพพลายเออร์" makes no sense on a write-off; a typed note is kept.
		if (reasons.includes(note)) setNote("");
		// A count starts from what the system believes is there; a move starts empty.
		setText(next === "COUNT" ? String(before) : "");
	};
	const step = (by: number) => setText(String(Math.max(0, Math.min(MAX, (quantity ?? 0) + by))));

	const quantityLabel = type === "IN" ? t("quantityIn") : type === "OUT" ? t("quantityOut") : t("quantityCount");
	const hint = type === "IN" ? t("hintIn") : type === "OUT" ? t("hintOut") : t("hintCount");

	const save = () => {
		if (!product || quantity === null || after === null) return;
		adjust.mutate(
			{ productId: product.id, type, quantity, note: note.trim() || undefined },
			{
				onSuccess: (saved) => {
					toast.success(t("saved", { name: saved.name, count: formatNumber(saved.stock ?? 0), unit: saved.unit }));
					onDone();
				},
				onError: (error) => toast.error(error.message),
			}
		);
	};

	return (
		<form
			className="space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSave) save();
			}}
		>
			{initialProductId ? (
				product ? (
					<div className="flex items-center gap-3">
						<ProductThumb art={product.art} imageUrl={product.imageUrl} name={product.name} className="size-11" rounded="rounded-lg" />
						<div className="min-w-0">
							<p className="truncate font-semibold">{product.name}</p>
							<p className="numeric text-muted-foreground text-sm">
								{t("before")} {formatNumber(before)} {product.unit}
							</p>
						</div>
					</div>
				) : null
			) : (
				<div className="space-y-3">
					<label htmlFor="stock-product" className="block font-medium text-sm">
						{t("chooseProduct")}
					</label>
					<ProductPicker
						id="stock-product"
						products={products}
						value={productId}
						onChange={(id) => {
							setProductId(id);
							if (type === "COUNT") setText(String(products.find((p) => p.id === id)?.stock ?? 0));
						}}
					/>
				</div>
			)}

			<div className="space-y-3">
				<Segmented
					className="w-full [&>*]:flex-1"
					value={type}
					onChange={changeType}
					options={[
						{ value: "IN", label: t("typeIn") },
						{ value: "OUT", label: t("typeOut") },
						{ value: "COUNT", label: t("typeCount") },
					]}
				/>
				<p className="text-muted-foreground text-xs">{hint}</p>
			</div>

			<div className="space-y-3">
				<label htmlFor="stock-quantity" className="block font-medium text-sm">
					{quantityLabel}
				</label>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" size="icon-lg" className="size-12" onClick={() => step(-1)} disabled={!quantity} aria-label={t("decrease")}>
						<Minus />
					</Button>
					<div className="relative flex-1">
						<input
							id="stock-quantity"
							inputMode="numeric"
							// biome-ignore lint/a11y/noAutofocus: the dialog opens for exactly this input
							autoFocus
							value={text}
							onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 7))}
							placeholder="0"
							className={cn(
								"numeric h-12 w-full rounded-lg border bg-card pr-16 pl-4 text-center font-semibold text-xl outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
								overdraw && "border-danger/60 focus:border-danger/60 focus:ring-danger/20"
							)}
						/>
						<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 text-muted-foreground text-sm">
							{product?.unit}
						</span>
					</div>
					<Button type="button" variant="outline" size="icon-lg" className="size-12" onClick={() => step(1)} aria-label={t("increase")}>
						<Plus />
					</Button>
				</div>
			</div>

			{/* Before → after, so a typo in the count is caught before it is saved. */}
			<div className="relative grid grid-cols-2 overflow-hidden rounded-lg bg-muted/60">
				<div className="px-4 py-3">
					<p className="flex h-5 items-center text-muted-foreground text-xs">{t("before")}</p>
					<p className="numeric mt-1 font-semibold text-xl">
						{formatNumber(before)} <span className="font-normal text-muted-foreground text-sm">{product?.unit}</span>
					</p>
				</div>
				<div className={cn("border-border/60 border-l py-3 pr-4 pl-6 text-right", overdraw && "bg-danger/10")}>
					<p className="flex h-5 items-center justify-end gap-2 text-muted-foreground text-xs">
						{t("after")}
						{after !== null && !unchanged ? (
							<span
								className={cn(
									"numeric rounded px-1.5 py-px font-semibold text-[11px]",
									overdraw ? "bg-danger/15 text-danger" : delta > 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
								)}
							>
								{delta > 0 ? `+${formatNumber(delta)}` : `−${formatNumber(-delta)}`}
							</span>
						) : null}
					</p>
					<p className={cn("numeric mt-1 font-semibold text-xl", overdraw && "text-danger", after === null && "text-muted-foreground")}>
						{after === null ? "—" : formatNumber(after)}{" "}
						<span className="font-normal text-muted-foreground text-sm">{product?.unit}</span>
					</p>
				</div>
				{/* The arrow sits on the divider, so the two halves read as one change. */}
				<span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 flex size-6 items-center justify-center rounded-full bg-popover text-muted-foreground ring-1 ring-border">
					<ArrowRight className="size-3" />
				</span>
			</div>
			{overdraw ? (
				<p className="-mt-4 text-danger text-xs">{t("overdraw", { count: formatNumber(before), unit: product?.unit ?? "" })}</p>
			) : unchanged && quantity !== null ? (
				<p className="-mt-4 text-muted-foreground text-xs">{t("unchanged")}</p>
			) : null}

			<div className="space-y-3">
				<label htmlFor="stock-note" className="block font-medium text-sm">
					{t("note")} <span className="font-normal text-muted-foreground">({t("notePlaceholder")})</span>
				</label>
				<div className="flex flex-wrap gap-2 pb-0.5">
					{reasons.map((reason) => (
						<button
							key={reason}
							type="button"
							onClick={() => setNote(reason)}
							className={cn(
								"h-8 rounded-md px-3 text-xs transition-colors",
								note === reason ? "bg-primary/10 font-medium text-primary" : "bg-muted/70 text-muted-foreground hover:text-foreground"
							)}
						>
							{reason}
						</button>
					))}
				</div>
				<input
					id="stock-note"
					value={note}
					maxLength={200}
					onChange={(event) => setNote(event.target.value)}
					className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
				<Button type="button" variant="outline" size="lg" onClick={onDone}>
					{t("cancel")}
				</Button>
				<Button type="submit" size="lg" className="brand-gradient" disabled={!canSave}>
					{t("save")}
				</Button>
			</DialogFooter>
		</form>
	);
}

/**
 * Receive, write off or count one product's stock. Opened from a row it is fixed to that
 * product; opened from "รับสินค้าเข้า" it starts with a product picker.
 */
export function StockAdjustDialog({
	open,
	onOpenChange,
	products,
	productId,
	initialType = "IN",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	products: Product[];
	productId: string | null;
	initialType?: StockAdjustmentType;
}) {
	const t = useTranslations("inventory");
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{productId ? t("adjustTitle") : t("stockInTitle")}</DialogTitle>
					<DialogDescription className="sr-only">{t("hintIn")}</DialogDescription>
				</DialogHeader>
				{open ? (
					<StockAdjustForm
						key={`${productId}-${initialType}`}
						products={products}
						initialProductId={productId}
						initialType={initialType}
						onDone={() => onOpenChange(false)}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
