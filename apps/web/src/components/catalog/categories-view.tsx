"use client";

import { EmptyState, PageContainer, PageHeader, StatusBadge, Surface, TableSkeleton } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { Switch } from "@posly/ui/components/switch";
import { useCategories, useCategoryMutations } from "@/hooks/use-posly";
import { useFeature } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import type { Category } from "@posly/types/domain";
import {
	ChefHat,
	Coffee,
	Croissant,
	CupSoda,
	GripVertical,
	Leaf,
	type LucideIcon,
	Milk,
	Package,
	Plus,
	Tags,
	Utensils,
	Scissors,
} from "lucide-react";
import { Reorder } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
	coffee: Coffee,
	leaf: Leaf,
	milk: Milk,
	"cup-soda": CupSoda,
	croissant: Croissant,
	utensils: Utensils,
	package: Package,
	scissors: Scissors,
};

function AddCategory() {
	const t = useTranslations("categories");
	const { create } = useCategoryMutations();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [icon, setIcon] = useState("package");

	const submit = () => {
		if (!name.trim()) return;
		create.mutate(
			{ name: name.trim(), icon },
			{
				onSuccess: () => {
					setOpen(false);
					setName("");
				},
				onError: (e) => toast.error(e.message),
			}
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button size="lg" className="brand-gradient">
					<Plus />
					{t("add")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 space-y-3 p-3">
				<input
					// biome-ignore lint/a11y/noAutofocus: opened by an explicit "add" action
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
					placeholder={t("namePlaceholder")}
					className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary/50"
				/>
				<div className="flex flex-wrap gap-1.5">
					{Object.entries(CATEGORY_ICON).map(([key, Icon]) => (
						<button
							key={key}
							type="button"
							onClick={() => setIcon(key)}
							aria-pressed={icon === key}
							className={`flex size-9 items-center justify-center rounded-lg ring-1 ${icon === key ? "bg-accent text-primary ring-primary" : "ring-border hover:bg-muted"}`}
						>
							<Icon className="size-4" />
						</button>
					))}
				</div>
				<Button className="w-full" onClick={submit} disabled={create.isPending}>
					{t("add")}
				</Button>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Categories (plan §17). Drag to reorder — the POS chips follow `displayOrder` — and toggle
 * a category off to hide it (and its products) from the POS without deleting anything.
 */
export function CategoriesView() {
	const t = useTranslations("categories");
	const categories = useCategories();
	const { update, reorder } = useCategoryMutations();
	// Local order while dragging; the server's order otherwise.
	const [dragging, setDragging] = useState<Category[] | null>(null);
	const items = dragging ?? categories.data ?? [];
	// The kitchen toggle only means something to a shop with the kitchen screen.
	const kitchen = useFeature("KITCHEN_DISPLAY");

	return (
		<PageContainer className="max-w-3xl">
			<PageHeader title={t("title")} description={t("description")} actions={<AddCategory />} />
			<Surface className="p-2">
				{categories.isPending ? (
					<TableSkeleton rows={4} />
				) : items.length === 0 ? (
					<EmptyState icon={Tags} title={t("empty")} description={t("emptyHint")} />
				) : (
					<Reorder.Group axis="y" values={items} onReorder={setDragging} className="grid gap-1">
						{items.map((category) => {
							const Icon = CATEGORY_ICON[category.icon] ?? Package;
							return (
								<Reorder.Item
									key={category.id}
									value={category}
									onDragEnd={() => {
										if (!dragging) return;
										reorder.mutate(
											dragging.map((c) => c.id),
											{ onSettled: () => setDragging(null), onError: (e) => toast.error(e.message) }
										);
									}}
									className="flex cursor-grab items-center gap-3 rounded-xl bg-card p-3 active:cursor-grabbing active:shadow-md"
								>
									<GripVertical className="size-4 text-muted-foreground" />
									<span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
										<Icon className="size-5" />
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium">{category.name}</p>
										<p className="text-muted-foreground text-xs">
											{t("productCount", { count: category.productCount })}
										</p>
									</div>
									{kitchen ? (
										<button
											type="button"
											aria-pressed={category.sendToKitchen}
											title={category.sendToKitchen ? t("sendToKitchenOn") : t("sendToKitchenOff")}
											onPointerDownCapture={(event) => event.stopPropagation()}
											onClick={() =>
												update.mutate(
													{ categoryId: category.id, sendToKitchen: !category.sendToKitchen },
													{ onError: (e) => toast.error(e.message) }
												)
											}
											className={cn(
												"flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-xs transition-colors",
												category.sendToKitchen
													? "bg-primary/10 text-primary hover:bg-primary/15"
													: "border border-dashed text-muted-foreground hover:bg-muted"
											)}
										>
											<ChefHat className="size-3.5" />
											{category.sendToKitchen ? t("kitchenChip") : t("noKitchenChip")}
										</button>
									) : null}
									{category.isActive ? null : <StatusBadge tone="neutral">{t("hidden")}</StatusBadge>}
									<Switch
										checked={category.isActive}
										aria-label={t("showOnPos")}
										// The row is draggable; pressing the switch must not start a drag.
										onPointerDownCapture={(event) => event.stopPropagation()}
										onCheckedChange={(isActive) =>
											update.mutate(
												{ categoryId: category.id, isActive },
												{ onError: (e) => toast.error(e.message) }
											)
										}
									/>
								</Reorder.Item>
							);
						})}
					</Reorder.Group>
				)}
			</Surface>
			<p className="text-muted-foreground text-sm">{t("reorderHint")}</p>
		</PageContainer>
	);
}
