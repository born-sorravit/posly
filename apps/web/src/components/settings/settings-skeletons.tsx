import { TextSkeleton, range } from "@/components/common/skeleton-text";
import { cn } from "@/lib/utils";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for each settings panel, drawn inside `SettingsLayout` (its title and rail
 * stay rendered). One per subpage, because the panels differ: a form, a form beside a preview,
 * a list of switches, a row of plan cards. Server-safe.
 */

/** `SectionTitle` inside a panel. */
function TitleSkeleton({ className }: { className?: string }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-3">
			<TextSkeleton box="h-6" bar="h-4" className={className} />
		</div>
	);
}

/** `Field`: a 14px label, the 44px input (or a textarea), and an optional hint line. */
function FieldSkeleton({
	label = "w-24",
	hint,
	input = "h-11 w-full",
}: {
	label?: string;
	/** Width class of the hint line, when the field has one. */
	hint?: string;
	input?: string;
}) {
	return (
		<div className="space-y-1.5">
			<Skeleton className={cn("h-3.5", label)} />
			<Skeleton className={cn("rounded-xl", input)} />
			{hint ? <TextSkeleton box="h-4" bar="h-3" className={hint} /> : null}
		</div>
	);
}

/** A `Switch` (32 × 18px). */
function SwitchSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn("h-[18.4px] w-8 shrink-0 rounded-full", className)} />;
}

/** `SaveBar`: full width and 44px on a phone, a 36px button on the right from tablet up. */
function SaveBarSkeleton() {
	return (
		<div className="flex justify-end" aria-hidden>
			<Skeleton className="h-11 w-full min-w-28 rounded-lg tablet:h-9 tablet:w-28" />
		</div>
	);
}

/** General: logo and upload button, name and phone, address, then currency and timezone. */
export function GeneralSettingsSkeleton() {
	return (
		<>
			<div className="surface space-y-5 rounded-2xl p-5" aria-hidden>
				<TitleSkeleton className="w-28" />
				<div className="flex items-center gap-4">
					<Skeleton className="size-16 shrink-0 rounded-2xl" />
					<div className="space-y-1">
						<Skeleton className="h-8 w-32 rounded-lg" />
						<TextSkeleton box="h-4" bar="h-3" className="w-44" />
					</div>
				</div>
				<div className="grid gap-4 tablet:grid-cols-2">
					<FieldSkeleton label="w-20" />
					<FieldSkeleton label="w-24" />
				</div>
				<FieldSkeleton label="w-16" input="h-20 w-full" />
				<div className="grid gap-4 tablet:grid-cols-2">
					<FieldSkeleton label="w-14" hint="w-48" />
					<FieldSkeleton label="w-20" />
				</div>
			</div>
			<SaveBarSkeleton />
		</>
	);
}

/** Payment: the PromptPay field with its hint and the manual-confirm badge. */
export function PaymentSettingsSkeleton() {
	return (
		<>
			<div className="surface space-y-4 rounded-2xl p-5" aria-hidden>
				<TitleSkeleton className="w-24" />
				<FieldSkeleton label="w-32" hint="w-64 max-w-full" />
				<Skeleton className="h-6 w-44 rounded-lg" />
			</div>
			<SaveBarSkeleton />
		</>
	);
}

/**
 * Tax: the VAT panel (switch row, rate, the two pricing modes), the tax id panel and save; the
 * worked example beside them from desktop up. Drawn with VAT on, as most shops that open this
 * page have it.
 */
