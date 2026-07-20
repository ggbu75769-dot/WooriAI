import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApiApp } from "./bootstrap";
import { assertRequiredSecretsConfigured } from "./common/config/require-secret";
import { ServiceHeartbeatService } from "./common/operations/service-heartbeat.service";

export async function bootstrap() {
  assertRequiredSecretsConfigured();
  const app = await NestFactory.create(AppModule);
  configureApiApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  if (process.env.NODE_ENV !== "test" || process.env.SERVICE_HEARTBEAT_ENABLED === "1") {
    await app.get(ServiceHeartbeatService).start("api");
  }
  return app;
}

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "unhandledRejection",
      reason: reason instanceof Error ? reason.stack ?? reason.message : String(reason)
    })
  );
});

let shuttingDown = false;
function handleShutdownSignal(appPromise: ReturnType<typeof bootstrap>) {
  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      const app = await appPromise;
      await app.close();
      process.exit(0);
    } catch {
      // close 실패도 종료 코드로 드러낸다 (0으로 가리지 않음).
      process.exit(1);
    }
  };
}

if (process.env.NODE_ENV !== "test") {
  const appPromise = bootstrap();
  process.on("SIGTERM", handleShutdownSignal(appPromise));
  process.on("SIGINT", handleShutdownSignal(appPromise));
}
