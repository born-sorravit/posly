import { Product } from "@/models/catalog/entities/product.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class ProductRepository extends Repository<Product> {
	constructor(private dataSource: DataSource) {
		super(Product, dataSource.createEntityManager());
	}
}
