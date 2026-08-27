/**
 * 라운드 41 UX-S: 엑셀 가져오기 **검수 화면**(app/import/[importJobId].tsx)의 판정·문구 단일 소스.
 *
 * 왜 모듈인가: 검수 화면이 말해야 하는 규칙 대부분은 **서버 규칙**이다.
 * `apps/api/src/onboarding/import-pipeline.service.ts`의 `updateImportRow`는
 * `validationStatus !== "valid"`인 행의 `selected`를 **무조건 false로 되돌리고**(같은 파일 192줄),
 * `confirmImport`도 그런 행을 가져오기 대상에서 제외한다(233줄). 그런데 화면은 그 행을 다른 행과
 * 똑같은 체크박스로 그려 놓아서, 눌러도 아무 일이 없는 **침묵하는 컨트롤**이었다. 그 판정을 화면
 * JSX 안에 흩어 두면 서버 규칙과 다시 갈리므로, 여기 순수 함수로 모아 두고 화면은 꽂기만 한다.
 *
 * react / react-native import 없음 -- vitest에서 바로 단위 테스트한다
 * (src/expenses/records-list-view.ts와 같은 관례).
 */

import { formatKrw } from "../money";

/** `ImportRow`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ImportPreviewRow = {
  id: string;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  confidence: number;
  selected: boolean;
  validationStatus: string;
};

/**
 * 서버가 "가져올 수 있다"고 보는 유일한 값. 나머지(missing_date/invalid_date/missing_item_name/
 * invalid_amount/low_confidence_duplicate_candidate...)는 전부 확정 불가다 -- 목록을 여기에
 * 나열하지 않는 이유는, 서버가 새 사유를 하나 더 만들어도 화면이 자동으로 "잠금" 쪽에 서기
 * 때문이다(모르는 사유를 선택 가능으로 열어 두면 눌러도 침묵하는 옛 버그가 되돌아온다).
 */
export const IMPORT_ROW_VALID_STATUS = "valid";

/** 신뢰도 배지 임계값 (화면에서 옮겨 온 기존 값). */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * 확정 불가 행에 붙는 안내. 서버 규칙을 화면이 **말해 주는** 문장이다: 앱 안에서는 고칠 수 없고
 * (검수 화면에 편집 UI가 없다) 원본 파일을 고쳐 다시 올리는 것이 유일한 길이다.
 */
export const IMPORT_ROW_LOCKED_MESSAGE = "이 행은 가져올 수 없어요 · 원본 파일에서 고친 뒤 다시 올려 주세요";

/** 잠금 표시의 스크린리더 라벨 접두. 체크박스가 아니라는 사실을 먼저 알린다. */
export const IMPORT_ROW_LOCKED_A11Y_PREFIX = "가져올 수 없는 행";

/** 품목명/금액/날짜가 비어 있을 때의 자리 문구 (없는 값을 지어내지 않는다). */
export const IMPORT_ROW_MISSING_ITEM_NAME = "품목명을 확인해 주세요";
export const IMPORT_ROW_MISSING_AMOUNT = "금액을 확인해 주세요";
export const IMPORT_ROW_MISSING_DATE = "날짜를 확인해 주세요";

/** 이 행을 확정(가져오기)할 수 있는가 -- 서버 `validationStatusForImportRow`와 같은 판정. */
export function isImportRowConfirmable(row: ImportPreviewRow): boolean {
  return row.validationStatus === IMPORT_ROW_VALID_STATUS;
}

/** 확인이 필요한(=확정 불가) 행 수. 필터 칩과 헤더 카드가 같은 수를 쓴다. */
export function countImportRowsNeedingAttention(rows: readonly ImportPreviewRow[]): number {
  return rows.reduce((count, row) => (isImportRowConfirmable(row) ? count : count + 1), 0);
}

/** 확정 가능한 행 중 선택된 행의 id -- 확정 요청 본문. */
export function confirmableSelectedRowIds(rows: readonly ImportPreviewRow[]): string[] {
  return rows.filter((row) => isImportRowConfirmable(row) && row.selected).map((row) => row.id);
}

/**
 * 행 부제. 날짜를 보여 주는 이유: 같은 품목명·같은 금액이 여러 줄인 파일(정기 구매)에서 날짜가
 * 없으면 어떤 줄이 무엇인지 구분할 수 없다. 포맷은 기록 탭 행 부제와 같은 "8월 27일" 꼴이다.
 * ISO가 아닌 값은 그대로 통과시킨다(허위 표시보다 원본이 정직하다 -- formatSpentOn과 같은 규칙).
 */
