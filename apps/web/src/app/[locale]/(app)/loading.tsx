import { ListPageSkeleton } from "@/components/common/page-skeletons";

/** Most pages in the app are a header over a filterable table; the rest override this. */
export default function Loading() {
	return <ListPageSkeleton />;
}
