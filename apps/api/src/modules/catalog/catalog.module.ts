import { CatalogController } from "@/modules/catalog/catalog.controller";
import { CatalogService } from "@/modules/catalog/catalog.service";
import { SampleCatalogController } from "@/modules/catalog/sample-catalog.controller";
import { SampleCatalogService } from "@/modules/catalog/sample-catalog.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [CatalogController, SampleCatalogController],
	providers: [CatalogService, SampleCatalogService],
	exports: [CatalogService],
})
export class CatalogModule {}
