import { normaliseEmail, trimmed } from "@/shared/dto/transform.util";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsEmail,
	IsIn,
	IsOptional,
	IsString,
	Length,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

/** OWNER is never assignable through the API: ownership transfer is its own, later flow. */
const ASSIGNABLE = [
	MemberRole.MANAGER,
	MemberRole.CASHIER,
	MemberRole.STAFF,
] as const;

export class InviteMemberDto {
	@ApiProperty({
		description:
			"Who the invite is for — shown to the owner, not used to grant access",
	})
	@IsEmail()
	@MaxLength(255)
	@Transform(normaliseEmail)
	email: string;

	@ApiProperty({ example: "มายด์" })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name: string;

	@ApiProperty({ enum: ASSIGNABLE })
	@IsIn(ASSIGNABLE)
	role: MemberRole;
}

export class UpdateMemberDto {
	@ApiPropertyOptional({ enum: ASSIGNABLE })
	@IsOptional()
	@IsIn(ASSIGNABLE)
	role?: MemberRole;

	@ApiPropertyOptional({ enum: [MemberStatus.ACTIVE, MemberStatus.DISABLED] })
	@IsOptional()
	@IsIn([MemberStatus.ACTIVE, MemberStatus.DISABLED])
	status?: MemberStatus;
}

export class SetPermissionsDto {
	@ApiProperty({
		enum: Permission,
		isArray: true,
		nullable: true,
		description:
			"The member's whole list; null returns them to their role's defaults",
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@IsEnum(Permission, { each: true })
	permissions: Permission[] | null;
}

export class RolePermissionsResponse {
	@ApiProperty({ description: "Defaults per assignable role" })
	roles: Record<string, Permission[]>;
	@ApiProperty({
		enum: Permission,
		isArray: true,
		description: "What a custom list may contain",
	})
	assignable: Permission[];
}

/** 4–6 digits; the same digit throughout or a straight run (1234, 9876) is refused. */
export const PIN_PATTERN = /^\d{4,6}$/;

export class SetPinDto {
	@ApiProperty({ example: "4071", description: "4–6 digits" })
	@IsString()
	@Matches(PIN_PATTERN, { message: "PIN must be 4 to 6 digits" })
	pin: string;

	@ApiPropertyOptional({
		description:
			"The account password — required for password accounts, so a borrowed session cannot plant a PIN",
	})
	@IsOptional()
	@IsString()
	@MaxLength(200)
	password?: string;
}

export class RosterEntryResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ enum: MemberRole }) role: MemberRole;
	@ApiProperty() hasPin: boolean;
	@ApiProperty() isYou: boolean;
	@ApiProperty({
		description:
			"Only on your own entry: whether you have left yourself off the switch screen",
	})
	hiddenFromSwitch: boolean;
}

export class SwitchVisibilityDto {
	@ApiProperty({ description: "true leaves you off this shop's switch screen" })
	@IsBoolean()
	hidden: boolean;
}

export class AcceptInviteDto {
	@ApiProperty()
	@IsString()
	@Length(20, 128)
	token: string;
}

export class MemberResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() email: string;
	@ApiProperty({ enum: MemberRole }) role: MemberRole;
	@ApiProperty({ enum: MemberStatus }) status: MemberStatus;
	@ApiProperty({ nullable: true }) lastActiveAt: string | null;
	@ApiProperty() ordersToday: number;
	@ApiProperty({ nullable: true }) inviteExpiresAt: string | null;
	@ApiProperty({
		enum: Permission,
		isArray: true,
		description: "What the member may do now",
	})
	permissions: Permission[];
	@ApiProperty({ description: "A custom list replaces the role's defaults" })
	customPermissions: boolean;
	@ApiPropertyOptional({ description: "The caller's own row (in the list)" })
	isYou?: boolean;
	@ApiPropertyOptional({ description: "A quick-switch PIN is set (in the list)" })
	hasPin?: boolean;
}

export class InviteLinkResponse {
	@ApiProperty({ type: MemberResponse }) member: MemberResponse;
	@ApiProperty({
		description: "One-time link. Shown once; only its hash is stored.",
	})
	inviteUrl: string;
	@ApiProperty() expiresAt: string;
}

export class InvitePreviewResponse {
	@ApiProperty() businessName: string;
	@ApiProperty({ enum: MemberRole }) role: MemberRole;
	@ApiProperty() invitedName: string;
	@ApiProperty() expiresAt: string;
}

export class AcceptInviteResponse {
	@ApiProperty() businessId: string;
	@ApiProperty() businessName: string;
	@ApiProperty({ enum: MemberRole }) role: MemberRole;
}
