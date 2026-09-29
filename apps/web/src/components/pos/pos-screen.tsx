"use client";

import { SearchInput, Segmented } from "@/components/common/controls";
import { EmptyState, ProductCardSkeleton } from "@/components/common/primitives";
import { CartPanel } from "@/components/pos/cart-panel";
import { useSubscription } from "@/components/providers/workspace-provider";
import { type CompletedPayment, CheckoutDialog } from "@/components/pos/checkout-dialog";
import { ModifierDialog } from "@/components/pos/modifier-dialog";
import { ProductCard } from "@/components/pos/product-card";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@posly/ui/components/sheet";
import { useCategories, useCheckout, useProducts } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { formatBaht, type Satang } from "@posly/utils/money";
import { computeTotals, remainingStock, useCartStore } from "@/stores/cart-store";
import type { OrderItemModifier, PaymentMethod, Product } from "@posly/types/domain";
import { PackageSearch, ShoppingBasket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const ALL = "all";

/** Typing in a field must never trigger a shortcut. */
const isTyping = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The POS (plan §9–13) — the screen the product lives or dies on.
 *
 *   desktop / tablet   search · category chips · product grid  |  cart column
 *   phone              search · chips · grid, with a floating cart bar → bottom sheet
 *
 * Built so pick → checkout → paid → next order takes a few seconds: one tap adds, Enter
 * checks out, the success screen focuses "New order". Every interaction is local state; the
 * network only enters at payment, which is the seam an offline sync queue plugs into later.
 */
export function PosScreen() {
	const t = useTranslations("pos");
	const { business, branch } = useActiveBusiness();
	const productsQuery = useProducts();
	const categoriesQuery = useCategories();
	const checkoutMutation = useCheckout();
	const [category, setCategory] = useState<string>(ALL);
	const [query, setQuery] = useState("");
	const [customising, setCustomising] = useState<Product | null>(null);
	const [checkoutOpen, setCheckoutOpen] = useState(false);
	const [cartOpen, setCartOpen] = useState(false);
	// One clientOrderId per checkout session: retries replay it, the next order gets a new one.
	const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());
	const searchRef = useRef<HTMLInputElement>(null);

	const lines = useCartStore((state) => state.lines);
	const discount = useCartStore((state) => state.discount);
	const add = useCartStore((state) => state.add);
	const clear = useCartStore((state) => state.clear);

	const totals = useMemo(
		() => computeTotals(lines, discount, business.vatBasisPoints, business.pricesIncludeVat),
		[lines, discount, business.vatBasisPoints, business.pricesIncludeVat]
	);
	const categories = useMemo(
		() =>
			(categoriesQuery.data ?? [])
				.filter((c) => c.isActive)
				.sort((a, b) => a.displayOrder - b.displayOrder),
		[categoriesQuery.data]
	);

	const products = useMemo(() => {
		const q = query.trim().toLowerCase();
		const visible = new Set(categories.map((c) => c.id));
		return (productsQuery.data ?? []).filter(
			(p) =>
				p.isActive &&
				// A hidden category hides its products from the till too.
				(!p.categoryId || visible.has(p.categoryId)) &&
				(category === ALL || p.categoryId === category) &&
				(!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode === q)
		);
	}, [category, query, categories, productsQuery.data]);

	// Keep the cart's ceilings in step with the latest shelf counts from the API.
	const syncStock = useCartStore((state) => state.syncStock);
	useEffect(() => {
		if (productsQuery.data) syncStock(productsQuery.data);
	}, [productsQuery.data, syncStock]);

	const warnLimit = useCallback(
		(name: string, stock: number) => toast.warning(t("stockLimit", { name, count: stock })),
		[t]
	);

	const select = useCallback(
		(product: Product) => {
			if (product.modifierGroups.length > 0) {
				// Check before opening options, not after the cashier has chosen size and sugar.
				if (remainingStock(useCartStore.getState(), product.id) === 0) {
					warnLimit(product.name, product.stock ?? 0);
					return;
				}
				setCustomising(product);
				return;
			}
			if (add(product) === "limit") warnLimit(product.name, product.stock ?? 0);
		},
		[add, warnLimit]
	);

	const confirmModifiers = (product: Product, modifiers: OrderItemModifier[], note: string | null) => {
		if (add(product, modifiers, note) === "limit") warnLimit(product.name, product.stock ?? 0);
		setCustomising(null);
	};

	const inCart = useMemo(() => {
		const counts = new Map<string, number>();
		for (const line of lines) counts.set(line.productId, (counts.get(line.productId) ?? 0) + line.quantity);
		return counts;
	}, [lines]);

	// The pay button is disabled at the quota; Enter must not get around it either.
	const { limits, usage } = useSubscription();
	const outOfOrders = limits.orders !== null && usage.ordersThisMonth >= limits.orders;

	const openCheckout = useCallback(() => {
		if (useCartStore.getState().lines.length === 0) return;
		if (outOfOrders) {
			toast.error(t("quotaReached", { limit: limits.orders ?? 0 }));
			return;
		}
		setCartOpen(false);
		setCheckoutOpen(true);
	}, [outOfOrders, limits.orders, t]);

	/** The server reprices; what it answers is what the success screen shows. */
	const pay = async (method: PaymentMethod, received: Satang | null): Promise<CompletedPayment> => {
		const { lines: cartLines, discount: cartDiscount, customer, serviceType, label } = useCartStore.getState();
		// A percentage is resolved against the cart as it is at the moment of payment.
		const resolved = computeTotals(cartLines, cartDiscount, business.vatBasisPoints, business.pricesIncludeVat).discount;
		const order = await checkoutMutation.mutateAsync({
			clientOrderId: sessionKey,
			branchId: branch?.id,
			items: cartLines.map((line) => ({
				productId: line.productId,
				quantity: line.quantity,
				modifierOptionIds: line.modifiers.flatMap((m) => (m.optionId ? [m.optionId] : [])),
				note: line.note ?? undefined,
			})),
			discount: resolved,
			payment: { method, received: received ?? undefined },
			customerId: customer?.id,
			serviceType: serviceType ?? undefined,
			label: label.trim() || undefined,
		});
		toast.success(t("paidToast", { number: order.number }));
		return {
			order,
			method: order.paymentMethod,
			total: order.total,
			received: order.received,
			change: order.change,
			orderNumber: order.number,
		};
	};

	const newOrder = useCallback(() => {
		clear();
		setSessionKey(crypto.randomUUID());
		setCheckoutOpen(false);
		setQuery("");
		searchRef.current?.focus();
	}, [clear]);

	// Keyboard shortcuts (plan §33). Esc is handled by the dialogs themselves.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const dialogOpen = checkoutOpen || customising !== null;

			if (event.key === "/" && !isTyping(event.target)) {
				event.preventDefault();
				searchRef.current?.focus();
				return;
			}
			if (dialogOpen || isTyping(event.target)) {
				// Enter in the search box with a single match adds it — scanner-style.
				if (event.key === "Enter" && event.target === searchRef.current && products.length === 1) {
					event.preventDefault();
					select(products[0]);
					setQuery("");
				}
				return;
			}

			const { activeKey, increment, decrement } = useCartStore.getState();
			if (event.key === "Enter") {
				event.preventDefault();
				openCheckout();
			} else if ((event.key === "+" || event.key === "=") && activeKey) {
				if (increment(activeKey) === "limit") {
					const line = useCartStore.getState().lines.find((l) => l.key === activeKey);
					if (line) warnLimit(line.name, useCartStore.getState().stock[line.productId] ?? 0);
				}
			} else if (event.key === "-" && activeKey) {
				decrement(activeKey);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [checkoutOpen, customising, openCheckout, products, select, warnLimit]);

	const cart = (
		<CartPanel
			totals={totals}
			vatBasisPoints={business.vatBasisPoints}
			onCheckout={openCheckout}
			className="h-full"
		/>
	);

	return (
		// Phone: the header (4rem) and the fixed bottom nav (4rem + safe area) are both on screen,
		// and the shell's bottom padding is cancelled so the page itself never scrolls.
		<div className="-mb-24 flex h-[calc(100svh-8rem-env(safe-area-inset-bottom))] overflow-hidden tablet:mb-0 tablet:h-[calc(100svh-4rem)]">
			<section className="flex min-w-0 flex-1 flex-col">
				<div className="space-y-3 px-4 pt-4 pb-3 desktop:px-6">
					<div data-tour="pos-search">
						<SearchInput
							ref={searchRef}
							value={query}
							onChange={setQuery}
							placeholder={t("searchPlaceholder")}
							shortcut="/"
							size="lg"
						/>
					</div>
					<div data-tour="pos-categories">
						<Segmented
							variant="chips"
							size="lg"
							value={category}
							onChange={setCategory}
							options={[
								{ value: ALL, label: t("allCategories") },
								...categories.map((c) => ({ value: c.id, label: c.name })),
							]}
						/>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 tablet:pb-6 desktop:px-6">
					{productsQuery.isPending ? (
						<div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
							{Array.from({ length: 8 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<ProductCardSkeleton key={i} />
							))}
						</div>
					) : products.length === 0 ? (
						<EmptyState
							icon={PackageSearch}
							title={t("noProducts")}
							description={t("noProductsHint")}
						/>
					) : (
						<div data-tour="pos-grid" className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4 min-[1600px]:grid-cols-5">
							{products.map((product) => (
								<ProductCard
									key={product.id}
									product={product}
									onSelect={select}
									inCart={inCart.get(product.id) ?? 0}
								/>
							))}
						</div>
					)}
				</div>
			</section>

			{/* Tablet and up: the cart is always on screen, never behind a tap. */}
			<aside className="hidden w-[340px] shrink-0 py-3 pr-3 tablet:block desktop:w-[392px]">
				<div data-tour="pos-cart" className="surface h-full overflow-hidden rounded-3xl">{cart}</div>
			</aside>

			{/* Phone: a floating bar that opens the cart as a bottom sheet. */}
			<AnimatePresence>
				{lines.length > 0 ? (
					<motion.div
						initial={{ y: 80, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 80, opacity: 0 }}
						className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 tablet:hidden"
					>
						<Button
							onClick={() => setCartOpen(true)}
							className="brand-gradient h-14 w-full rounded-2xl px-4 font-semibold text-base shadow-lg"
						>
							<span className="flex size-7 items-center justify-center rounded-lg bg-white/20">
								<ShoppingBasket className="size-4" />
							</span>
							<span className="flex-1 text-left">{t("viewCart", { count: totals.itemCount })}</span>
							<span className="numeric">{formatBaht(totals.total)}</span>
						</Button>
					</motion.div>
				) : null}
			</AnimatePresence>

			<Sheet open={cartOpen} onOpenChange={setCartOpen}>
				<SheetContent side="bottom" className="h-[88svh] gap-0 rounded-t-3xl p-0">
					<SheetTitle className="sr-only">{t("currentOrder")}</SheetTitle>
					<SheetDescription className="sr-only">{t("currentOrder")}</SheetDescription>
					{cart}
				</SheetContent>
			</Sheet>

			<ModifierDialog
				product={customising}
				onOpenChange={(open) => !open && setCustomising(null)}
				onConfirm={confirmModifiers}
			/>

			<CheckoutDialog
				open={checkoutOpen}
				onOpenChange={setCheckoutOpen}
				totals={totals}
				sessionKey={sessionKey}
				promptPayId={business.promptPayId}
				onPay={pay}
				onNewOrder={newOrder}
			/>
		</div>
	);
}
