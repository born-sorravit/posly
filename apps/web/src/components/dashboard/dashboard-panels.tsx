"use client";

import { PAYMENT_ICON } from "@/components/common/order-badges";
import { EmptyState, IconChip, SectionTitle, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Link } from "@/i18n/navigation";
import { formatBaht } from "@posly/utils/money";
import { formatNumber } from "@posly/utils/format";
import type { DashboardDto } from "@/lib/api/posly";
import { cn } from "@/lib/utils";
import { ArrowRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

function SeeAll({ href }: { href: string }) {
	const t = useTranslations("common");
	return (
		<Link
			href={href}
			className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
		>
			{t("seeAll")}
			<ArrowRight className="size-3.5" />
		</Link>
	);
}

export function TopProducts({
	className,
	limit = 5,
	rows,
}: {
	className?: string;
	limit?: number;
	rows: DashboardDto["topProducts"];
}) {
	const t = useTranslations("dashboard");
	return (
		<Surface className={className}>
			<SectionTitle action={<SeeAll href="/reports" />}>{t("topProducts")}</SectionTitle>
			{rows.length === 0 ? (
				<EmptyState icon={PackageCheck} title={t("noSales")} description={t("noSalesHint")} className="py-8" />
			) : null}
			<ol className="grid gap-1">
				{rows.slice(0, limit).map((p, i) => (
					<li key={p.name} className="flex items-center gap-3 rounded-xl py-1.5">
						<span className="numeric w-4 text-center font-medium text-muted-foreground text-sm">
							{i + 1}
						</span>
						<ProductThumb art={p.art} name={p.name} className="size-9" rounded="rounded-lg" />
						<span className="min-w-0 flex-1 truncate font-medium text-sm">{p.name}</span>
						<span className="numeric w-16 text-right text-muted-foreground text-sm">
							{formatNumber(p.sold)} {t("soldUnit")}
						</span>
						<span className="numeric w-20 text-right font-medium text-sm">
							{formatBaht(p.revenue)}
						</span>
					</li>
				))}
			</ol>
		</Surface>
	);
}

/** Categorical slots in fixed order, validated for colour-vision deficiency. */
const SLOT = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

/**
 * A donut is acceptable here only because there are three parts and every one is also
 * labelled with its share and amount in the legend beside it — colour is never the only key.
 */
export function PaymentBreakdown({
	className,
	breakdown,
}: {
	className?: string;
	breakdown: DashboardDto["paymentBreakdown"];
}) {
	const t = useTranslations("dashboard");
	const tMethod = useTranslations("paymentMethod");
	const total = breakdown.reduce((sum, p) => sum + p.amount, 0);
	const rows = breakdown.map((p, i) => ({
		...p,
		share: p.amount / total,
		color: SLOT[i],
		label: tMethod(p.method),
	}));

	return (
		<Surface className={className}>
			<SectionTitle>{t("paymentBreakdown")}</SectionTitle>
			{rows.length === 0 ? (
				<EmptyState icon={PackageCheck} title={t("noSales")} className="py-8" />
			) : (
			<div className="flex flex-col items-center gap-5 tablet:flex-row">
				<div className="relative size-36 shrink-0">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={rows}
								dataKey="amount"
								nameKey="label"
								innerRadius="68%"
								outerRadius="100%"
								paddingAngle={2}
								cornerRadius={4}
								stroke="var(--card)"
								strokeWidth={2}
								startAngle={90}
								endAngle={-270}
								animationDuration={400}
							>
								{rows.map((row) => (
									<Cell key={row.method} fill={row.color} />
								))}
							</Pie>
							<Tooltip
								formatter={(value) => formatBaht(Number(value))}
								contentStyle={{
									borderRadius: 12,
									border: "none",
									background: "var(--popover)",
									boxShadow: "var(--shadow-lg)",
									fontSize: 12,
								}}
							/>
						</PieChart>
					</ResponsiveContainer>
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
						<span className="numeric font-semibold text-lg leading-none">
							{Math.round(rows[0].share * 100)}%
						</span>
						<span className="text-[11px] text-muted-foreground">{rows[0].label}</span>
					</div>
				</div>

				<ul className="grid w-full gap-2.5">
					{rows.map((row) => {
						const Icon = PAYMENT_ICON[row.method];
						return (
							<li key={row.method} className="flex items-center gap-2.5 text-sm">
								<span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
								<Icon className="size-4 text-muted-foreground" />
								<span className="flex-1 truncate">{row.label}</span>
								<span className="numeric w-10 text-right text-muted-foreground">
									{Math.round(row.share * 100)}%
								</span>
								<span className="numeric w-20 text-right font-medium">{formatBaht(row.amount)}</span>
							</li>
						);
					})}
				</ul>
			</div>
			)}
		</Surface>
	);
}

export function StockAlerts({
	className,
	alerts,
}: {
	className?: string;
	alerts: DashboardDto["lowStock"];
}) {
	const t = useTranslations("dashboard");
	return (
		<Surface className={className}>
			<SectionTitle action={<SeeAll href="/inventory" />}>{t("alerts")}</SectionTitle>
			{alerts.length === 0 ? (
				<EmptyState
					icon={PackageCheck}
					title={t("noAlerts")}
					className="py-6"
				/>
			) : (
				<ul className="grid gap-2">
					{alerts.map((alert) => (
						<li
							key={alert.id}
							className="flex items-center gap-3 rounded-xl bg-muted/60 p-3"
						>
							<IconChip
								icon={alert.tone === "danger" ? PackageX : TriangleAlert}
								tone={alert.tone}
								className="size-9 rounded-lg"
							/>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{alert.name}</p>
								<p className={cn("text-xs", alert.tone === "danger" ? "text-danger" : "text-muted-foreground")}>
									{t("remaining", { count: alert.stock, unit: alert.unit })}
								</p>
							</div>
							<span className="text-muted-foreground text-xs">{t("lowStock")}</span>
						</li>
					))}
				</ul>
			)}
		</Surface>
	);
}
