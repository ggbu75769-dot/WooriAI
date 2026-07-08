import { Module } from "@nestjs/common";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { AdminController } from "./admin.controller";
import { AdminTokenGuard } from "./admin-token.guard";

@Module({
  imports: [OnboardingModule],
  controllers: [AdminController],
  providers: [AdminTokenGuard]
})
export class AdminModule {}
