import { BusinessesController } from "@/modules/businesses/businesses.controller";
import { BusinessesService } from "@/modules/businesses/businesses.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [BusinessesController],
	providers: [BusinessesService],
	exports: [BusinessesService],
})
export class BusinessesModule {}
