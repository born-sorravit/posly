import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { nameInitial } from "@posly/utils/format";
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
	size = "md",
	href = "/dashboard",
	onNavigate,
}: {
	collapsed?: boolean;
	/**
	 * "lg" is the mark alone, large, over a centred card (sign-in, 404): the name is already
	 * in the footer and the tab, and a lone app icon reads cleaner than a lockup there.
	 */
	size?: "md" | "lg";
	/** Inside the app the logo goes to the dashboard; on public pages, home. */
	href?: "/" | "/dashboard";
	onNavigate?: () => void;
}) {
	if (size === "lg") {
		return (
			<Link
				href={href}
				onClick={onNavigate}
				aria-label="Posly"
				className="rounded-[25%] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
			>
				<BrandMark className="size-12" />
			</Link>
		);
	}
	return (
		<Link
			href={href}
			onClick={onNavigate}
			aria-label={collapsed ? "Posly" : undefined}
			className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<BrandMark />
			{collapsed ? null : <span className="truncate font-semibold text-lg tracking-tight">Posly</span>}
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
			{nameInitial(name)}
		</span>
	);
}
