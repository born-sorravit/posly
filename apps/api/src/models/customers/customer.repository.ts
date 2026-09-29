import { Customer } from "@/models/customers/entities/customer.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class CustomerRepository extends Repository<Customer> {
	constructor(private dataSource: DataSource) {
		super(Customer, dataSource.createEntityManager());
	}
}
