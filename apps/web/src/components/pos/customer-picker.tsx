"use client";

import { CustomerDialog, formatPhone } from "@/components/people/customers-view";
import { Button } from "@posly/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@posly/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { useCustomers } from "@/hooks/use-posly";
import { useFeature } from "@/hooks/use-workspace";
import { formatBaht } from "@posly/utils/money";
import { useCartStore } from "@/stores/cart-store";
import { UserRound, UserRoundPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";

/**
 * "ลูกค้า" in the cart header. Search by name or phone (the API searches, so it scales past
 * one page), pick, or add a new customer without leaving the sale. The pick rides on the
 * cart and goes out with checkout; shops without the Customers feature do not see it.
 */
export function CustomerPicker() {
	const t = useTranslations("customers");
	const enabled = useFeature("CUSTOMERS");
	const customer = useCartStore((s) => s.customer);
	const setCustomer = useCartStore((s) => s.setCustomer);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [adding, setAdding] = useState(false);
	const search = useDeferredValue(query.trim());
	const results = useCustomers({ search: search || undefined, limit: 8 }, enabled && open);

	if (!enabled) return null;

	if (customer) {
		return (
			<span className="flex h-8 max-w-44 items-center gap-1.5 rounded-md bg-primary/10 pr-1 pl-2 font-medium text-primary text-sm">
				<UserRound className="size-3.5 shrink-0" />
				<span className="truncate">{customer.name}</span>
				<button
					type="button"
					onClick={() => setCustomer(null)}
					aria-label={t("remove")}
					className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-primary/15"
				>
					<X className="size-3.5" />
				</button>
			</span>
		);
	}

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="ghost" size="sm" className="text-muted-foreground">
						<UserRoundPlus />
						{t("pick")}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-80 p-0">
					{/* The API filters; cmdk only handles the keyboard. */}
					<Command shouldFilter={false}>
						<CommandInput placeholder={t("pickSearch")} value={query} onValueChange={setQuery} />
						<CommandList className="max-h-72">
							{results.isFetching && !results.data ? null : <CommandEmpty>{t("pickNone")}</CommandEmpty>}
							<CommandGroup>
								{(results.data?.data ?? []).map((c) => (
									<CommandItem
										key={c.id}
										value={c.id}
										onSelect={() => {
											setCustomer({ id: c.id, name: c.name });
											setOpen(false);
											setQuery("");
										}}
										className="gap-3 py-2"
									>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium">{c.name}</span>
											<span className="numeric block truncate text-muted-foreground text-xs">
												{formatPhone(c.phone) ?? c.email ?? "—"}
											</span>
										</span>
										<span className="numeric shrink-0 text-muted-foreground text-xs">
											{c.totalOrders > 0 ? formatBaht(c.totalSpending) : null}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
						<div className="border-border/60 border-t p-1">
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									setAdding(true);
								}}
								className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-primary text-sm hover:bg-muted"
							>
								<UserRoundPlus className="size-4" />
								{query.trim() ? t("pickAdd", { name: query.trim() }) : t("pickAddBlank")}
							</button>
						</div>
					</Command>
				</PopoverContent>
			</Popover>
			{adding ? (
				<CustomerDialog
					open
					onOpenChange={(o) => !o && setAdding(false)}
					editing={null}
					// A typed phone number is more likely than a name at a counter.
					initialName={/\d{3,}/.test(query) ? "" : query.trim()}
					onSaved={(c) => {
						setCustomer({ id: c.id, name: c.name });
						setQuery("");
					}}
				/>
			) : null}
		</>
	);
}
