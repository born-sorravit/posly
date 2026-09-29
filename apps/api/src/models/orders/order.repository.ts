import { Order } from "@/models/orders/entities/order.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class OrderRepository extends Repository<Order> {
	constructor(private dataSource: DataSource) {
		super(Order, dataSource.createEntityManager());
	}
}
