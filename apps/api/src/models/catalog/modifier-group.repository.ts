import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class ModifierGroupRepository extends Repository<ModifierGroup> {
	constructor(private dataSource: DataSource) {
		super(ModifierGroup, dataSource.createEntityManager());
	}
}
