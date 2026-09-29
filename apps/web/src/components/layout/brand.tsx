import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

/** The Posly mark: the app icon, so the sidebar, the tab and the home screen all match. */
export function BrandMark({ className }: { className?: string }) {
	return (
		<span className={cn("relative block size-9 shrink-0 overflow-hidden rounded-[25%]", className)}>
			<Image src="/icons/mark-96.png" alt="" fill sizes="96px" className="object-cover" priority />
		</span>
	);
}

export function Brand({
	collapsed = false,
	onNavigate,
}: {
	collapsed?: boolean;
	onNavigate?: () => void;
}) {
	return (
		<Link
			href="/dashboard"
			onClick={onNavigate}
			className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<BrandMark />
			{collapsed ? null : (
				<span className="truncate font-semibold text-lg tracking-tight">Posly</span>
			)}
		</Link>
	);
}

/**
 * A shop's avatar: its logo from the storage bucket when uploaded, otherwise its initial on a
 * soft tint.
 */
export function StoreAvatar({
	name,
	logoUrl,
	className,
}: {
	name: string;
	logoUrl?: string | null;
	className?: string;
}) {
	if (logoUrl) {
		return (
			<Image
				src={logoUrl}
				alt=""
				width={36}
				height={36}
				className={cn("size-9 shrink-0 rounded-xl object-cover", className)}
			/>
		);
	}
	return (
		<span
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-semibold text-amber-800 text-sm dark:bg-amber-400/15 dark:text-amber-300",
				className
			)}
			aria-hidden
		>
			{name.trim().charAt(0).toUpperCase()}
		</span>
	);
}
