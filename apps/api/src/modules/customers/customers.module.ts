import { CustomersController } from "@/modules/customers/customers.controller";
import { CustomersService } from "@/modules/customers/customers.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [CustomersController],
	providers: [CustomersService],
	exports: [CustomersService],
})
export class CustomersModule {}
