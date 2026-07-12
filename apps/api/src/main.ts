import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApiApp } from "./bootstrap";
import { assertRequiredSecretsConfigured } from "./common/config/require-secret";

export async function bootstrap() {
  assertRequiredSecretsConfigured();
  const app = await NestFactory.create(AppModule);
  configureApiApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
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
    } finally {
      process.exit(0);
    }
  };
}

if (process.env.NODE_ENV !== "test") {
  const appPromise = bootstrap();
  process.on("SIGTERM", handleShutdownSignal(appPromise));
  process.on("SIGINT", handleShutdownSignal(appPromise));
}
