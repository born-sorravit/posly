import { NotificationKind } from "@/shared/enums/notification.enum";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	Max,
	Min,
} from "class-validator";

export class QueryNotificationsDto {
	@ApiPropertyOptional({ default: 30, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}

export class NotificationResponse {
	@ApiProperty() id: string;
	@ApiProperty({ enum: NotificationKind }) kind: NotificationKind;
	@ApiProperty({ nullable: true }) entityId: string | null;
	@ApiProperty({
		description: "Facts for the client to phrase: names, amounts, counts",
	})
	data: Record<string, unknown>;
	@ApiProperty() read: boolean;
	@ApiProperty() createdAt: Date;
}

export class NotificationListResponse {
	@ApiProperty({ type: [NotificationResponse] }) items: NotificationResponse[];
	@ApiProperty({ description: "Unread among everything this member may see" })
	unread: number;
}

export class NotificationPreferenceResponse {
	@ApiProperty({ enum: NotificationKind }) kind: NotificationKind;
	@ApiProperty() enabled: boolean;
}

export class UpdateNotificationPreferencesDto {
	@ApiProperty({
		enum: NotificationKind,
		isArray: true,
		description: "Kinds to switch off",
	})
	@IsArray()
	@ArrayMaxSize(20)
	@IsEnum(NotificationKind, { each: true })
	muted: NotificationKind[];
}
