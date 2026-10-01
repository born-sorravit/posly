import { OrdersModule } from "@/modules/orders/orders.module";
import { GuestTablesService } from "@/modules/tables/guest-tables.service";
import {
	GuestTablesController,
	TablesController,
} from "@/modules/tables/tables.controller";
import { TablesService } from "@/modules/tables/tables.service";
import { Module } from "@nestjs/common";

@Module({
	imports: [OrdersModule],
	controllers: [TablesController, GuestTablesController],
	providers: [TablesService, GuestTablesService],
})
export class TablesModule {}
