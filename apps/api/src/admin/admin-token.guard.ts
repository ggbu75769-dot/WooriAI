import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = headerValue(request.headers?.["x-admin-token"]);
    const expectedToken = process.env.WOORIAI_ADMIN_TOKEN ?? "dev-admin-token";
    if (token !== expectedToken) {
      throw new ForbiddenException({ code: "ADMIN_FORBIDDEN", message: "Admin access is required." });
    }
    return true;
  }
}
