/**
 * 기능 라운드 1 트랙 B — 기록 탭 정렬(최신순 ↔ 금액 큰 순)의 **판정·문구 순수 모듈**.
 *
 * "이번 달 뭐가 제일 컸지"는 지금까지 스크롤+암산이었다. 정렬은 이미 받아 둔 월 지출 배열의
 * **클라이언트 재배열**일 뿐이라 신규 쿼리 0 · 서버/로컬 백엔드 0바이트이고, 화면(app/(tabs)/
 * records.tsx)은 이 모듈의 판정을 그리기만 한다(react-native 비의존 — 이 저장소의 확립된
 * 규율: vitest가 RN을 렌더할 수 없다. records-date-groups.ts·records-list-view.ts와 같은 결).
 *
 * ## 규칙 (feature-round1-design.md §3 트랙 B)
 *  - 정렬은 **필터(검색·카테고리 칩) 결과 위에** 적용된다 — 이 모듈은 받은 배열을 재배열만
 *    하고, 어떤 행도 새로 살리거나 숨기지 않는다.
 *  - 동액이면 **최신 우선**(spentOn 내림차순), 그래도 같으면 **입력 순서 보존**(안정 정렬 —
 *    화면이 오프라인 대기 행을 서버 행 앞에 두는 기존 순서가 그대로 남는다).
 *  - **달력 보기에서는 토글을 숨기고 정렬을 적용하지 않는다** — 달력 격자는 날짜가 자리라
 *    금액 정렬이 성립하지 않는다.
 *  - 금액순에서는 일별 소계를 숨긴다(합계가 아닌 정렬에 소계를 붙이면 거짓 신호) — 그 조립은
 *    records-list-view.ts의 buildRecordsAmountSortedSections가 이 모듈의 비교기를 그대로 쓴다.
 *
 * ## 문구가 여기 있는 이유
 * 화면(records.tsx)의 한국어 리터럴 수는 keyboard-tap-guard.test.ts의 KOREAN_LITERAL_LEDGER가
 * 값(14)으로 물고 있다 — 새 문구는 화면이 아니라 순수 모듈이 소유한다(같은 이유로 낭독 안내
 * 문장도 여기서 나온다). 칩 라벨에 "선택됨"을 싣지 않는 것은 라운드 95의 규율이다: 선택 여부는
 * `accessibilityState.selected`(공용 CategoryChip이 이미 진다)가 말하고, 라벨이 같은 사실을
 * 말로 다시 적으면 TalkBack이 두 번 읽는다.
 */

/** 저장소(records-view.store)에 남는 값 — 화면 라벨이 아니다(라벨을 저장하면 문구를 다듬는 순간 옛 저장본이 무효가 된다). */
export type RecordsSortMode = "latest" | "amount";

/** 저장본에서 살릴 수 있는 값만 남긴다. 모르는 값(옛/손상 blob)은 기본값(최신순)으로 떨어진다. */
export function sanitizeRecordsSortMode(value: unknown): RecordsSortMode {
  return value === "amount" ? "amount" : "latest";
}

/** 토글이 내놓는 선택지 — 순서가 곧 세그먼트 순서다(기본값이 앞). */
export function recordsSortModes(): readonly RecordsSortMode[] {
  return ["latest", "amount"];
}

/**
 * 토글(SegmentedControl — 리스트/달력 토글과 같은 공용 컨트롤 재사용)에 그려지는 옵션 라벨.
 * SegmentedControl은 옵션 문자열을 그대로 접근성 라벨로 쓰므로 상태 낱말("선택됨")을 싣지
 * 않는다 — 선택 여부는 accessibilityState.selected가 진다(위 머리말 · 라운드 95).
 */
export function recordsSortOptionLabel(mode: RecordsSortMode): string {
  return mode === "amount" ? "금액 큰 순" : "최신순";
}

/**
 * SegmentedControl의 onChange는 **옵션 문자열**을 돌려준다 — 그 라벨을 저장 값으로 되돌리는
 * 단일 자리다(화면이 한국어 리터럴로 분기하면 라벨 규칙이 두 벌이 된다). 모르는 라벨은
 * sanitize와 같은 방향으로 기본값(최신순)에 떨어진다.
 */
export function recordsSortModeForLabel(label: string): RecordsSortMode {
  return recordsSortModes().find((mode) => recordsSortOptionLabel(mode) === label) ?? "latest";
}

/**
 * 정렬 전환 직후 announceForA11y로 읽어 주는 한 문장(A11Y-117 월 이동과 같은 관례 — 포커스가
 * 누른 세그먼트에 머물러 목록이 재배열된 사실을 놓친다). 옵션 라벨에서 그대로 조립해 두 자리가
 * 갈릴 수 없다.
 */
