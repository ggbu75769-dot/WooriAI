import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";
import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateChildDto {
  @IsUUID()
  householdId!: string;

  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsIn([...CHILD_STAGE_MODES])
  stageMode!: ChildStageMode;

  /** 출산 예정일은 미래인 것이 정상이므로 형식만 본다. */
  @IsOptional()
  @Matches(datePattern)
  dueDate?: string;

  /**
   * R27(L-6): 여기서는 `YYYY-MM-DD` 형식만 본다. "오늘보다 미래일 수 없다"는 도메인
   * 규칙이라 OnboardingCoreService가 서울 기준으로 판정하고, VALIDATION_ERROR가 아니라
   * CHILD_BIRTH_DATE_FUTURE(400)로 나간다 — 생성·수정·전환 세 경로가 같은 코드를 쓴다.
   */
  @IsOptional()
  @Matches(datePattern)
  birthDate?: string;

  @IsOptional()
  @IsIn([...CHILD_STAGE_CODES])
  manualStage?: ChildStageCode;
}

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nickname?: string;

  /**
   * CHILD-127: 아이가 태어난 뒤 `pregnant → born`으로 넘어가기 위한 전환 필드.
   * 어떤 값이 실제로 허용되는지(단방향 + birthDate 동시 필수)는 도메인 규칙이라
   * OnboardingCoreService.updateChild가 판정하고, 여기서는 열거형 형식만 검증한다 —
   * 잘못된 방향은 VALIDATION_ERROR가 아니라 CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED로 나가야 한다.
   * 생략하면 기존 stageMode가 유지되므로 이 필드를 모르는 기존 클라이언트와 하위호환된다.
   */
  @IsOptional()
  @IsIn([...CHILD_STAGE_MODES])
  stageMode?: ChildStageMode;

  @IsOptional()
  @Matches(datePattern)
  dueDate?: string;

  /** R27(L-6): CreateChildDto.birthDate와 동일 — 미래 날짜 거부는 서비스 계층(CHILD_BIRTH_DATE_FUTURE). */
  @IsOptional()
  @Matches(datePattern)
  birthDate?: string;

  @IsOptional()
  @IsIn([...CHILD_STAGE_CODES])
  manualStage?: ChildStageCode;
}
