import { Branch } from "@/models/branches/entities/branch.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class BranchRepository extends Repository<Branch> {
	constructor(private dataSource: DataSource) {
		super(Branch, dataSource.createEntityManager());
	}
}
