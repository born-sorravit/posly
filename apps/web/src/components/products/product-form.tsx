"use client";

import { PageContainer, SectionTitle, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@posly/ui/components/select";
import { Checkbox } from "@posly/ui/components/checkbox";
import { Switch } from "@posly/ui/components/switch";
import { Link, useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/common/controls";
import { ReadOnlyNotice } from "@/components/common/permission-gate";
import { EmptyState, TableSkeleton } from "@/components/common/primitives";
import {
	blankRecipeLine,
	type DraftRecipeLine,
	draftRecipeCost,
	filledRecipeLines,
	RecipeEditor,
	toDraftLines,
} from "@/components/catalog/recipe-editor";
import { Segmented } from "@/components/common/controls";
import {
	useCategories,
	useDeleteProduct,
	useIngredients,
	useModifierGroups,
	useProduct,
	useRecipe,
	useSaveProduct,
	useSetRecipe,
} from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import type { ProductDto, RecipeDto } from "@/lib/api/posly";
import { isAllowedImage, MAX_UPLOAD_BYTES, uploadImage } from "@/lib/api/uploads";
import { formatBaht, fromBaht } from "@posly/utils/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, SearchX, SlidersHorizontal, Trash2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/**
 * Prices are typed in baht (what a person thinks in) and converted to satang exactly once,
 * on submit, with `fromBaht` — the form never does arithmetic on the typed floats.
 */
const schema = z
	.object({
		name: z.string().trim().min(1).max(120),
		categoryId: z.string(),
		price: z.coerce.number().min(0).max(1_000_000),
		cost: z.union([z.literal(""), z.coerce.number().min(0).max(1_000_000)]),
		sku: z.string().max(40),
		barcode: z.string().max(40),
		trackStock: z.boolean(),
		stock: z.union([z.literal(""), z.coerce.number().int().min(0)]),
		lowStockAt: z.union([z.literal(""), z.coerce.number().int().min(0)]),
		unit: z.string().trim().min(1).max(20),
	})
	.refine((v) => !v.trackStock || v.stock !== "", { path: ["stock"], message: "required" });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

/** A whole-number input that shows the product's unit inside it ("12 ขวด"). */
const UnitInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input> & { unit?: string }>(
	function UnitInput({ unit, className, ...props }, ref) {
		return (
			<div className="relative">
				<Input ref={ref} inputMode="numeric" className={cn("numeric h-11 rounded-xl pr-16", className)} {...props} />
				<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3.5 max-w-14 truncate text-muted-foreground text-sm">
					{unit}
				</span>
			</div>
		);
	}
);

function Field({
	label,
	htmlFor,
	error,
	hint,
	className,
	children,
}: {
	className?: string;
	label: string;
	htmlFor: string;
	error?: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<Label htmlFor={htmlFor} className="font-medium text-sm">
				{label}
			</Label>
			{children}
			{error ? (
				<p className="text-danger text-xs">{error}</p>
			) : hint ? (
				<p className="text-muted-foreground text-xs">{hint}</p>
			) : null}
		</div>
	);
}

/**
 * Add / edit product (plan §15). The image goes straight to the storage bucket through a
 * signed URL (`uploadImage`) the moment it is picked; saving the form only stores its path.
 */
export function ProductFormPage({ productId }: { productId?: string }) {
	const t = useTranslations("productForm");
	const product = useProduct(productId);
	const categories = useCategories();
	// Recipes need the Inventory feature and the right to see costs; without either the
	// form is exactly what it was, a typed cost.
	const inventory = useFeature("INVENTORY");
	const { can } = useActiveBusiness();
	const recipes = inventory && can("products:write");
	const recipe = useRecipe(productId ? { productId } : null, recipes);
	const ingredients = useIngredients(recipes);
	if (
		(productId && product.isPending) ||
		categories.isPending ||
		(recipes && ((productId && recipe.isPending) || ingredients.isPending))
	) {
		return (
			<PageContainer className="max-w-5xl">
				<TableSkeleton />
			</PageContainer>
		);
	}
	if (productId && !product.data) {
		return (
			<PageContainer>
				<EmptyState icon={SearchX} title={t("notFound")} />
			</PageContainer>
		);
	}
	return (
		<ProductForm
			key={product.data?.id ?? "new"}
			product={product.data}
			recipes={recipes}
			recipe={recipe.data}
		/>
	);
}

function ProductForm({ product, recipes, recipe }: { product?: ProductDto; recipes: boolean; recipe?: RecipeDto }) {
	const t = useTranslations("productForm");
	const router = useRouter();
	const { business, can } = useActiveBusiness();
	// Cashiers may open a product to check its price or stock, but not change it.
	const readOnly = !can("products:write");
	const categories = useCategories().data ?? [];
	const save = useSaveProduct(product?.id);
	const remove = useDeleteProduct();
	const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
	const [imagePath, setImagePath] = useState<string | null | undefined>(undefined);
	const [uploading, setUploading] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const modifierGroups = useModifierGroups();
	// Before the shop's list loads, show what the product already has so nothing flickers.
	const allGroups = modifierGroups.data ?? product?.modifierGroups ?? [];
	const [groupIds, setGroupIds] = useState<string[]>(() => product?.modifierGroups.map((g) => g.id) ?? []);
	const ingredients = useIngredients(recipes).data ?? [];
	const setRecipe = useSetRecipe();
	const hadRecipe = (recipe?.lines.length ?? 0) > 0;
	const [costMode, setCostMode] = useState<"manual" | "recipe">(hadRecipe ? "recipe" : "manual");
	const [recipeLines, setRecipeLines] = useState<DraftRecipeLine[]>(() =>
		hadRecipe ? toDraftLines(recipe) : [blankRecipeLine()]
	);
	const fromRecipe = recipes && costMode === "recipe";
	const recipeCost = draftRecipeCost(recipeLines, ingredients);

	useEffect(() => () => {
		if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
	}, [preview]);

	const {
		register,
		handleSubmit,
		control,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<FormInput, unknown, FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: product?.name ?? "",
			categoryId: product?.categoryId ?? categories[0]?.id ?? "",
			price: product ? product.price / 100 : "",
			cost: product?.cost != null ? product.cost / 100 : "",
			sku: product?.sku ?? "",
			barcode: product?.barcode ?? "",
			trackStock: product?.trackStock ?? false,
			stock: product?.stock ?? "",
			lowStockAt: product?.lowStockAt ?? "",
			unit: product?.unit ?? t("unitDefault"),
		},
	});

	const [trackStock, priceInput, costInput, unit] = useWatch({
		control,
		name: ["trackStock", "price", "cost", "unit"],
	});
	const unitPresets = t.raw("unitPresets") as string[];
	const price = Number(priceInput) || 0;
	const cost = fromRecipe ? recipeCost / 100 : Number(costInput) || 0;
	const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;

	const onFile = async (file: File | undefined) => {
		if (!file) return;
		if (!isAllowedImage(file)) return toast.error(t("imageType"));
		if (file.size > MAX_UPLOAD_BYTES) return toast.error(t("imageSize"));
		setPreview(URL.createObjectURL(file));
		setUploading(true);
		try {
			const uploaded = await uploadImage(business.id, file, "product-image");
			setImagePath(uploaded.path);
		} catch (error) {
			setPreview(product?.imageUrl ?? null);
			toast.error(error instanceof Error ? error.message : t("uploadFailed"));
		} finally {
			setUploading(false);
		}
	};

	const onSubmit = async (values: FormValues) => {
		const lines = filledRecipeLines(recipeLines);
		if (fromRecipe && lines.length === 0) return toast.error(t("recipeEmpty"));
		// Every amount leaves as satang, converted once here.
		try {
			// Back to a typed cost: drop the recipe first, or the server keeps its computed cost.
			if (recipes && product && hadRecipe && !fromRecipe) {
				await setRecipe.mutateAsync({ owner: { productId: product.id }, lines: [] });
			}
			const saved = await save.mutateAsync({
				name: values.name,
				categoryId: values.categoryId || null,
				price: fromBaht(values.price),
				cost: fromRecipe ? recipeCost : values.cost === "" ? null : fromBaht(values.cost),
				sku: values.sku.trim() || null,
				barcode: values.barcode.trim() || null,
				trackStock: values.trackStock,
				stock: values.trackStock && values.stock !== "" ? values.stock : null,
				lowStockAt: values.trackStock && values.lowStockAt !== "" ? values.lowStockAt : null,
				unit: values.unit,
				modifierGroupIds: groupIds,
				...(imagePath !== undefined ? { imagePath } : {}),
			});
			if (fromRecipe) {
				try {
					await setRecipe.mutateAsync({ owner: { productId: saved.id }, lines });
				} catch (error) {
					// The product exists now: retrying from a "new" form would create a second one.
					toast.error(error instanceof Error ? error.message : t("saveFailed"));
					if (!product) router.replace(`/products/${saved.id}`);
					return;
				}
			}
			toast.success(t("saved"));
			router.push("/products");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("saveFailed"));
		}
	};

	return (
		<PageContainer className="max-w-5xl">
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Button asChild variant="ghost" size="icon-lg" aria-label={t("back")}>
							<Link href="/products">
								<ArrowLeft />
							</Link>
						</Button>
						<h1 className="font-semibold text-2xl tracking-tight">
							{product ? product.name : t("newTitle")}
						</h1>
					</div>
					{readOnly ? null : (
					<div className="flex gap-2">
						{product ? (
							<Button
								type="button"
								variant="ghost"
								size="lg"
								className="text-danger hover:text-danger"
								onClick={() => setConfirmDelete(true)}
							>
								<Trash2 />
								<span className="hidden tablet:inline">{t("delete")}</span>
							</Button>
						) : null}
						<Button type="submit" size="lg" className="brand-gradient min-w-28" disabled={isSubmitting || uploading}>
							{t("save")}
						</Button>
					</div>
					)}
				</div>

				{readOnly ? <ReadOnlyNotice permission="products:write" /> : null}

				{/* A disabled fieldset makes every input, switch and upload inert in one place. */}
				<fieldset disabled={readOnly} className="contents">

				<div className="grid gap-4 desktop:grid-cols-3">
					<div className="space-y-4 desktop:col-span-2">
						<Surface className="space-y-4">
							<SectionTitle>{t("details")}</SectionTitle>
							<Field label={t("name")} htmlFor="name" error={errors.name && t("nameRequired")}>
								<Input id="name" maxLength={120} className="h-11 rounded-xl" {...register("name")} />
							</Field>
							<div className="grid gap-4 tablet:grid-cols-2">
								<Field label={t("category")} htmlFor="category">
									<Controller
										control={control}
										name="categoryId"
										render={({ field }) => (
											<Select value={field.value} onValueChange={field.onChange}>
												<SelectTrigger id="category" className="h-11 data-[size=default]:h-11 w-full rounded-xl">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{categories.map((c) => (
														<SelectItem key={c.id} value={c.id}>
															{c.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</Field>
								<Field label={t("unit")} htmlFor="unit" error={errors.unit && t("unitRequired")}>
									<div className="relative">
										<Input
											id="unit"
											maxLength={20}
											placeholder={t("unitPlaceholder")}
											className="h-11 rounded-xl pr-11"
											{...register("unit")}
										/>
										{/* Type any unit, or pick one of the units a Thai shop counts in most. */}
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													aria-label={t("unitPresetsLabel")}
													className="-translate-y-1/2 absolute top-1/2 right-1.5 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
												>
													<ChevronDown className="size-4" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="min-w-40">
												<DropdownMenuRadioGroup
													value={unit?.trim() ?? ""}
													onValueChange={(preset) => setValue("unit", preset, { shouldDirty: true, shouldValidate: true })}
												>
													{unitPresets.map((preset) => (
														<DropdownMenuRadioItem key={preset} value={preset} className="h-8">
															{preset}
														</DropdownMenuRadioItem>
													))}
												</DropdownMenuRadioGroup>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</Field>
								<Field label={t("price")} htmlFor="price" error={errors.price && t("priceInvalid")}>
									<Input id="price" maxLength={10} inputMode="decimal" className="numeric h-11 rounded-xl" placeholder="0.00" {...register("price")} />
								</Field>
								<Field
									label={t("cost")}
									htmlFor="cost"
									hint={
										margin !== null
											? `${fromRecipe ? `${t("costFromRecipe")} · ` : ""}${t("margin", { margin })}`
											: fromRecipe
												? t("costFromRecipe")
												: t("costHint")
									}
								>
									{fromRecipe ? (
										<Input id="cost" readOnly value={(recipeCost / 100).toFixed(2)} className="numeric h-11 rounded-xl bg-muted/50" />
									) : (
										<Input id="cost" maxLength={10} inputMode="decimal" className="numeric h-11 rounded-xl" placeholder="0.00" {...register("cost")} />
									)}
								</Field>
								<Field label={t("sku")} htmlFor="sku">
									<Input id="sku" maxLength={40} className="h-11 rounded-xl" {...register("sku")} />
								</Field>
								<Field label={t("barcode")} htmlFor="barcode">
									<Input id="barcode" maxLength={40} className="h-11 rounded-xl" {...register("barcode")} />
								</Field>
							</div>
						</Surface>

						{recipes && !readOnly ? (
							<Surface className="space-y-4">
								<div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
									<div>
										<p className="font-semibold">{t("recipeTitle")}</p>
										<p className="text-muted-foreground text-sm">{t("recipeHint")}</p>
									</div>
									<Segmented
										className="shrink-0"
										value={costMode}
										onChange={setCostMode}
										options={[
											{ value: "manual", label: t("costManual") },
											{ value: "recipe", label: t("costRecipe") },
										]}
									/>
								</div>
								{fromRecipe ? (
									<RecipeEditor ingredients={ingredients} lines={recipeLines} onChange={setRecipeLines} />
								) : null}
							</Surface>
						) : null}

						<Surface className="space-y-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="font-semibold">{t("trackStock")}</p>
									<p className="text-muted-foreground text-sm">{t("trackStockHint")}</p>
								</div>
								<Controller
									control={control}
									name="trackStock"
									render={({ field }) => (
										<Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t("trackStock")} />
									)}
								/>
							</div>
							{trackStock ? (
								<div className="grid gap-4 tablet:grid-cols-2">
									<Field label={t("stock")} htmlFor="stock" error={errors.stock && t("stockRequired")}>
										<UnitInput id="stock" maxLength={7} unit={unit} {...register("stock")} />
									</Field>
									<Field label={t("lowStockAt")} htmlFor="lowStockAt" hint={t("lowStockHint")}>
										<UnitInput id="lowStockAt" maxLength={7} unit={unit} {...register("lowStockAt")} />
									</Field>
								</div>
							) : null}
						</Surface>

						<Surface>
							<SectionTitle
								action={
									readOnly ? null : (
										<Button asChild variant="ghost" size="sm" className="text-primary">
											<Link href="/modifiers">
												<SlidersHorizontal />
												{t("manageModifiers")}
											</Link>
										</Button>
									)
								}
							>
								{t("modifiers")}
							</SectionTitle>
							<p className="mb-4 text-muted-foreground text-sm">{t("modifiersHint")}</p>
							{allGroups.length === 0 ? (
								<p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-muted-foreground text-sm">
									{t("noModifierGroups")}
								</p>
							) : (
								<ul className="grid gap-2">
									{allGroups.map((group) => {
										const checked = groupIds.includes(group.id);
										return (
											<li key={group.id}>
												<label
													className={cn(
														"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
														checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
														readOnly && "cursor-default"
													)}
												>
													<Checkbox
														className="mt-0.5"
														checked={checked}
														disabled={readOnly}
														onCheckedChange={(on) =>
															setGroupIds((ids) => (on ? [...ids, group.id] : ids.filter((id) => id !== group.id)))
														}
													/>
													<span className="min-w-0 flex-1">
														<span className="flex items-center justify-between gap-2 font-medium text-sm">
															{group.name}
															<span className="shrink-0 font-normal text-muted-foreground text-xs">
																{group.selection === "SINGLE" ? t("single") : t("multiple")} ·{" "}
																{group.required ? t("required") : t("optional")}
															</span>
														</span>
														<span className="mt-1 block truncate text-muted-foreground text-xs">
															{group.options
																.map((o) => (o.priceDelta > 0 ? `${o.name} +${formatBaht(o.priceDelta)}` : o.name))
																.join(", ")}
														</span>
													</span>
												</label>
											</li>
										);
									})}
								</ul>
							)}
						</Surface>
					</div>

					<Surface className="h-fit space-y-3">
						<SectionTitle>{t("image")}</SectionTitle>
						<label className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40 text-center transition-colors hover:border-primary/40 hover:bg-accent/40">
							{uploading ? (
								<span className="absolute top-2 right-2 z-10 rounded-lg bg-background/80 p-1.5">
									<Loader2 className="size-4 animate-spin" />
								</span>
							) : null}
							{preview ? (
								<Image src={preview} alt="" fill unoptimized className="object-cover" />
							) : product ? (
								<ProductThumb art={product.art} name={product.name} className="absolute inset-0" rounded="rounded-none" />
							) : (
								<>
									<ImagePlus className="size-8 text-muted-foreground" />
									<span className="font-medium text-sm">{t("upload")}</span>
									<span className="text-muted-foreground text-xs">{t("uploadHint")}</span>
								</>
							)}
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								className="sr-only"
								onChange={(event) => void onFile(event.target.files?.[0])}
							/>
						</label>
						<p className="text-muted-foreground text-xs">{t("storageNote")}</p>
					</Surface>
				</div>
				</fieldset>
			</form>
			{product && !readOnly ? (
				<ConfirmDialog
					open={confirmDelete}
					onOpenChange={setConfirmDelete}
					title={t("deleteTitle", { name: product.name })}
					description={t("deleteHint")}
					confirmLabel={t("delete")}
					cancelLabel={t("keep")}
					destructive
					icon={Trash2}
					onConfirm={() =>
						remove.mutate(product.id, {
							onSuccess: () => {
								toast.success(t("deleted"));
								router.push("/products");
							},
							onError: (error) => toast.error(error.message),
						})
					}
				/>
			) : null}
		</PageContainer>
	);
}
