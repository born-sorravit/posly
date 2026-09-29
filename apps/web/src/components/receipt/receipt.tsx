import { useOrderTag } from "@/components/pos/order-tag";
import type { OrderDto } from "@/lib/api/posly";
import { formatClock, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import type { Business } from "@posly/types/domain";
import { useTranslations } from "next-intl";

const Divider = () => <div className="my-2 border-black/40 border-t border-dashed" />;

function Row({
	label,
	value,
	strong = false,
}: {
	label: React.ReactNode;
	value: React.ReactNode;
	strong?: boolean;
}) {
	return (
		<div className={cn("flex justify-between gap-3", strong && "font-bold text-[15px]")}>
			<span>{label}</span>
			<span className="numeric shrink-0">{value}</span>
		</div>
	);
}

/**
 * A till receipt, laid out for an 80 mm thermal roll (≈ 72 mm printable) and legible on
 * screen too. Pure markup from the server's order — the same numbers the API stored, never
 * the cart's.
 *
 * Black on white only: thermal printers have no greys, and anything lighter than black
 * either vanishes or dithers into noise.
 */
export function Receipt({
	business,
	order,
	className,
}: {
	business: Pick<
		Business,
		"name" | "address" | "phone" | "taxId" | "vatBasisPoints" | "logoUrl" | "receiptFooter" | "receiptShowLogo" | "receiptShowTaxId"
	>;
	order: OrderDto;
	className?: string;
}) {
	const t = useTranslations("receipt");
	const tagOf = useOrderTag();
	const tMethod = useTranslations("paymentMethod");
	const tStatus = useTranslations("orderStatus");
	const reversed = order.status !== "PAID";

	return (
		<div
			className={cn(
				"w-[72mm] bg-white px-1 font-sans text-[12px] text-black leading-snug [print-color-adjust:exact]",
				className
			)}
		>
			<div className="space-y-0.5 text-center">
				{business.receiptShowLogo && business.logoUrl ? (
					// Greyscale and high contrast: a thermal head prints black or nothing. A plain <img>:
					// it goes to paper, where next/image's responsive sizes buy nothing.
					// eslint-disable-next-line @next/next/no-img-element
					<img src={business.logoUrl} alt="" className="mx-auto mb-1 size-14 object-contain contrast-150 grayscale" />
				) : null}
				<p className="font-bold text-[16px]">{business.name}</p>
				{business.address ? <p>{business.address}</p> : null}
				{business.phone ? <p>{t("phone", { phone: business.phone })}</p> : null}
				{business.receiptShowTaxId && business.taxId ? <p>{t("taxId", { taxId: business.taxId })}</p> : null}
				{/* A tax invoice needs the seller's tax id on it, so it is only titled one when shown. */}
				{business.vatBasisPoints > 0 && business.receiptShowTaxId && business.taxId ? (
					<p className="pt-1 font-semibold">{t("taxInvoice")}</p>
				) : null}
			</div>

			<Divider />

			<Row label={t("order")} value={`#${order.number}`} />
			{tagOf(order) ? <Row label={t("tag")} value={tagOf(order)} /> : null}
			{order.customerName ? <Row label={t("customer")} value={order.customerName} /> : null}
			<Row
				label={t("date")}
				value={`${formatThaiDate(order.createdAt)} ${formatClock(order.createdAt)}`}
			/>
			<Row label={t("cashier")} value={order.employeeName} />
			{reversed ? (
				<p className="mt-1 border border-black py-0.5 text-center font-bold">
					{tStatus(order.status)}
				</p>
			) : null}

			<Divider />

			<ul className="space-y-1.5">
				{order.items.map((item) => (
					<li key={item.id}>
						<div className="flex justify-between gap-3">
							<span className="min-w-0">
								{item.name}
								{item.quantity > 1 ? (
									<span className="numeric"> ×{item.quantity}</span>
								) : null}
							</span>
							<span className="numeric shrink-0">{formatBaht(item.lineTotal)}</span>
						</div>
						{item.modifiers.length > 0 || item.note ? (
							<p className="pl-2 text-[11px]">
								{[
									...item.modifiers.map((m) =>
										m.priceDelta > 0 ? `${m.optionName} +${formatBaht(m.priceDelta)}` : m.optionName
									),
									item.note ? `“${item.note}”` : null,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						) : null}
						{item.quantity > 1 ? (
							<p className="numeric pl-2 text-[11px]">
								{item.quantity} × {formatBaht(item.unitPrice)}
							</p>
						) : null}
					</li>
				))}
			</ul>

			<Divider />

			<div className="space-y-0.5">
				<Row label={t("subtotal")} value={formatBaht(order.subtotal)} />
				{order.discount > 0 ? <Row label={t("discount")} value={formatBaht(-order.discount)} /> : null}
				{order.vat > 0 ? (
					<Row label={t("vat", { rate: business.vatBasisPoints / 100 })} value={formatBaht(order.vat)} />
				) : null}
				<div className="pt-1">
					<Row strong label={t("total")} value={formatBaht(order.total)} />
				</div>
			</div>

			<Divider />

			<div className="space-y-0.5">
				<Row label={t("paidBy")} value={tMethod(order.paymentMethod)} />
				{order.received !== null ? <Row label={t("received")} value={formatBaht(order.received)} /> : null}
				{order.change !== null && order.change > 0 ? (
					<Row label={t("change")} value={formatBaht(order.change)} />
				) : null}
			</div>

			<Divider />

			<div className="space-y-0.5 pt-1 text-center">
				<p className="whitespace-pre-line font-semibold">{business.receiptFooter ?? t("thanks")}</p>
				<p className="text-[10px]">Powered by Posly</p>
			</div>
		</div>
	);
}
