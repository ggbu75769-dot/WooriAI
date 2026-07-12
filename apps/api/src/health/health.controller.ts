import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Minimal structural type for the Express response object, just enough to set a
// status code before returning a plain body (passthrough mode). Avoids taking a
// compile-time dependency on @types/express, which this project does not install.
type MinimalHttpResponse = { status: (statusCode: number) => unknown };

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return { status: "ok" };
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: MinimalHttpResponse) {
    const connected = await this.prisma.checkConnection();
    const body = {
      status: connected ? "ok" : "degraded",
      db: { connected },
      uptime: process.uptime()
    };
    if (!connected) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
