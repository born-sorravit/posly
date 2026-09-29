import { Button } from "@posly/ui/components/button";
import { formatBaht } from "@posly/utils/money";

/** Placeholder for the platform admin (every shop, plans, billing) — not built yet. */
export default function AdminHome() {
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
			<h1 className="text-2xl font-semibold">Posly Admin</h1>
			<p className="text-muted-foreground">
				Platform admin dashboard — coming soon. Sample amount: {formatBaht(123_450)}
			</p>
			<div>
				<Button>@posly/ui is wired up</Button>
			</div>
		</main>
	);
}