export function formatImportRowDate(parsedDate?: string): string {
  const raw = parsedDate?.trim();
  if (!raw) return IMPORT_ROW_MISSING_DATE;
  const parts = raw.split("-");
  if (parts.length !== 3) return raw;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return raw;
  return `${month}월 ${day}일`;
}

/** 행에 그릴 제목/금액/부제 한 벌. 스크린리더 라벨도 이 세 문자열에서 나온다(보이는 것과 같다). */
export function importRowDisplay(row: ImportPreviewRow): {
  title: string;
  amountText: string;
  dateText: string;
} {
  return {
    title: row.parsedItemName?.trim() || IMPORT_ROW_MISSING_ITEM_NAME,
    amountText: row.parsedAmountKrw ? formatKrw(row.parsedAmountKrw) : IMPORT_ROW_MISSING_AMOUNT,
    dateText: formatImportRowDate(row.parsedDate)
  };
}

export type ImportRowBadge = { label: string; tone: "warning" };

/**
 * 행 배지. 확정 가능한 행에는 붙지 않는다(예전 화면과 같다). 확정 불가 행은 배지 대신 잠금 안내가
 * 본문으로 붙으므로, 낮은 신뢰도/중복 후보만 배지로 남는다.
 */
export function importRowBadge(row: ImportPreviewRow): ImportRowBadge | null {
  const isLowConfidence =
    row.confidence < LOW_CONFIDENCE_THRESHOLD || row.validationStatus === "low_confidence_duplicate_candidate";
  if (isLowConfidence) return { label: "낮은 신뢰도 · 중복 확인 필요", tone: "warning" };
  if (!isImportRowConfirmable(row)) return { label: "확인이 필요해요", tone: "warning" };
  return null;
}

/* ------------------------------------------------------------------ 필터 칩 */

export type ImportRowFilter = "all" | "attention";

/** 칩 라벨. 0건이면 칩 자체를 그리지 않으므로(아래 shouldShowAttentionFilter) 항상 1 이상이다. */
export function attentionFilterChipLabel(attentionCount: number): string {
  return `확인 필요 ${attentionCount}건만 보기`;
}

/** 확인 필요 행이 하나도 없으면 칩을 내지 않는다 -- 누를 수 없는 칩은 소음이다. */
export function shouldShowAttentionFilter(attentionCount: number): boolean {
  return attentionCount > 0;
}

export function filterImportRows<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  filter: ImportRowFilter
): TRow[] {
  return filter === "attention" ? rows.filter((row) => !isImportRowConfirmable(row)) : [...rows];
}

/**
 * 필터를 켰는데 화면이 비었을 때의 문구. 전체가 비어 있는 경우(EmptyStateCard)와 구분한다 --
 * "가져올 항목이 없어요"는 필터 때문에 비었을 때는 사실이 아니다.
 */
export const IMPORT_ATTENTION_FILTER_EMPTY_TEXT = "확인이 필요한 행이 없어요";

/* -------------------------------------------------------- 낙관적 토글/롤백 */

/**
 * 체크 토글의 낙관적 갱신. 규칙 두 가지.
 *  1) 확정 불가 행은 **뒤집지 않는다**. 서버가 어차피 selected를 false로 되돌리므로(위 주석),
 *     낙관적으로 체크해 두면 잠깐 켜졌다가 재조회 때 꺼지는 거짓 체크가 된다.
 *  2) 아무것도 바뀌지 않으면 **같은 배열 참조를 그대로** 돌려준다 -- 캐시가 새 객체로 갈아
 *     끼워지지 않아 FlatList 행 memo가 깨지지 않는다.
 */
export function toggleImportRowSelection<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  rowId: string
): TRow[] | readonly TRow[] {
  const target = rows.find((row) => row.id === rowId);
  if (!target || !isImportRowConfirmable(target)) return rows;
  return rows.map((row) => (row.id === rowId ? { ...row, selected: !row.selected } : row));
}

/** 일괄 선택/해제가 쓰는 절대값 세터(토글과 달리 목표 상태를 못 박는다). */
export function setImportRowSelection<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  rowId: string,
  selected: boolean
): TRow[] | readonly TRow[] {
  const target = rows.find((row) => row.id === rowId);
  if (!target || !isImportRowConfirmable(target) || target.selected === selected) return rows;
  return rows.map((row) => (row.id === rowId ? { ...row, selected } : row));
}

