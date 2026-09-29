import { Business } from "@/models/businesses/entities/business.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class BusinessRepository extends Repository<Business> {
	constructor(private dataSource: DataSource) {
		super(Business, dataSource.createEntityManager());
	}
}
