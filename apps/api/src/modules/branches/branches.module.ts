import { BranchesController } from "@/modules/branches/branches.controller";
import { BranchesService } from "@/modules/branches/branches.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [BranchesController],
	providers: [BranchesService],
	exports: [BranchesService],
})
export class BranchesModule {}
