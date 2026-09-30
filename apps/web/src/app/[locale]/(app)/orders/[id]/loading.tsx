import { OrderDetailSkeleton } from "@/components/orders/order-detail-skeleton";

/** The order's own shape, so the sales table's skeleton one level up never stands in for it. */
export default function Loading() {
	return <OrderDetailSkeleton />;
}
