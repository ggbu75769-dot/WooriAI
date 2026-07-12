import { Module } from "@nestjs/common";
import { AuditModule } from "../common/audit/audit.module";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { HouseholdRuntimeModule } from "../households/household-runtime.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RefreshTokenStore } from "./refresh-token.store";
import { TokenService } from "./token.service";

@Module({
  imports: [AuditModule, HouseholdRuntimeModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, TokenService, RefreshTokenStore],
  exports: [AuthService, JwtAuthGuard, TokenService, RefreshTokenStore]
})
export class AuthModule {}
