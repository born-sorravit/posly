import { OrdersController } from "@/modules/orders/orders.controller";
import { OrdersService } from "@/modules/orders/orders.service";
import { ReceiptMailService } from "@/modules/orders/receipt-mail.service";
import { InventoryModule } from "@/modules/inventory/inventory.module";
import { Module } from "@nestjs/common";

@Module({
	imports: [InventoryModule],
	controllers: [OrdersController],
	providers: [OrdersService, ReceiptMailService],
	exports: [OrdersService],
})
export class OrdersModule {}
