import { RealtimeController } from "@/modules/realtime/realtime.controller";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { Global, Module } from "@nestjs/common";

/** Global: orders, the kitchen and notifications publish from inside their transactions. */
@Global()
@Module({
	controllers: [RealtimeController],
	providers: [RealtimeService],
	exports: [RealtimeService],
})
export class RealtimeModule {}
