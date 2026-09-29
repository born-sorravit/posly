import { EmptyState, PageContainer } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";

/**
 * A page whose feature is not in the shop's plan: says what it is and where to upgrade,
 * instead of rendering a table the API will answer with 403.
 */
export function FeatureLocked({ title, hint, action }: { title: string; hint: string; action: string }) {
	return (
		<PageContainer>
			<EmptyState
				icon={Lock}
				title={title}
				description={hint}
				action={
					<Button asChild size="lg" className="brand-gradient">
						<Link href="/settings/subscription">{action}</Link>
					</Button>
				}
			/>
		</PageContainer>
	);
}
