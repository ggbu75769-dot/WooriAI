import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { TokenService } from "../../auth/token.service";
import type { AuthenticatedRequest } from "../types/authenticated-request";

function bearerTokenFrom(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith("Bearer ")) {
    return null;
  }
  return value.slice("Bearer ".length).trim();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerTokenFrom(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException("로그인이 필요해요.");
    }

    const user = await this.tokenService.verifyAccessToken(token);
    if (user.status !== "active") {
      throw new UnauthorizedException("Account is no longer active.");
    }

    request.user = user;
    return true;
  }
}
