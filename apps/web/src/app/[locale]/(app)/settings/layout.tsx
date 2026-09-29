import { SettingsLayout } from "@/components/settings/settings-views";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
	return <SettingsLayout>{children}</SettingsLayout>;
}
