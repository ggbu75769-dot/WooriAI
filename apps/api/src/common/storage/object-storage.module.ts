import { Global, Module } from "@nestjs/common";
import { CatalogImportStorageService } from "../../catalog-v2/catalog-import-storage.service";

@Global()
@Module({
  providers: [CatalogImportStorageService],
  exports: [CatalogImportStorageService]
})
export class ObjectStorageModule {}
