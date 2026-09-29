import { ExpensesController } from "@/modules/expenses/expenses.controller";
import { ExpensesService } from "@/modules/expenses/expenses.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [ExpensesController],
	providers: [ExpensesService],
})
export class ExpensesModule {}
