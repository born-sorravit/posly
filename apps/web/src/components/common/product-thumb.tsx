import type React from "react";
import { cn } from "@/lib/utils";
import type { ProductArt } from "@posly/types/domain";
import {
	CakeSlice,
	Cookie,
	CookingPot,
	Croissant,
	CupSoda,
	Egg,
	EggFried,
	GlassWater,
	type LucideIcon,
	Milk,
	Package,
	Popcorn,
	Salad,
	Sandwich,
	Scissors,
	Soup,
	SprayCan,
} from "lucide-react";
import Image from "next/image";

/**
 * A drink seen from above: saucer, cup, and the drink's own colour with a foam swirl.
 * Drawn rather than photographed so a new shop's menu looks finished before anyone has
 * uploaded a single photo.
 */
const DRINKS: Partial<
	Record<ProductArt, { liquid: string; foam: string | null; tile: string }>
> = {
	coffee: { liquid: "#3b2317", foam: null, tile: "#f4ece6" },
	latte: { liquid: "#b07a4f", foam: "#f3e3cf", tile: "#f6efe7" },
	matcha: { liquid: "#7fae4e", foam: "#e3f0cf", tile: "#eef5e6" },
	tea: { liquid: "#e0873a", foam: "#f8dcc0", tile: "#fbefe3" },
	chocolate: { liquid: "#5b3423", foam: "#c89a7c", tile: "#f3ebe6" },
};

const BAKES: Partial<Record<ProductArt, { icon: LucideIcon; tile: string; ink: string }>> = {
	croissant: { icon: Croissant, tile: "#fbf0dd", ink: "#c9822b" },
	cake: { icon: CakeSlice, tile: "#fdeef0", ink: "#d7607a" },
	brownie: { icon: CakeSlice, tile: "#f2ebe7", ink: "#6b3f2a" },
	cookie: { icon: Cookie, tile: "#f8eedf", ink: "#b0773c" },
	juice: { icon: CupSoda, tile: "#fff2e0", ink: "#f08c1a" },
	bottle: { icon: GlassWater, tile: "#e8f3fb", ink: "#3b8fd0" },
	// Kitchen: a plate with an egg on top is the Thai rice dish, a bowl is noodles.
	rice: { icon: EggFried, tile: "#fdf3dc", ink: "#d99a1e" },
	noodle: { icon: Soup, tile: "#fcece0", ink: "#d9702b" },
	soup: { icon: CookingPot, tile: "#fde8e4", ink: "#d8543e" },
	salad: { icon: Salad, tile: "#e9f6e4", ink: "#4f9a3a" },
	// Shop shelf.
	bread: { icon: Sandwich, tile: "#f8eedf", ink: "#b0773c" },
	snack: { icon: Popcorn, tile: "#fff1dc", ink: "#e08a1c" },
	egg: { icon: Egg, tile: "#fbf2e2", ink: "#c79a52" },
	milk: { icon: Milk, tile: "#eaf1fb", ink: "#4a7fc8" },
	household: { icon: SprayCan, tile: "#e7f5f3", ink: "#2f9488" },
	service: { icon: Scissors, tile: "#efeafb", ink: "#7a5ad6" },
	package: { icon: Package, tile: "#eef0f4", ink: "#6b7489" },
};

function DrinkArt({ liquid, foam }: { liquid: string; foam: string | null }) {
	return (
		<svg viewBox="0 0 100 100" className="size-[78%] drop-shadow-sm" aria-hidden>
			<circle cx="50" cy="52" r="44" className="drink-saucer" />
			<circle cx="50" cy="52" r="44" fill="none" stroke="#000" strokeOpacity="0.05" />
			<circle cx="50" cy="50" r="33" className="drink-cup" stroke="#000" strokeOpacity="0.06" />
			<circle cx="50" cy="50" r="27" fill={liquid} />
			{foam ? (
				<>
					<circle cx="50" cy="50" r="17" fill={foam} opacity="0.95" />
					<path
						d="M50 36c-6 5-6 10 0 14s6 9 0 14"
						fill="none"
						stroke={liquid}
						strokeWidth="3"
						strokeLinecap="round"
						opacity="0.55"
					/>
				</>
			) : (
				<ellipse cx="42" cy="42" rx="8" ry="4" fill="#fff" opacity="0.18" />
			)}
			<rect x="82" y="44" width="12" height="12" rx="6" className="drink-cup" stroke="#000" strokeOpacity="0.06" />
		</svg>
	);
}

export function ProductThumb({
	art,
	imageUrl,
	name,
	className,
	rounded = "rounded-xl",
}: {
	art: ProductArt;
	imageUrl?: string | null;
	name: string;
	className?: string;
	rounded?: string;
}) {
	if (imageUrl) {
		return (
			<div className={cn("relative overflow-hidden bg-muted", rounded, className)}>
				<Image src={imageUrl} alt={name} fill sizes="200px" className="object-cover" />
			</div>
		);
	}

	const drink = DRINKS[art];
	if (drink) {
		return (
			<div
				className={cn("product-tile flex items-center justify-center", rounded, className)}
				style={{ "--tile": drink.tile } as React.CSSProperties}
				role="img"
				aria-label={name}
			>
				<DrinkArt liquid={drink.liquid} foam={drink.foam} />
			</div>
		);
	}

	const bake = BAKES[art] ?? BAKES.cookie!;
	const Icon = bake.icon;
	return (
		<div
			className={cn("product-tile flex items-center justify-center", rounded, className)}
			style={{ "--tile": bake.tile } as React.CSSProperties}
			role="img"
			aria-label={name}
		>
			<Icon className="size-[46%]" style={{ color: bake.ink }} strokeWidth={1.6} />
		</div>
	);
}
