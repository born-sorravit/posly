import { PaginationDto } from "@/shared/dto/pagination.dto";
import { toTrimmedString } from "@/shared/dto/transform.util";
import { OrderStatus, PaymentMethod, ServiceType } from "@/shared/enums/order.enum";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsEmail,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";

export class CheckoutItemDto {
	@ApiProperty()
	@IsUUID()
	productId: string;

	@ApiProperty({ minimum: 1, maximum: 999 })
	@IsInt()
	@Min(1)
	@Max(999)
	quantity: number;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(30)
	@IsUUID("4", { each: true })
	modifierOptionIds?: string[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(200)
	note?: string;
}

export class CheckoutPaymentDto {
	@ApiProperty({ enum: PaymentMethod })
	@IsEnum(PaymentMethod)
	method: PaymentMethod;

	@ApiPropertyOptional({
		description: "Cash handed over, satang. Required for CASH.",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	received?: number;
}

/**
 * What the till sends. Deliberately **no prices**: the server looks every product and option
 * up in this business and computes the totals itself, so a tampered request can change what
 * was bought but never what it cost.
 */
export class CheckoutDto {
	@ApiProperty({
		description:
			"Client-generated UUID; a retry with the same id returns the same order",
	})
	@IsUUID()
	clientOrderId: string;

	@ApiPropertyOptional({ description: "Defaults to the business's default branch" })
	@IsOptional()
	@IsUUID()
	branchId?: string;

	@ApiProperty({ type: [CheckoutItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(200)
	@ValidateNested({ each: true })
	@Type(() => CheckoutItemDto)
	items: CheckoutItemDto[];

	@ApiPropertyOptional({ description: "Order-level discount, satang" })
	@IsOptional()
	@IsInt()
	@Min(0)
	discount?: number;

	@ApiProperty({ type: CheckoutPaymentDto })
	@ValidateNested()
	@Type(() => CheckoutPaymentDto)
	payment: CheckoutPaymentDto;

	@ApiPropertyOptional({
		description: "A customer of this shop (needs the CUSTOMERS feature)",
	})
	@IsOptional()
	@IsUUID()
	customerId?: string;

	@ApiPropertyOptional({
		enum: ServiceType,
		description: "Dine in, take away or delivery",
	})
	@IsOptional()
	@IsEnum(ServiceType)
	serviceType?: ServiceType;

	@ApiPropertyOptional({
		example: "โต๊ะ 3",
		description: "Table, queue number or name to call out",
	})
	@IsOptional()
	@Transform(toTrimmedString)
	@IsString()
	@MaxLength(40)
	label?: string;
}

export class SendReceiptDto {
	@ApiProperty({ example: "customer@example.com" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value
	)
	@IsEmail()
	@MaxLength(255)
	email: string;
}

export class ReverseOrderDto {
	@ApiPropertyOptional({ example: "ลูกค้าเปลี่ยนใจ" })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string;
}

export class QueryOrdersDto extends PaginationDto {
	@ApiPropertyOptional({ enum: OrderStatus })
	@IsOptional()
	@IsEnum(OrderStatus)
	status?: OrderStatus;

	@ApiPropertyOptional({ enum: PaymentMethod })
	@IsOptional()
	@IsEnum(PaymentMethod)
	method?: PaymentMethod;

	@ApiPropertyOptional({ description: "ISO instant, inclusive" })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiPropertyOptional({ description: "ISO instant, exclusive" })
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiPropertyOptional({ description: "Only this customer's orders" })
	@IsOptional()
	@IsUUID()
	customerId?: string;

	@ApiPropertyOptional({ description: "Order number, with or without #" })
	@IsOptional()
	@Transform(toTrimmedString)
	@IsString()
	search?: string;
}

export class OrderItemModifierResponse {
	@ApiProperty() groupName: string;
	@ApiProperty() optionName: string;
	@ApiProperty() priceDelta: number;
}

export class OrderItemResponse {
	@ApiProperty() id: string;
	@ApiProperty({ nullable: true }) productId: string | null;
	@ApiProperty() name: string;
	@ApiProperty() art: string;
	@ApiProperty() quantity: number;
	@ApiProperty() unitPrice: number;
	@ApiProperty({ type: [OrderItemModifierResponse] })
	modifiers: OrderItemModifierResponse[];
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty() lineTotal: number;
}

export class AuditEntryResponse {
	@ApiProperty() action: string;
	@ApiProperty() actorName: string;
	@ApiProperty({ nullable: true }) reason: string | null;
	@ApiProperty() createdAt: string;
}

export class OrderResponse {
	@ApiProperty() id: string;
	@ApiProperty({ example: "000124" }) number: string;
	@ApiProperty() createdAt: string;
	@ApiProperty() branchId: string;
	@ApiProperty() employeeName: string;
	@ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
	@ApiProperty({ enum: OrderStatus }) status: OrderStatus;
	@ApiProperty({ type: [OrderItemResponse] }) items: OrderItemResponse[];
	@ApiProperty() subtotal: number;
	@ApiProperty() discount: number;
	@ApiProperty() vat: number;
	@ApiProperty() total: number;
	@ApiProperty({ nullable: true }) received: number | null;
	@ApiProperty({ nullable: true }) change: number | null;
	@ApiProperty({ nullable: true }) customerName: string | null;
	@ApiProperty({ enum: ServiceType, nullable: true })
	serviceType: ServiceType | null;
	@ApiProperty({ nullable: true, example: "โต๊ะ 3" }) label: string | null;
	@ApiProperty({ type: [AuditEntryResponse] }) audit: AuditEntryResponse[];
}
