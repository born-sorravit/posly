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
	size = "md",
	onNavigate,
}: {
	collapsed?: boolean;
	/** "lg" is the standalone lockup over a centred card (sign-in, 404). */
	size?: "md" | "lg";
	onNavigate?: () => void;
}) {
	const lg = size === "lg";
	return (
		<Link
			href="/dashboard"
			onClick={onNavigate}
			className={cn(
				"flex min-w-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
				lg ? "gap-3" : "gap-2.5"
			)}
		>
			<BrandMark className={lg ? "size-11" : undefined} />
			{collapsed ? null : (
				<span
					className={cn(
						"truncate tracking-tight",
						// leading-none so the glyphs, not Anuphan's tall line box, set the centre.
						lg ? "font-bold text-[1.75rem] leading-none" : "font-semibold text-lg"
					)}
				>
					Posly
				</span>
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
