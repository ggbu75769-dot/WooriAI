import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExpensePresetsController } from "./expense-presets.controller";
import { ExpensePresetsService } from "./expense-presets.service";

@Module({ imports: [AuthModule], controllers: [ExpensePresetsController], providers: [ExpensePresetsService] })
export class PresetsModule {}
