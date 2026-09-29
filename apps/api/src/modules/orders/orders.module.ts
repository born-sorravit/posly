import { OrdersController } from "@/modules/orders/orders.controller";
import { OrdersService } from "@/modules/orders/orders.service";
import { ReceiptMailService } from "@/modules/orders/receipt-mail.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [OrdersController],
	providers: [OrdersService, ReceiptMailService],
	exports: [OrdersService],
})
export class OrdersModule {}
