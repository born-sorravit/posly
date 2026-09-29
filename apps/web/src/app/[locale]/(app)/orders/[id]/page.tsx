import { OrderDetailPage } from "@/components/orders/order-detail";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <OrderDetailPage orderId={id} />;
}