export function recordsSortAnnouncement(mode: RecordsSortMode): string {
  return `${recordsSortOptionLabel(mode)} 정렬`;
}

/**
 * 정렬 토글을 그릴지 — **달력 보기에서는 숨긴다.** 달력 격자의 자리는 날짜라 "금액 큰 순"이
 * 성립하지 않고, 눌러도 아무것도 바뀌지 않는 컨트롤은 거짓 컨트롤이다(칩 disabled 규율과 같은
 * 판단이되, 여기서는 보기 전환이 곧 복귀 경로라 숨김이 맞다 — 리스트로 돌아오면 다시 선다).
 */
export function isRecordsSortToggleVisible(input: { isCalendarView: boolean }): boolean {
  return !input.isCalendarView;
}

/**
 * 금액 큰 순을 실제로 **적용**할지. 토글 숨김과 별도로 두는 이유: 달력 보기 중에도 저장된
 * 선택(sortMode)은 남아 있어야 하고(리스트로 돌아오면 그대로 복원), 적용만 멈춰야 한다.
 */
export function isAmountSortApplied(input: { sortMode: RecordsSortMode; isCalendarView: boolean }): boolean {
  return input.sortMode === "amount" && !input.isCalendarView;
}

/**
 * 화면이 **표시에 쓰는** 정렬 모드 — 달력 날짜 착지의 임시 오버라이드를 반영한다.
 *
 * 리뷰 M-4(두 시점): 종전에는 달력 칸 탭이 `setRecordsSortMode("latest")`로 **persist된
 * 취향을 영구 덮어썼다** — 칸 탭의 목적지는 그 날짜의 섹션이라 금액순 평평 목록에는 자리가
 * 없다는 판단 자체는 옳았지만, "그날 보기" 탭을 정렬 취향의 의사표시로 승격한 것이 과대
 * 해석이었다(금액 큰 순을 기억시켜 둔 사용자가 날짜 하나를 보러 들어간 대가로 취향을 잃었다).
 * 이제 착지는 화면의 비저장 state(`calendarDateLanding`)로만 남고, 이 판정이 저장 취향 위에
 * 그 세션의 표시만 최신순으로 얹는다 — persist 값은 한 글자도 바뀌지 않고, 정렬 토글의 명시
 * 선택(handleSortModeChange)이 오버라이드를 걷으며 언제나 이긴다.
 */
export function effectiveRecordsSortMode(input: {
  sortMode: RecordsSortMode;
  calendarDateLanding: boolean;
}): RecordsSortMode {
  return input.calendarDateLanding ? "latest" : input.sortMode;
}

/** 이 모듈이 행에서 필요로 하는 구조적 최소치(records-date-groups의 GroupableExpenseRow와 같은 결). */
export type AmountSortableRecordRow = {
  amountKrw: number;
  /** "YYYY-MM-DD"(서버 toExpenseDto의 date-only 포맷). 동액의 최신 우선 판정에만 쓴다. */
  spentOn: string;
};

/** 금액이 수가 아니면(손상 데이터) 0으로 본다 — 비교기가 NaN을 돌려주면 정렬 전체가 무너진다. */
function comparableAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * 금액 큰 순 비교기 — 금액 내림차순, 동액이면 최신(spentOn 내림차순), 그래도 같으면 0
 * (`Array.prototype.sort`는 명세상 안정 정렬이라 입력 순서가 보존된다).
 *
 * spentOn은 ISO date-only라 **문자열 비교가 곧 날짜 비교**다(records-date-groups.ts의 그룹
 * 정렬과 같은 판단). 파싱 불가한 레거시 값도 같은 규칙으로 일관되게 갈린다 — 그럴듯한 날짜로
 * 둔갑시키지 않는다.
 */
export function compareRecordsByAmountDesc(left: AmountSortableRecordRow, right: AmountSortableRecordRow): number {
  const amountDelta = comparableAmount(right.amountKrw) - comparableAmount(left.amountKrw);
  if (amountDelta !== 0) return amountDelta;
  if (left.spentOn !== right.spentOn) return left.spentOn < right.spentOn ? 1 : -1;
  return 0;
}

/**
 * 필터가 이미 걸린 행 배열을 금액 큰 순으로 재배열한 **새 배열**을 돌려준다.
 * 입력은 변형하지 않는다 — 원본 배열은 react-query 캐시/화면 메모의 소유물이다.
 */
export function sortRecordsByAmountDesc<TRow extends AmountSortableRecordRow>(rows: readonly TRow[]): TRow[] {
  return [...rows].sort(compareRecordsByAmountDesc);
}
