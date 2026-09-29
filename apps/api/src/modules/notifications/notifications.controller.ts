import {
	NotificationListResponse,
	NotificationPreferenceResponse,
	QueryNotificationsDto,
	UpdateNotificationPreferencesDto,
} from "@/modules/notifications/dto/notification.dto";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { Body, Controller, Get, HttpCode, Post, Put, Query } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

/** No route permission: each member sees the kinds their own permissions cover. */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("businesses/:businessId/notifications")
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	@Get()
	@ApiOperation({
		summary: "Newest notifications this member may see, and the unread count",
	})
	@ApiOkResponse({ type: NotificationListResponse })
	findAll(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryNotificationsDto
	): Promise<NotificationListResponse> {
		return this.notificationsService.list(m, query);
	}

	@Get("preferences")
	@ApiOperation({
		summary: "Which kinds this member receives, among those they may see",
	})
	@ApiOkResponse({ type: [NotificationPreferenceResponse] })
	preferences(
		@CurrentMembership() m: ResolvedMembership
	): Promise<NotificationPreferenceResponse[]> {
		return this.notificationsService.preferences(m);
	}

	@Put("preferences")
	@ApiOperation({ summary: "Set the kinds this member has switched off" })
	@ApiOkResponse({ type: [NotificationPreferenceResponse] })
	updatePreferences(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: UpdateNotificationPreferencesDto
	): Promise<NotificationPreferenceResponse[]> {
		return this.notificationsService.updatePreferences(m, dto);
	}

	@Post("read")
	@HttpCode(204)
	@ApiOperation({ summary: "Mark everything up to now as read, for this member" })
	markAllRead(@CurrentMembership() m: ResolvedMembership): Promise<void> {
		return this.notificationsService.markAllRead(m);
	}
}
