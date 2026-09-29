import { Subscription } from "@/models/subscriptions/entities/subscription.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class SubscriptionRepository extends Repository<Subscription> {
	constructor(private dataSource: DataSource) {
		super(Subscription, dataSource.createEntityManager());
	}
}
