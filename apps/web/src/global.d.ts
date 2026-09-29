import type messages from "../messages/th.json";
import type { routing } from "@/i18n/routing";

/** Types every `t("…")` key against the Thai messages, so a typo fails `tsc`, not the page. */
declare module "next-intl" {
	interface AppConfig {
		Locale: (typeof routing.locales)[number];
		Messages: typeof messages;
	}
}
