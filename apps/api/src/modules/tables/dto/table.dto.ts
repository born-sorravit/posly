import { CheckoutItemDto, CheckoutPaymentDto } from "@/modules/orders/dto/order.dto";
import { trimmed } from "@/shared/dto/transform.util";
import { KitchenStatus, ModifierSelection } from "@/shared/enums/order.enum";
import {
	TableCallKind,
	TableRequestStatus,
	TableSessionStatus,
} from "@/shared/enums/table.enum";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from "class-validator";

// ---------------------------------------------------------------- setup

export class CreateTableDto {
	@ApiProperty({ example: "โต๊ะ 1" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(40)
	name: string;

	@ApiPropertyOptional({ example: "ในร้าน", nullable: true })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(40)
	zone?: string | null;

	@ApiPropertyOptional({ minimum: 1, maximum: 99, nullable: true })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(99)
	seats?: number | null;

	@ApiPropertyOptional({ description: "Defaults to the business's default branch" })
	@IsOptional()
	@IsUUID()
	branchId?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(9999)
	displayOrder?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class UpdateTableDto extends PartialType(CreateTableDto) {}

export class TableResponse {
	@ApiProperty() id: string;
	@ApiProperty() branchId: string;
	@ApiProperty() name: string;
	@ApiProperty({ nullable: true }) zone: string | null;
	@ApiProperty({ nullable: true }) seats: number | null;
	@ApiProperty() displayOrder: number;
	@ApiProperty() isActive: boolean;
	@ApiProperty({ description: "What the table's QR carries" }) qrToken: string;
	@ApiProperty({ type: () => TableCallResponse, nullable: true })
	call: TableCallResponse | null;
}

export class TableCallResponse {
	@ApiProperty({ enum: TableCallKind }) kind: TableCallKind;
	@ApiProperty() at: string;
}

export class GuestCallDto {
	@ApiProperty({ enum: TableCallKind })
	@IsEnum(TableCallKind)
	kind: TableCallKind;
}

// ---------------------------------------------------------------- the floor

export class OpenTableDto {
	@ApiPropertyOptional({ minimum: 1, maximum: 99 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(99)
	guests?: number;
}

/** Staff adding a round from the till: sent straight to the tab, no acceptance step. */
export class AddRoundDto {
	@ApiProperty({ description: "Client-generated UUID; a retry adds the round once" })
	@IsUUID()
	clientRequestId: string;

	@ApiProperty({ type: [CheckoutItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => CheckoutItemDto)
	items: CheckoutItemDto[];
}

export class CloseTabDto {
	@ApiPropertyOptional({ description: "Order-level discount, satang" })
	@IsOptional()
	@IsInt()
	@Min(0)
	discount?: number;

	@ApiProperty({ type: CheckoutPaymentDto })
	@ValidateNested()
	@Type(() => CheckoutPaymentDto)
	payment: CheckoutPaymentDto;
}

export class CancelTabDto {
	@ApiPropertyOptional({ example: "ลูกค้ายกเลิก" })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string;
}

export class TabLineResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() quantity: number;
	@ApiProperty() unitPrice: number;
	@ApiProperty() lineTotal: number;
	@ApiProperty({ type: [String] }) modifiers: string[];
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty() round: number;
	@ApiProperty() toKitchen: boolean;
	@ApiProperty({ nullable: true }) preparedAt: string | null;
}

export class RequestLineResponse {
	@ApiProperty() productId: string;
	@ApiProperty({ description: "Current name; the product may since be gone" })
	name: string;
	@ApiProperty() quantity: number;
	@ApiProperty({ description: "Today's price, for a preview; fixed when accepted" })
	unitPrice: number;
	@ApiProperty({ type: [String] }) modifiers: string[];
	@ApiProperty({ nullable: true }) note: string | null;
}

export class TableRequestResponse {
	@ApiProperty() id: string;
	@ApiProperty({ enum: TableRequestStatus }) status: TableRequestStatus;
	@ApiProperty() createdAt: string;
	@ApiProperty({ type: [RequestLineResponse] }) items: RequestLineResponse[];
	@ApiProperty() total: number;
}

export class TabResponse {
	@ApiProperty() id: string;
	@ApiProperty() tableId: string;
	@ApiProperty() tableName: string;
	@ApiProperty({ enum: TableSessionStatus }) status: TableSessionStatus;
	@ApiProperty({ nullable: true }) guests: number | null;
	@ApiProperty() openedAt: string;
	@ApiProperty({ nullable: true }) orderId: string | null;
	@ApiProperty({ nullable: true, example: "000124" }) orderNumber: string | null;
	@ApiProperty({ enum: KitchenStatus, nullable: true })
	kitchenStatus: KitchenStatus | null;
	@ApiProperty({ type: [TabLineResponse] }) lines: TabLineResponse[];
	@ApiProperty() subtotal: number;
	@ApiProperty() vat: number;
	@ApiProperty() total: number;
	@ApiProperty({ type: [TableRequestResponse] }) requests: TableRequestResponse[];
}

export class BoardTabResponse {
	@ApiProperty() id: string;
	@ApiProperty({ nullable: true }) guests: number | null;
	@ApiProperty() openedAt: string;
	@ApiProperty() total: number;
	@ApiProperty() itemCount: number;
	@ApiProperty() pendingRequests: number;
}

export class BoardTableResponse extends TableResponse {
	@ApiProperty({ type: BoardTabResponse, nullable: true })
	tab: BoardTabResponse | null;
}

// ---------------------------------------------------------------- guests (public)

export class GuestRequestDto {
	@ApiProperty({
		description: "Client-generated UUID; a double tap sends one request",
	})
	@IsUUID()
	clientRequestId: string;

	@ApiProperty({ type: [CheckoutItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(30)
	@ValidateNested({ each: true })
	@Type(() => CheckoutItemDto)
	items: CheckoutItemDto[];
}

export class GuestOptionResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() priceDelta: number;
	@ApiProperty() isDefault: boolean;
}

export class GuestModifierGroupResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ enum: ModifierSelection }) selection: ModifierSelection;
	@ApiProperty() required: boolean;
	@ApiProperty({ type: [GuestOptionResponse] }) options: GuestOptionResponse[];
}

/** A product as a guest sees it: no cost, stock count or SKU — only whether it is sold out. */
export class GuestProductResponse {
	@ApiProperty() id: string;
	@ApiProperty({ nullable: true }) categoryId: string | null;
	@ApiProperty() name: string;
	@ApiProperty() price: number;
	@ApiProperty() art: string;
	@ApiProperty({ nullable: true }) imageUrl: string | null;
	@ApiProperty() soldOut: boolean;
	@ApiProperty({ type: [GuestModifierGroupResponse] })
	modifierGroups: GuestModifierGroupResponse[];
}

export class GuestCategoryResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() icon: string;
}

export class GuestMenuResponse {
	@ApiProperty() shopName: string;
	@ApiProperty({ nullable: true }) logoUrl: string | null;
	@ApiProperty() tableName: string;
	@ApiProperty({ description: "The shop's plan takes orders from the QR at all" })
	qrOrdering: boolean;
	@ApiProperty({ description: "Whether a guest may send a round now" })
	open: boolean;
	@ApiProperty({ type: [GuestCategoryResponse] })
	categories: GuestCategoryResponse[];
	@ApiProperty({ type: [GuestProductResponse] }) products: GuestProductResponse[];
}

export class GuestTabLineResponse {
	@ApiProperty() name: string;
	@ApiProperty() quantity: number;
	@ApiProperty() lineTotal: number;
	@ApiProperty({ type: [String] }) modifiers: string[];
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty() round: number;
	@ApiProperty({ description: "Made and on its way (ticked off in the kitchen)" })
	ready: boolean;
}

/** The table's bill as guests see it: what is on it and what is still waiting. No names. */
export class GuestTabResponse {
	@ApiProperty() open: boolean;
	@ApiProperty({ type: [GuestTabLineResponse] }) lines: GuestTabLineResponse[];
	@ApiProperty() total: number;
	@ApiProperty({
		nullable: true,
		description: "Set once there is something to pay, when the shop takes PromptPay",
	})
	promptPayId: string | null;
	@ApiProperty({ type: () => TableCallResponse, nullable: true })
	call: TableCallResponse | null;
	@ApiProperty({ type: [TableRequestResponse] }) requests: TableRequestResponse[];
}
