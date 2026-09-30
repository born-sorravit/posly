"use client";

import { visibleSections } from "@/components/layout/nav-items";
import { useActiveBusiness } from "@/hooks/use-workspace";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@posly/ui/components/command";
import { useRouter } from "@/i18n/navigation";
import { useProducts } from "@/hooks/use-posly";
import { formatBaht } from "@posly/utils/money";
import { ChartLine, CircleHelp, Package, PackagePlus, ReceiptText, ShoppingCart } from "lucide-react";
import { useTourStore } from "@/stores/tour-store";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { create } from "zustand";

/** Open state is shared so the header's search button and ⌘K drive the same dialog. */
export const useCommandMenu = create<{ open: boolean; setOpen: (open: boolean) => void }>(
	(set) => ({ open: false, setOpen: (open) => set({ open }) })
);

/**
 * ⌘K / Ctrl+K from anywhere (plan §34): pages, actions, products, orders, customers.
 *
 * Products come from the POS menu cache (already loaded, so search is instant). An order
 * number jumps to the orders list filtered to it.
 */
export function CommandMenu() {
	const t = useTranslations("command");
	const tNav = useTranslations("nav");
	const router = useRouter();
	const { open, setOpen } = useCommandMenu();
	const [query, setQuery] = useState("");
	// Only while the menu is open: mounted on every screen, an always-on query made each sale's
	// "orders" event re-download the whole menu on the kitchen board, the reports, everywhere.
	const products = useProducts(open);
	const { can } = useActiveBusiness();
	const orderNumber = /^#?\d{1,6}$/.test(query.trim()) ? query.trim().replace("#", "") : null;

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			// `key` is undefined on the synthetic keydown Chrome fires for password-manager and
			// form autofill, so it cannot be assumed to be a string.
			if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setOpen(!useCommandMenu.getState().open);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setOpen]);

	const startTour = useTourStore((s) => s.start);

	const go = (href: string) => {
		setOpen(false);
		setQuery("");
		router.push(href);
	};

	// Records only appear once something is typed: an unfiltered list of every order is noise.
	const searching = query.trim().length > 0;

	return (
		<CommandDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("hint")}>
			{/* CommandDialog is only the dialog; cmdk's store lives in <Command>, which every
			    input, list and item below reads from. */}
			<Command>
			<CommandInput placeholder={t("placeholder")} value={query} onValueChange={setQuery} />
			<CommandList>
				<CommandEmpty>{t("empty")}</CommandEmpty>

				<CommandGroup heading={t("actions")}>
					<CommandItem onSelect={() => go("/pos")}>
						<ShoppingCart />
						{t("openPos")}
						<CommandShortcut>POS</CommandShortcut>
					</CommandItem>
					<CommandItem
						onSelect={() => {
							setOpen(false);
							startTour("app");
						}}
					>
						<CircleHelp />
						{t("tour")}
					</CommandItem>
					{can("products:write") ? (
					<CommandItem onSelect={() => go("/products/new")}>
						<PackagePlus />
						{t("addProduct")}
					</CommandItem>
					) : null}
					{can("reports:read") ? (
					<CommandItem onSelect={() => go("/reports")}>
						<ChartLine />
						{t("todaySales")}
					</CommandItem>
					) : null}
				</CommandGroup>

				<CommandSeparator />
				<CommandGroup heading={t("pages")}>
					{visibleSections(can).flatMap((section) => section.items).map(({ key, href, icon: Icon }) => (
						<CommandItem key={key} value={`${tNav(key)} ${key}`} onSelect={() => go(href)}>
							<Icon />
							{tNav(key)}
						</CommandItem>
					))}
				</CommandGroup>

				{searching ? (
					<>
						<CommandSeparator />
						<CommandGroup heading={t("products")}>
							{(products.data ?? []).map((product) => (
								<CommandItem
									key={product.id}
									value={`${product.name} ${product.sku ?? ""}`}
									onSelect={() => go(`/products/${product.id}`)}
								>
									<Package />
									<span className="flex-1">{product.name}</span>
									<span className="numeric text-muted-foreground text-xs">
										{formatBaht(product.price)}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
						{orderNumber ? (
							<CommandGroup heading={t("orders")}>
								<CommandItem value={query} onSelect={() => go(`/orders?search=${orderNumber}`)}>
									<ReceiptText />
									{t("findOrder", { number: orderNumber.padStart(6, "0") })}
								</CommandItem>
							</CommandGroup>
						) : null}
					</>
				) : null}
			</CommandList>
			</Command>
		</CommandDialog>
	);
}
