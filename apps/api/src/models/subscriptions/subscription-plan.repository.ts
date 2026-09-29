import { SubscriptionPlan } from "@/models/subscriptions/entities/subscription-plan.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class SubscriptionPlanRepository extends Repository<SubscriptionPlan> {
	constructor(private dataSource: DataSource) {
		super(SubscriptionPlan, dataSource.createEntityManager());
	}
}
