import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { NECESSITY_LEVELS, type NecessityLevel } from "@wooriai/domain";
import { STAGE_BAND_LABELS, type StageBandLabel } from "../stage-bands";

/**
 * 라운드 100 T1: 커스텀 품목 CRUD 본문 — round100-custom-items-design.md §9.2의
 * class-validator 자체 선언(계약 zod 스키마의 미러, contracts 신규 심볼 import 0건 =
 * T2와 독립. 기존 items.dto 관례).
 *
 * `name`은 **검증 전에 trim**한다(admin-categories.dto.ts의 라운드 28 F2 관례 그대로):
 * `@MinLength(1)`이 원본을 보면 `"   "`가 통과하고 저장 직전 trim이 빈 이름을 만든다.
 * Transform이 먼저 돌므로 길이 검사도 trim된 값에 걸리고, 저장되는 값 = 검증된 값이다
 * (§9.1 "서버가 트림 후 재검증"이 이 배선이다). 상한 80자는 item_templates.name과 같은
 * 폭(custom_items.name varchar(80) — §1.2), 단일 소스 상수는 CUSTOM_ITEM_NAME_MAX_LENGTH
 * (custom-items.service.ts — 계약 패키지 반영은 T2 몫).
 */
export class CreateCustomItemDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  /** 4밴드 라벨 원문(stageBandLabelSchema) — 저장도 라벨 원문이다(§1.3). */
  @IsIn([...STAGE_BAND_LABELS])
  stageBand!: StageBandLabel;

  /** 클라이언트가 항상 명시한다(기본 essential은 UI 몫 — §9.1). */
  @IsIn([...NECESSITY_LEVELS])
  necessityLevel!: NecessityLevel;
}

/**
 * PATCH 본문 — 위 3필드 전부 optional(§9.2). status는 여기 없다: 상태는 기존
 * PATCH /children/:childId/items/:id/status 하나가 쓴다(§2.4 — 오프라인 아웃박스 무개조).
 */
export class UpdateCustomItemDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn([...STAGE_BAND_LABELS])
  stageBand?: StageBandLabel;

  @IsOptional()
  @IsIn([...NECESSITY_LEVELS])
  necessityLevel?: NecessityLevel;
}
