import { SettingsSkeleton } from "@/components/common/page-skeletons";

/**
 * `/settings` only: in a route group so no loading boundary sits above the section pages, and
 * a link straight to /settings/subscription shows that page's own skeleton, not this one.
 * Inside the settings layout, so the title and rail stay put.
 */
export default function Loading() {
	return <SettingsSkeleton />;
}
