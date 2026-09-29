import { GoBackButton } from "@/components/common/go-back-button";
import { Brand } from "@/components/layout/brand";
import { Button } from "@posly/ui/components/button";
import { Link } from "@/i18n/navigation";
import { House } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("errors");
	return { title: t("notFound") };
}

/**
 * The 404 for any unknown URL (via `[...rest]`) and any `notFound()` outside the app shell.
 * Full page, no sidebar: a mistyped link is not a place in the shop.
 */
export default async function NotFound() {
	const t = await getTranslations("errors");
	return (
		<div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
			{/* A faint dot grid that fades from the centre, under a soft brand glow. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage: "radial-gradient(color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)",
					backgroundSize: "20px 20px",
					maskImage: "radial-gradient(ellipse 50% 45% at 50% 45%, black, transparent 75%)",
				}}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"radial-gradient(ellipse 55% 45% at 50% 40%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)",
				}}
			/>
			<div className="relative flex max-w-md flex-col items-center text-center">
				<Brand />
				<p
					aria-hidden
					className="numeric mt-10 select-none bg-linear-to-b from-foreground to-foreground/15 bg-clip-text font-bold text-[7.5rem] text-transparent leading-none tracking-tighter tablet:text-[9rem]"
				>
					404
				</p>
				<h1 className="mt-4 font-semibold text-2xl tracking-tight">{t("notFound")}</h1>
				<p className="mt-2 text-muted-foreground">{t("notFoundHint")}</p>
				<div className="mt-8 flex flex-col-reverse gap-2 tablet:flex-row">
					<GoBackButton>{t("back")}</GoBackButton>
					<Button asChild size="lg" className="brand-gradient">
						<Link href="/dashboard">
							<House />
							{t("home")}
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
