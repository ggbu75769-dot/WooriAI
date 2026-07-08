import { Module } from "@nestjs/common";
import { HouseholdRuntimeService } from "./household-runtime.service";

@Module({
  providers: [HouseholdRuntimeService],
  exports: [HouseholdRuntimeService]
})
export class HouseholdRuntimeModule {}
