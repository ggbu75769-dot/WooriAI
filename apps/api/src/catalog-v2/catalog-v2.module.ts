import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { AdminCatalogV2Controller } from "./admin-catalog-v2.controller";
import { CatalogV2Controller, ExpenseCategoriesV2Controller, ItemPlansController, MotherItemPlansController } from "./catalog-v2.controller";
import { CatalogV2Service } from "./catalog-v2.service";
import { CatalogImportWorkflowService } from "./catalog-import-workflow.service";
import { ObjectStorageModule } from "../common/storage/object-storage.module";

@Module({
  imports: [AuthModule, AdminModule, AuditModule, ObjectStorageModule],
  controllers: [CatalogV2Controller, ItemPlansController, MotherItemPlansController, ExpenseCategoriesV2Controller, AdminCatalogV2Controller],
  providers: [CatalogV2Service, CatalogImportWorkflowService],
  exports: [CatalogV2Service, CatalogImportWorkflowService]
})
export class CatalogV2Module {}
