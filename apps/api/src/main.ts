import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApiApp } from "./bootstrap";

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApiApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
