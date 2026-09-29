import { Category } from "@/models/catalog/entities/category.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class CategoryRepository extends Repository<Category> {
	constructor(private dataSource: DataSource) {
		super(Category, dataSource.createEntityManager());
	}
}
