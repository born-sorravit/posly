import { BaseEntity } from "@/models/base.entity";
import { ExpenseCategory } from "@/shared/enums/expense-category.enum";
import { moneyColumnTransformer } from "@/shared/utils/money.util";
import type { Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index } from "typeorm";

/**
 * Money that left the shop outside a sale (plan §19): ingredients, the electricity bill,
 * wages. Subtracted from gross profit for the estimated profit in reports; not accounting.
 *
 * `spentOn` is the calendar day the owner says it belongs to, in the shop's own timezone —
 * a bill paid on the 2nd for last month is still last month's.
 */
@Entity("expense")
@Index("idx_expense_business_spent_on", ["businessId", "spentOn"])
export class Expense extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ type: "enum", enum: ExpenseCategory })
	category: ExpenseCategory;

	@Column({ type: "bigint", transformer: moneyColumnTransformer })
	amount: Satang;

	@Column({ type: "varchar", length: 200, nullable: true })
	note: string | null;

	@Column({ name: "spent_on", type: "date" })
	spentOn: string;

	@Column({ name: "member_id", type: "uuid" })
	memberId: string;

	@Column({ name: "recorded_by", type: "varchar", length: 120 })
	recordedBy: string;
}
