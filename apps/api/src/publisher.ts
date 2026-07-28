import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { OutboxPublisherService } from "./jobs/outbox-publisher.service";
import { createRelease3Queue } from "./jobs/queue";
import { ServiceHeartbeatService } from "./common/operations/service-heartbeat.service";

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  const publisher = context.get(OutboxPublisherService);
  const heartbeat = context.get(ServiceHeartbeatService);
  const queue = createRelease3Queue();
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await Promise.race([
      queue.waitUntilReady(),
      delay(10_000).then(() => { throw new Error("REDIS_STARTUP_TIMEOUT"); })
    ]);
    await heartbeat.start("publisher");
    while (!stopping) {
      const result = await publisher.publishBatch(queue);
      if (result.claimed > 0) {
        console.info(JSON.stringify({
          event: "outbox.publish_batch",
          claimed: result.claimed,
          published: result.published,
          failed: result.claimed - result.published,
          appVersion: process.env.APP_VERSION ?? "unknown",
          environment: process.env.NODE_ENV ?? "development"
        }));
      }
      if (result.claimed === 0) await delay(Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000));
    }
  } finally {
    await heartbeat.stop();
    await queue.close();
    await context.close();
  }
}

void main().catch((error) => {
  console.error("[publisher] fatal", error instanceof Error ? error.message : "UNKNOWN_ERROR");
  process.exitCode = 1;
});
