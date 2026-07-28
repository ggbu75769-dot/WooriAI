import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { RecallProviderEventDto } from "./dto/release5-external.dto";
import { Release5ExternalService } from "./release5-external.service";

@Controller("providers/recall")
export class Release5ProviderController {
  constructor(@Inject(Release5ExternalService) private readonly external: Release5ExternalService) {}

  @Post("events")
  @HttpCode(200)
  ingest(@Body(createDtoValidationPipe(RecallProviderEventDto)) body: RecallProviderEventDto) {
    return this.external.ingestRecall(body);
  }
}
