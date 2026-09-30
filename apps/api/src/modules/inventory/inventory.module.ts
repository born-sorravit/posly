import { InventoryController } from "@/modules/inventory/inventory.controller";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [InventoryController],
	providers: [InventoryService],
	exports: [InventoryService],
})
export class InventoryModule {}
