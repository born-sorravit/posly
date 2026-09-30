import { Module } from "@nestjs/common";
import { AdminController } from "@/modules/admin/admin.controller";
import { AdminGrowthService } from "@/modules/admin/admin-growth.service";
import { AdminSupportService } from "@/modules/admin/admin-support.service";
import { AdminService } from "@/modules/admin/admin.service";

@Module({
	controllers: [AdminController],
	providers: [AdminService, AdminSupportService, AdminGrowthService],
})
export class AdminModule {}
