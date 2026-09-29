import { GeneralSettings, SettingsNav } from "@/components/settings/settings-views";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("settings") };
}

/** A phone gets the section list; from tablet up the rail is beside it, so show General. */
export default function SettingsIndex() {
	return (
		<>
			<div className="tablet:hidden">
				<SettingsNav variant="list" />
			</div>
			<div className="hidden space-y-4 tablet:block">
				<GeneralSettings />
			</div>
		</>
	);
}
