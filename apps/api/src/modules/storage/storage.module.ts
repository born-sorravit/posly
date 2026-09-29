import { StorageController } from "@/modules/storage/storage.controller";
import { StorageService } from "@/modules/storage/storage.service";
import { Global, Module } from "@nestjs/common";

/** Global so products and businesses can resolve and validate image paths. */
@Global()
@Module({
	controllers: [StorageController],
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule {}
