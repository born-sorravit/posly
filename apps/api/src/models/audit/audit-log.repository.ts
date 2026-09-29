import { AuditLog } from "@/models/audit/entities/audit-log.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class AuditLogRepository extends Repository<AuditLog> {
	constructor(private dataSource: DataSource) {
		super(AuditLog, dataSource.createEntityManager());
	}
}
