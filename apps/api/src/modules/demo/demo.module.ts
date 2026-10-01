import { DemoJobsService } from "@/modules/demo/demo-jobs.service";
import { Module } from "@nestjs/common";

/** The public demo's upkeep: nightly rebuild and daytime sales, behind `DEMO_AUTO_RESET`. */
@Module({
	providers: [DemoJobsService],
	exports: [DemoJobsService],
})
export class DemoModule {}
