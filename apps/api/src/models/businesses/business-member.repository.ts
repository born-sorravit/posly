import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class BusinessMemberRepository extends Repository<BusinessMember> {
	constructor(private dataSource: DataSource) {
		super(BusinessMember, dataSource.createEntityManager());
	}
}
