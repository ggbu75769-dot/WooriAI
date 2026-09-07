import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { CHILD_NICKNAME_MAX_LENGTH } from "@wooriai/contracts";
import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateChildDto {
  @IsUUID()
  householdId!: string;

  /**
   * 라운드 107 트랙 F — 상한은 `@wooriai/contracts`의 `CHILD_NICKNAME_MAX_LENGTH`
   * (= `children.nickname` varchar(60))를 그대로 쓴다.
   *
   * 없을 때 무슨 일이 있었나: 이 칸에는 `@IsNotEmpty()`뿐이었고 서비스도 존재 여부만 봤다.
   * 그래서 61자는 검증이 아니라 **DB에서** 터졌다 — Prisma가 P2000(값이 컬럼보다 길다)을 던지고,
   * 이 저장소에는 그 코드를 400으로 옮기는 핸들러가 **한 곳도 없어서** 그대로 500이 됐다.
   * 그 500이 서는 자리가 온보딩 첫 화면(ONB-002 아이 만들기)이라, 막힌 사람은 홈에도 준비템에도
   * 도달하지 못한 채 무엇이 왜 막혔는지 모른다(500 본문에는 필드 사유가 실리지 않는다).
   *
   * 금액(GAP-054 #2)·지출 텍스트(GAP-056 #1)가 각각 int4 상한·varchar 상한에 대해 이미 세운
   * 것과 같은 배선이다: 숫자의 단일 소스는 계약 층이고, 여기서는 그것을 물기만 한다.
   *
   * 마이그레이션 없음 — 컬럼이 이미 갖고 있던 한계를 계약 층에 적는 것뿐이다.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHILD_NICKNAME_MAX_LENGTH)
  nickname!: string;

  @IsIn([...CHILD_STAGE_MODES])
  stageMode!: ChildStageMode;

  /**
   * 출산 예정일은 미래인 것이 정상이므로 여기서는 형식만 본다.
   *
   * 라운드 67 B: 그 미래에도 끝이 있다 — "만삭보다 멀 수 없다"는 도메인 규칙이라
   * (임신 주차 계산에서 읽는다) birthDate와 같은 방식으로 OnboardingCoreService가 판정하고,
   * VALIDATION_ERROR가 아니라 CHILD_DUE_DATE_BEYOND_TERM(400)으로 나간다.
   */
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
  /** 라운드 107 트랙 F: 생성과 **같은 상한**이다(근거는 CreateChildDto.nickname 주석). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHILD_NICKNAME_MAX_LENGTH)
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

  /** CreateChildDto.dueDate와 동일 — 만삭 상한은 서비스 계층(CHILD_DUE_DATE_BEYOND_TERM, 라운드 67 B). */
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
