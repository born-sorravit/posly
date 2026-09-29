import { KitchenStatus, ServiceType } from "@/shared/enums/order.enum";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsUUID } from "class-validator";

export class QueryKitchenDto {
	@ApiPropertyOptional({
		description: "One branch's kitchen; all the caller may see when omitted",
	})
	@IsOptional()
	@IsUUID()
	branchId?: string;
}

export class SetKitchenStatusDto {
	@ApiProperty({ enum: KitchenStatus })
	@IsEnum(KitchenStatus)
	status: KitchenStatus;
}

export class SetPreparedDto {
	@ApiProperty() @IsBoolean() prepared: boolean;
}

export class KitchenLineResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() quantity: number;
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty({ type: [String], description: "Chosen options, e.g. L, หวาน 50%" })
	modifiers: string[];
	@ApiProperty({ nullable: true }) preparedAt: string | null;
}

export class KitchenTicketResponse {
	@ApiProperty() id: string;
	@ApiProperty({ example: "000124" }) number: string;
	@ApiProperty({ enum: KitchenStatus }) status: KitchenStatus;
	@ApiProperty() createdAt: string;
	@ApiProperty({ description: "When it last moved on the board" }) updatedAt: string;
	@ApiProperty() branchId: string;
	@ApiProperty() employeeName: string;
	@ApiProperty({ nullable: true }) customerName: string | null;
	@ApiProperty({ enum: ServiceType, nullable: true })
	serviceType: ServiceType | null;
	@ApiProperty({ nullable: true }) label: string | null;
	@ApiProperty({ type: [KitchenLineResponse] }) lines: KitchenLineResponse[];
}

export class KitchenBoardResponse {
	@ApiProperty({
		type: [KitchenTicketResponse],
		description: "New, preparing and ready; oldest first",
	})
	open: KitchenTicketResponse[];
	@ApiProperty({
		type: [KitchenTicketResponse],
		description: "Served in the last 15 minutes, for recall",
	})
	recent: KitchenTicketResponse[];
}
