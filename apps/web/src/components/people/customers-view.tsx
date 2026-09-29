"use client";

import { type Column, ConfirmDialog, DataTable, FilterBar, Pager, SearchInput } from "@/components/common/controls";
import { FeatureLocked } from "@/components/common/feature-locked";
import { EmptyState, PageContainer, PageHeader, Surface, TableSkeleton } from "@/components/common/primitives";
import { UserAvatar } from "@/components/layout/user-menu";
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
import { useCustomerMutations, useCustomers } from "@/hooks/use-posly";
import { useFeature } from "@/hooks/use-workspace";
import { useRouter } from "@/i18n/navigation";
import type { CustomerDto } from "@/lib/api/posly";
import { formatRelative } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { MoreHorizontal, Pencil, ReceiptText, Trash2, UserPlus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

/** "0812345678" as it is read aloud: 081-234-5678. */
export const formatPhone = (phone: string | null) =>
	phone ? phone.replace(/^(\d{2,3})(\d{3})(\d{4})$/, "$1-$2-$3") : null;

/**
 * Add or edit a customer. Shared with the POS, where a cashier adds one mid-sale and the
 * new customer is attached to the order at once (`onSaved`).
 */
export function CustomerDialog({
	open,
	onOpenChange,
	editing,
	initialName = "",
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editing: CustomerDto | null;
	initialName?: string;
	onSaved?: (customer: CustomerDto) => void;
}) {
	const t = useTranslations("customers");
	const { create, update } = useCustomerMutations();
	const [name, setName] = useState(editing?.name ?? initialName);
	const [phone, setPhone] = useState(formatPhone(editing?.phone ?? null) ?? "");
	const [email, setEmail] = useState(editing?.email ?? "");
	const [note, setNote] = useState(editing?.note ?? "");
	const pending = create.isPending || update.isPending;
	const digits = phone.replace(/\D/g, "");
	const phoneOk = digits === "" || /^0\d{8,9}$/.test(digits);
	const valid = name.trim().length > 0 && phoneOk;

	const save = () => {
		const input = { name: name.trim(), phone: digits || null, email: email.trim() || null, note: note.trim() || null };
		const done = {
			onSuccess: (customer: CustomerDto) => {
				toast.success(t("saved", { name: customer.name }));
				onSaved?.(customer);
				onOpenChange(false);
			},
			onError: (e: Error) => toast.error(e.message),
		};
		if (editing) update.mutate({ customerId: editing.id, ...input }, done);
		else create.mutate(input, done);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
					<DialogDescription className="sr-only">{t("description")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !pending) save();
					}}
				>
					<div className="space-y-2.5">
						<Label htmlFor="cu-name">{t("nameLabel")}</Label>
						<Input
							id="cu-name"
							// biome-ignore lint/a11y/noAutofocus: the dialog opens for this field
							autoFocus
							value={name}
							maxLength={120}
							onChange={(e) => setName(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</div>
					<div className="grid gap-4 tablet:grid-cols-2">
						<div className="space-y-2.5">
							<Label htmlFor="cu-phone">{t("phone")}</Label>
							<Input
								maxLength={13}
								id="cu-phone"
								inputMode="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value.replace(/[^\d-\s]/g, ""))}
								placeholder="081-234-5678"
								className="numeric h-11 rounded-xl"
							/>
							{phoneOk ? null : <p className="text-danger text-xs">{t("phoneInvalid")}</p>}
						</div>
						<div className="space-y-2.5">
							<Label htmlFor="cu-email">{t("email")}</Label>
							<Input
								maxLength={255}
								id="cu-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t("optional")}
								className="h-11 rounded-xl"
							/>
						</div>
					</div>
					<div className="space-y-2.5">
						<Label htmlFor="cu-note">{t("note")}</Label>
						<Input
							id="cu-note"
							value={note}
							maxLength={300}
							onChange={(e) => setNote(e.target.value)}
							placeholder={t("notePlaceholder")}
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

/** Customers (plan §22): who buys, how often and how much — from the orders that name them. */
export function CustomersView() {
	const t = useTranslations("customers");
	const enabled = useFeature("CUSTOMERS");
	const router = useRouter();
	const [query, setQuery] = useState("");
	const search = useDeferredValue(query.trim());
	const [paging, setPaging] = useState({ key: search, page: 1 });
	const page = paging.key === search ? paging.page : 1;
	const customers = useCustomers({ search: search || undefined, page }, enabled);
	const { remove } = useCustomerMutations();
	const [dialog, setDialog] = useState<{ editing: CustomerDto | null } | null>(null);
	const [deleting, setDeleting] = useState<CustomerDto | null>(null);

	if (!enabled) return <FeatureLocked title={t("lockedTitle")} hint={t("lockedHint")} action={t("upgrade")} />;

	const rows = customers.data?.data ?? [];
	const meta = customers.data?.meta;
	const openOrders = (c: CustomerDto) => router.push(`/orders?customer=${c.id}&customerName=${encodeURIComponent(c.name)}`);

	const columns: Column<CustomerDto>[] = [
		{
			key: "name",
			header: t("name"),
			cell: (c) => (
				<span className="flex items-center gap-3">
					<UserAvatar name={c.name} className="bg-none bg-muted text-foreground" />
					<span className="min-w-0">
						<span className="block font-medium">{c.name}</span>
						<span className="numeric block truncate text-muted-foreground text-xs">
							{formatPhone(c.phone) ?? c.email ?? "—"}
						</span>
					</span>
				</span>
			),
		},
		{ key: "orders", header: t("orders"), align: "right", cell: (c) => <span className="numeric">{c.totalOrders}</span> },
		{
			key: "spending",
			header: t("spending"),
			align: "right",
			cell: (c) => <span className="numeric font-medium">{formatBaht(c.totalSpending)}</span>,
		},
		{
			key: "last",
			header: t("lastVisit"),
			className: "pl-8",
			hideBelow: "tablet",
			cell: (c) => (
				<span className="text-muted-foreground" suppressHydrationWarning>
					{c.lastVisitAt ? formatRelative(c.lastVisitAt) : t("never")}
				</span>
			),
		},
		{
			key: "actions",
			header: "",
			align: "right",
			className: "w-12",
			cell: (c) => (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label={t("actions", { name: c.name })}>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => openOrders(c)}>
							<ReceiptText />
							{t("viewOrders")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setDialog({ editing: c })}>
							<Pencil />
							{t("edit")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
							<Trash2 />
							{t("delete")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<Button
						size="lg"
						className="brand-gradient"
						data-tour="customers-add"
						onClick={() => setDialog({ editing: null })}
					>
						<UserPlus />
						{t("add")}
					</Button>
				}
			/>
			<Surface className="overflow-hidden p-0" data-tour="customers-list">
				<FilterBar search={<SearchInput tone="toolbar" value={query} onChange={setQuery} placeholder={t("search")} />} />
				{customers.isPending ? (
					<TableSkeleton />
				) : rows.length === 0 ? (
					<EmptyState
						icon={UserRound}
						title={search ? t("notFound") : t("empty")}
						description={search ? undefined : t("emptyHint")}
					/>
				) : (
					<>
						<DataTable columns={columns} rows={rows} rowKey={(c) => c.id} />
						{meta ? (
							<Pager
								page={meta.page}
								lastPage={meta.last_page}
								total={meta.total}
								disabled={customers.isFetching}
								onChange={(next) => setPaging({ key: search, page: next })}
								labels={{
									showing: t("showing", {
										from: (meta.page - 1) * meta.limit + 1,
										to: Math.min(meta.page * meta.limit, meta.total),
										total: meta.total,
									}),
									previous: t("previousPage"),
									next: t("nextPage"),
								}}
							/>
						) : null}
					</>
				)}
			</Surface>
			{dialog ? (
				<CustomerDialog
					key={dialog.editing?.id ?? "new"}
					open
					onOpenChange={(open) => !open && setDialog(null)}
					editing={dialog.editing}
				/>
			) : null}
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