export function TaxSettingsSkeleton() {
	return (
		<div className="grid gap-4 desktop:grid-cols-[1fr_300px]" aria-hidden>
			<div className="space-y-4">
				<div className="surface space-y-5 rounded-2xl p-5">
					<TitleSkeleton className="w-16" />
					<div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
						<div className="min-w-0">
							<TextSkeleton className="w-36 bg-foreground/10" />
							<TextSkeleton box="h-4" bar="h-3" className="w-56 max-w-full bg-foreground/10" />
						</div>
						<SwitchSkeleton className="bg-foreground/10" />
					</div>
					<div className="max-w-40">
						<FieldSkeleton label="w-16" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-3.5 w-28" />
						{range(2).map((i) => (
							<div key={i} className="flex items-start gap-3 rounded-xl border p-3.5">
								<Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
								<div className="min-w-0 flex-1">
									<TextSkeleton className={i === 0 ? "w-32" : "w-28"} />
									<TextSkeleton box="h-4" bar="h-3" className={i === 0 ? "w-64 max-w-full" : "w-56 max-w-full"} />
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="surface space-y-4 rounded-2xl p-5">
					<TitleSkeleton className="w-40" />
					<FieldSkeleton label="w-28" input="h-11 w-full max-w-72" hint="w-60 max-w-full" />
				</div>
				<div className="flex justify-end">
					<Skeleton className="h-11 w-full min-w-28 rounded-lg tablet:h-9 tablet:w-28" />
				</div>
			</div>
			<div className="desktop:self-start">
				<TextSkeleton box="mb-2 h-5" className="w-24" />
				<div className="surface space-y-2.5 rounded-2xl p-5">
					{range(2).map((i) => (
						<div key={i} className="flex h-5 items-center justify-between">
							<Skeleton className={cn("h-3.5", i === 0 ? "w-20" : "w-28")} />
							<Skeleton className="h-3.5 w-14" />
						</div>
					))}
					<div className="border-t border-dashed" />
					<div className="flex h-5 items-center justify-between">
						<Skeleton className="h-3.5 w-16" />
						<Skeleton className="h-3.5 w-16" />
					</div>
					<TextSkeleton box="h-5 pt-1" bar="h-3" className="w-48" />
				</div>
				<TextSkeleton box="mt-3 h-4" bar="h-3" className="w-44" />
			</div>
		</div>
	);
}

/** Receipt: two switch rows and the footer text, then the paper preview beside it from desktop up. */
export function ReceiptSettingsSkeleton() {
	/** The preview is white paper in both themes, so its bars are a paper grey. */
	const ink = "bg-[#e2e8f0]";
	const rule = <div className="my-3 border-[#cbd5e1] border-t border-dashed" />;
	return (
		<div className="grid gap-4 desktop:grid-cols-[1fr_320px]" aria-hidden>
			<div className="space-y-4">
				<div className="surface space-y-4 rounded-2xl p-5">
					<TitleSkeleton className="w-28" />
					{range(2).map((i) => (
						<div key={i} className="flex items-center justify-between gap-4">
							<Skeleton className={cn("h-3.5", i === 0 ? "w-32" : "w-40")} />
							<SwitchSkeleton />
						</div>
					))}
					<FieldSkeleton label="w-24" input="h-20 w-full" hint="w-56 max-w-full" />
				</div>
				<SaveBarSkeleton />
			</div>
			<div className="desktop:self-start">
				<TextSkeleton box="mb-2 h-5" className="w-24" />
				<div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5">
					<div className="flex flex-col items-center gap-1">
						<TextSkeleton className={cn("w-28", ink)} />
						<TextSkeleton box="h-4" bar="h-3" className={cn("w-44", ink)} />
						<TextSkeleton box="h-4" bar="h-3" className={cn("w-24", ink)} />
					</div>
					{rule}
					<TextSkeleton box="h-4" bar="h-3" className={cn("w-24", ink)} />
					<TextSkeleton box="h-4" bar="h-3" className={cn("w-36", ink)} />
					{rule}
					{range(2).map((i) => (
						<div key={i} className="flex h-4 items-center justify-between">
							<Skeleton className={cn("h-3", i === 0 ? "w-20" : "w-12", ink)} />
							<Skeleton className={cn("h-3 w-10", ink)} />
						</div>
					))}
					{rule}
					<div className="flex h-5 items-center justify-between">
						<Skeleton className={cn("h-3.5 w-10", ink)} />
						<Skeleton className={cn("h-3.5 w-16", ink)} />
					</div>
					<TextSkeleton box="mt-1 h-4" bar="h-3" className={cn("w-16", ink)} />
					<div className="mt-4 flex justify-center">
						<TextSkeleton box="h-4" bar="h-3" className={cn("w-32", ink)} />
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The notification switches: one bordered list, a row per kind — icon, title and hint, switch.
 * Eight rows, what an owner is offered.
 */
export function NotificationRowsSkeleton({ rows = 8 }: { rows?: number }) {
	return (
		<div className="divide-y rounded-xl border" aria-hidden>
			{range(rows).map((i) => (
				<div key={i} className="flex items-center gap-3 px-4 py-3.5">
					<Skeleton className="size-9 shrink-0 rounded-lg" />
					<div className="min-w-0 flex-1">
						<TextSkeleton style={{ width: `${[34, 42, 28, 38, 46, 32, 40, 30][i % 8]}%` }} />
						<TextSkeleton box="h-4" bar="h-3" style={{ width: `${[62, 54, 70, 58, 48, 66, 56, 60][i % 8]}%` }} />
					</div>
					<SwitchSkeleton />
				</div>
			))}
		</div>
	);
}

/** Notifications: heading and hint, the switch list, then the note about LINE. */
export function NotificationSettingsSkeleton() {
	return (
		<div className="surface space-y-4 rounded-2xl p-5" aria-hidden>
			<div>
				<TitleSkeleton className="w-36" />
				<TextSkeleton box="-mt-2 h-5" className="w-80 max-w-full" />
			</div>
			<NotificationRowsSkeleton />
			<TextSkeleton box="h-4" bar="h-3" className="w-56" />
		</div>
	);
}

/** One plan card: name (and badge), price, the highlights, then the button pinned to the bottom. */
function PlanCardSkeleton({ highlights, badge = false }: { highlights: number; badge?: boolean }) {
	return (
		<div className="surface flex flex-col gap-4 rounded-2xl p-5" aria-hidden>
			<div className="flex h-[1.6rem] items-center justify-between">
				<Skeleton className="h-4 w-20" />
				{badge ? <Skeleton className="h-6 w-16 rounded-lg" /> : null}
			</div>
			<div className="flex h-10 items-end gap-1.5 pb-0.5">
				<Skeleton className="h-8 w-24" />
				<Skeleton className="mb-1 h-3.5 w-12" />
			</div>
			<div className="flex-1 space-y-2">
				{range(highlights).map((i) => (
					<div key={i} className="flex gap-2">
						<Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
						<TextSkeleton box="h-5 flex-1" style={{ width: `${[78, 64, 86, 58, 72, 68][i % 6]}%` }} />
					</div>
				))}
			</div>
			<Skeleton className="h-9 w-full rounded-lg" />
		</div>
	);
}

/** The four plan cards, to sit inside the page's plan grid while the plan list loads. */
export function PlanCardsSkeleton() {
	return (
		<>
			{[4, 5, 6, 6].map((highlights, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cards; counts repeat
				<PlanCardSkeleton key={i} highlights={highlights} badge={i === 2} />
			))}
		</>
	);
}

/** Subscription: the current plan with its three usage meters, the plan cards, then the note. */
export function SubscriptionSettingsSkeleton() {
	return (
		<>
			<div className="surface space-y-5 rounded-2xl p-5" aria-hidden>
				<div>
					<TextSkeleton className="w-24" />
					<div className="mt-0.5 flex h-7 items-center gap-2">
						<Skeleton className="h-5 w-20" />
						<Skeleton className="h-6 w-16 rounded-lg" />
					</div>
					<TextSkeleton className="w-44" />
				</div>
				<div className="grid gap-4 tablet:grid-cols-3">
					{range(3).map((i) => (
						<div key={i} className="space-y-1.5">
							<div className="flex h-5 items-center justify-between gap-3">
								<Skeleton className="h-3.5 w-24" />
								<Skeleton className="h-3.5 w-14" />
							</div>
							<Skeleton className="h-1.5 rounded-full" />
						</div>
					))}
				</div>
			</div>
			<div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
				<PlanCardsSkeleton />
			</div>
			<TextSkeleton box="h-4" bar="h-3" className="w-72 max-w-full" />
		</>
	);
}

/**
 * The settings index: on a phone it is the section list (seven 56px rows); from tablet up the
 * rail is beside it and the page shows General.
 */
export function SettingsIndexSkeleton() {
	return (
		<>
			<div className="grid gap-1 tablet:hidden" aria-hidden>
				{[56, 72, 64, 40, 60, 76, 52].map((w, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows; widths repeat
					<div key={i} className="flex h-14 items-center gap-3 rounded-xl bg-card px-3 shadow-xs">
						<Skeleton className="size-[18px] shrink-0 rounded-md" />
						<span className="flex-1">
							<Skeleton className="h-3.5" style={{ width: w }} />
						</span>
						<Skeleton className="size-4 shrink-0 rounded" />
					</div>
				))}
			</div>
			<div className="hidden space-y-4 tablet:block">
				<GeneralSettingsSkeleton />
			</div>
		</>
	);
}
