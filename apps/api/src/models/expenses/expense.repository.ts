import { Expense } from "@/models/expenses/entities/expense.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class ExpenseRepository extends Repository<Expense> {
	constructor(private dataSource: DataSource) {
		super(Expense, dataSource.createEntityManager());
	}
}
