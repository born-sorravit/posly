import { NotificationsController } from "@/modules/notifications/notifications.controller";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { Global, Module } from "@nestjs/common";

/** Global: orders and catalog raise events from inside their own transactions. */
@Global()
@Module({
	controllers: [NotificationsController],
	providers: [NotificationsService],
	exports: [NotificationsService],
})
export class NotificationsModule {}
