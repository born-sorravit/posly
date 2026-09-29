import { KitchenController } from "@/modules/kitchen/kitchen.controller";
import { KitchenService } from "@/modules/kitchen/kitchen.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [KitchenController],
	providers: [KitchenService],
})
export class KitchenModule {}