/**
 * 실패 롤백. onMutate가 찍어 둔 스냅샷을 되돌리되, **그 행 하나만** 되돌린다: 롤백하는 사이에
 * 다른 행의 토글이 성공해 있을 수 있는데 스냅샷을 통째로 덮으면 그 성공까지 지워진다.
 * 스냅샷에 없던 행(그 사이 목록이 갱신됨)이면 손대지 않는다.
 */
export function rollbackImportRowSelection<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  rowId: string,
  snapshot: readonly ImportPreviewRow[]
): TRow[] | readonly TRow[] {
  const previous = snapshot.find((row) => row.id === rowId);
  if (!previous) return rows;
  const current = rows.find((row) => row.id === rowId);
  if (!current || current.selected === previous.selected) return rows;
  return rows.map((row) => (row.id === rowId ? { ...row, selected: previous.selected } : row));
}

/* --------------------------------------------------------- 전체 선택/해제 */

export type ImportBulkSelectionPlan = {
  /** 이번 실행이 만들려는 상태. */
  nextSelected: boolean;
  /** 실제로 PATCH를 보내야 하는 행 id (이미 그 상태인 행은 요청하지 않는다). */
  targetRowIds: string[];
};

/**
 * "전체 선택/해제"가 보낼 요청 목록.
 *
 * 왜 순차인가: 서버 계약에 **일괄 PATCH가 없다**
 * (apps/api/src/imports/imports.controller.ts는 `PATCH imports/:importJobId/rows/:rowId` 단건만
 * 노출한다 -- 129줄). 그래서 화면은 이 목록을 순차로 PATCH하고 진행 표시를 띄운다. 서버에 일괄
 * 엔드포인트가 생기면 이 함수의 `targetRowIds`를 그대로 본문에 실으면 되므로 호출부는 그대로다.
 *
 * 확정 불가 행은 애초에 대상에서 뺀다 -- 서버가 false로 되돌릴 요청을 2,000번 보낼 이유가 없다.
 */
export function buildImportBulkSelectionPlan(rows: readonly ImportPreviewRow[]): ImportBulkSelectionPlan {
  const confirmable = rows.filter(isImportRowConfirmable);
  const nextSelected = confirmable.some((row) => !row.selected);
  return {
    nextSelected,
    targetRowIds: confirmable.filter((row) => row.selected !== nextSelected).map((row) => row.id)
  };
}

/** 버튼 라벨. 하나라도 안 켜진 행이 있으면 "전체 선택", 다 켜져 있으면 "전체 해제". */
export function importBulkSelectionLabel(rows: readonly ImportPreviewRow[]): string {
  return buildImportBulkSelectionPlan(rows).nextSelected ? "전체 선택" : "전체 해제";
}

/** 확정 가능한 행이 하나도 없으면 누를 것이 없다. */
export function canBulkSelectImportRows(rows: readonly ImportPreviewRow[]): boolean {
  return rows.some(isImportRowConfirmable);
}

/** 순차 PATCH 진행 표시. 2,000행 상한이라 "잠시만요"로는 부족하다. */
export function importBulkProgressLabel(done: number, total: number): string {
  return `반영 중이에요 ${done}/${total}`;
}

/* ------------------------------------------------------------ 대상 아이 */

/** `Child`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ImportTargetChildRef = {
  id: string;
  nickname: string;
};

/**
 * 헤더 카드에 적을 **대상 아이 이름**, 또는 적지 않을 때 `null`.
 *
 * 왜 필요한가: 가져오기 작업은 `POST /children/:childId/imports/excel`로 만들어지므로 특정 아이에
 * 묶이는데, 검수 화면에는 그 이름이 어디에도 없었다. 다자녀 가구에서 아이를 바꾼 뒤 예전 검수
 * 링크로 돌아오면 **엉뚱한 아이의 가계부에 수백 건을 확정**할 수 있었다.
 *
 * `["children"]` 캐시를 **읽기만** 한다(useQuery가 아니라 getQueryData -- 새 요청 0). 캐시가
 * 아직 없거나 그 아이를 찾지 못하면 `null`을 돌려 줄 자체를 그리지 않는다: 빈 줄이나 "아이" 같은
 * 자리 문구는 허위 표시다(src/notifications/notification-child-label.ts와 같은 규칙).
 */
export function resolveImportTargetChildName(
  childId: string | null | undefined,
  children: readonly ImportTargetChildRef[] | null | undefined
): string | null {
  if (!childId || !children) return null;
  const match = children.find((child) => child.id === childId);
  const nickname = match?.nickname.trim();
  return nickname ? nickname : null;
}

/** 헤더 카드 한 줄의 라벨(값은 위 이름). */
export const IMPORT_TARGET_CHILD_LABEL = "대상 아이";
