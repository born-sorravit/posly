import { ReportsController } from "@/modules/reports/reports.controller";
import { ReportsService } from "@/modules/reports/reports.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [ReportsController],
	providers: [ReportsService],
})
export class ReportsModule {}
