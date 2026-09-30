import { Module } from "@nestjs/common";
import { AdminController } from "@/modules/admin/admin.controller";
import { AdminService } from "@/modules/admin/admin.service";

@Module({
	controllers: [AdminController],
	providers: [AdminService],
})
export class AdminModule {}
