import { Controller, Get, Query, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureApiApp } from "../src/bootstrap";

@Controller("http-compatibility")
class QueryProbeController {
  @Get()
  read(@Query() query: Record<string, unknown>) {
    return query;
  }
}

describe("HTTP framework compatibility", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QueryProbeController]
    }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("preserves nested query objects and bracket arrays before DTO validation", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/http-compatibility?filter[status]=active&ids[]=first&ids[]=second")
      .expect(200);

    expect(response.body).toEqual({
      filter: { status: "active" },
      ids: ["first", "second"]
    });
  });
});
