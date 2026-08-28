/**
 * 라운드 41 UX-S: 엑셀 가져오기 **검수 화면**(app/import/[importJobId].tsx)의 판정·문구 단일 소스.
 *
 * 왜 모듈인가: 검수 화면이 말해야 하는 규칙 대부분은 **서버 규칙**이다.
 * `apps/api/src/onboarding/import-pipeline.service.ts`의 `updateImportRow`는 PATCH마다
 * `userReviewed: true`를 세운 뒤 상태를 다시 계산하고(189-192줄), 그렇게 계산한 상태가 여전히
 * "valid"가 아니면 `selected`를 무조건 false로 되돌린다. `confirmImport`도 valid가 아닌 행을
 * 가져오기 대상에서 제외한다(233줄).
 *
 * 그 규칙을 화면 JSX 안에 흩어 두면 서버와 다시 갈린다 -- 실제로 두 번 갈렸다:
 *  - 처음엔 모든 행을 똑같은 체크박스로 그려서, 눌러도 아무 일이 없는 **침묵하는 컨트롤**이
 *    2,000행 목록에 섞여 있었다(UX-S가 고침);
 *  - 그 수정이 이번엔 너무 넓게 잠가서, `userReviewed`만 세우면 valid가 되는 **검토 가능** 행
 *    두 종류까지 가져올 수 없게 만들고 거짓 안내를 붙였다(라운드 41 K-1이 고침).
 * 그래서 판정은 전부 여기 순수 함수로 모으고 화면은 꽂기만 한다.
 *
 * react / react-native import 없음 -- vitest에서 바로 단위 테스트한다
 * (src/expenses/records-list-view.ts와 같은 관례).
 */

import { IMPORT_STUB_CODE_PREFIX } from "../categories";
import { formatKrw } from "../money";

/** `ImportRow`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ImportPreviewRow = {
  id: string;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  /**
   * 라운드 65 A(#2): 서버는 이 값을 진작부터 내려주고 있었는데(`toImportRowDto`) 화면이 한 번도
   * 그리지 않았다 — 승인 대상의 절반이 미리보기에 없었다는 뜻이다(DNC-012가 지키려는 것이
   * "미리보기와 승인"이다).
   */
  categoryId?: string;
  confidence: number;
  selected: boolean;
  validationStatus: string;
};

/**
 * 서버가 "지금 이대로 가져갈 수 있다"고 보는 유일한 값
 * (`validationStatusForImportRow` -> "valid").
 */
export const IMPORT_ROW_VALID_STATUS = "valid";

/**
 * 라운드 41 K-1: **검토하면 가져올 수 있는** 상태 두 가지.
 *
 * 서버 규칙(import-pipeline.service.ts:430-431)은 이 둘을 `!row.userReviewed`일 때만 매긴다:
 *
 *     if (!row.userReviewed && row.duplicateCandidateExpenseId) return "duplicate_candidate";
 *     if (!row.userReviewed && Number(row.confidence) < 0.7) return "low_confidence_duplicate_candidate";
 *
 * 그리고 `updateImportRow`는 어떤 PATCH에서도 `userReviewed: true`를 세운 뒤 상태를 다시
 * 계산한다(같은 파일 189-192줄). 즉 이 두 행은 **체크 한 번이면 valid가 되어 가져올 수 있다** --
 * 사람이 "중복 아니에요 / 이거 맞아요"라고 말해 주는 것이 서버가 기다리는 전부다.
 *
 * 이전 판(UX-S)은 이 둘을 `validationStatus !== "valid"` 한 줄로 잠가 버려서, 그 행들을 가져올
 * 방법이 화면에서 사라졌고 "원본 파일에서 고친 뒤 다시 올려 주세요"라는 **거짓 안내**까지 붙었다
 * (같은 파일을 다시 올리면 판정도 똑같다). 그래서 상태를 셋으로 나눈다.
 */
export const IMPORT_ROW_REVIEWABLE_STATUSES = ["duplicate_candidate", "low_confidence_duplicate_candidate"] as const;

const reviewableStatusSet: ReadonlySet<string> = new Set<string>(IMPORT_ROW_REVIEWABLE_STATUSES);

/** 신뢰도 배지 임계값 (화면에서 옮겨 온 기존 값 -- 서버의 0.7과 같다). */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * 행 하나의 세 갈래 판정.
 *  - `"valid"`      : 그냥 체크하면 된다.
 *  - `"reviewable"` : 체크가 곧 "확인했어요"다 -- 서버가 valid로 다시 계산해 준다.
 *  - `"locked"`     : 앱 안에서 고칠 방법이 없다(파싱 오류 등). 원본을 고쳐 다시 올려야 한다.
 *
 * 모르는 새 상태는 **`"locked"`**로 떨어진다(보수적 기본값): 서버가 사유를 하나 더 만들어도
 * 화면이 선택 가능한 척하지 않는다. 눌러도 아무 일이 없는 침묵하는 컨트롤이 되돌아오는 것보다,
 * 잠금 안내가 하나 더 붙는 쪽이 덜 나쁘다.
 */
export type ImportRowSelectability = "valid" | "reviewable" | "locked";

export function importRowSelectability(row: ImportPreviewRow): ImportRowSelectability {
  if (row.validationStatus === IMPORT_ROW_VALID_STATUS) return "valid";
  if (reviewableStatusSet.has(row.validationStatus)) return "reviewable";
  return "locked";
}

/**
 * 정말로 확정 불가한 행에 붙는 안내. 서버 규칙을 화면이 **말해 주는** 문장이다: 앱 안에서는
 * 고칠 수 없고(검수 화면에 편집 UI가 없다) 원본 파일을 고쳐 다시 올리는 것이 유일한 길이다.
 * 이 문장은 이제 `"locked"` 행에만 붙는다 -- 검토 가능 행에 붙으면 거짓말이었다(K-1).
 */
export const IMPORT_ROW_LOCKED_MESSAGE = "이 행은 가져올 수 없어요 · 원본 파일에서 고친 뒤 다시 올려 주세요";

/** 잠금 표시의 스크린리더 라벨 접두. 체크박스가 아니라는 사실을 먼저 알린다. */
export const IMPORT_ROW_LOCKED_A11Y_PREFIX = "가져올 수 없는 행";

/**
 * 검토 가능 행에 붙는 안내. 체크가 무엇을 뜻하는지(=확인 완료) 한 줄로 말한다.
 * 이 행들은 체크박스를 그대로 갖는다 -- 누르면 서버가 valid로 다시 계산해 준다.
 */
export const IMPORT_ROW_REVIEW_MESSAGE = "확인하면 가져올 수 있어요 · 체크하면 확인한 것으로 볼게요";

/** 품목명/금액/날짜가 비어 있을 때의 자리 문구 (없는 값을 지어내지 않는다). */
export const IMPORT_ROW_MISSING_ITEM_NAME = "품목명을 확인해 주세요";
export const IMPORT_ROW_MISSING_AMOUNT = "금액을 확인해 주세요";
export const IMPORT_ROW_MISSING_DATE = "날짜를 확인해 주세요";

/**
 * 이 행을 **지금 이대로** 확정(가져오기)할 수 있는가 -- 서버 `confirmImport`가 가져가는 조건과
 * 같다(import-pipeline.service.ts:233은 valid만 가져간다). 검토 가능 행은 여기서 false다:
 * 체크가 서버에 반영돼 valid가 된 뒤에야 확정 본문에 실린다.
 */
export function isImportRowConfirmable(row: ImportPreviewRow): boolean {
  return importRowSelectability(row) === "valid";
}

/** 체크 한 번이면 valid가 되는 행인가 (K-1의 ②). */
export function isImportRowReviewable(row: ImportPreviewRow): boolean {
  return importRowSelectability(row) === "reviewable";
}

/**
 * 체크박스를 그려도 되는 행인가 = ① valid + ② 검토 가능. 토글·일괄 선택이 쓰는 판정이다
 * (확정 본문은 `isImportRowConfirmable` 쪽을 쓴다 -- 둘을 섞으면 서버가 조용히 버리는 id를
 * 다시 실어 보내게 된다).
 */
export function isImportRowSelectable(row: ImportPreviewRow): boolean {
  return importRowSelectability(row) !== "locked";
}

/** 행 아래에 붙일 안내 문장, 없으면 null. valid 행에는 아무것도 붙지 않는다. */
export function importRowNotice(row: ImportPreviewRow): string | null {
  const selectability = importRowSelectability(row);
  if (selectability === "reviewable") return IMPORT_ROW_REVIEW_MESSAGE;
  if (selectability === "locked") return IMPORT_ROW_LOCKED_MESSAGE;
  return null;
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
 * 라운드 42 L-2 — **체크는 켜졌는데 서버가 아직 valid로 다시 계산해 주지 않은** 검토 가능 행 수.
 *
 * 왜 세는가: 검토 가능 행을 체크하면 낙관 갱신은 `selected`만 뒤집고(K-1의 규칙 그대로)
 * `validationStatus`는 PATCH 응답이 와야 valid로 바뀐다. 그 왕복 사이에 확정을 누르면 그 행들은
 * `confirmableSelectedRowIds`에서 빠진 채 요청이 나가고, 서버는 잡을 `confirmed`로 넘긴다 --
 * 그 뒤로는 편집도 재확정도 받지 않으므로(IMPORT_NOT_EDITABLE) 그 행들을 **영원히** 가져올 수
 * 없다. 되돌릴 수 없는 손실이라, 화면은 이 수가 0이 될 때까지 확정을 열지 않는다.
 */
export function countUnappliedReviewedRows(rows: readonly ImportPreviewRow[]): number {
  return rows.reduce((count, row) => (row.selected && isImportRowReviewable(row) ? count + 1 : count), 0);
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
 * 행 배지 -- **왜** 이 행이 눈에 띄는지 한 마디로 말한다. 무엇을 할 수 있는지(체크하면 되는지,
 * 원본을 고쳐야 하는지)는 배지가 아니라 `importRowNotice`의 문장이 말한다. valid 행에는 아무
 * 배지도 붙지 않는다(예전 화면과 같다).
 */
export function importRowBadge(row: ImportPreviewRow): ImportRowBadge | null {
  const isLowConfidence =
    row.confidence < LOW_CONFIDENCE_THRESHOLD || row.validationStatus === "low_confidence_duplicate_candidate";
  if (isLowConfidence) return { label: "낮은 신뢰도 · 중복 확인 필요", tone: "warning" };
  if (row.validationStatus === "duplicate_candidate") return { label: "이미 있는 지출과 같아 보여요", tone: "warning" };
  if (!isImportRowConfirmable(row)) return { label: "확인이 필요해요", tone: "warning" };
  return null;
}

/* -------------------------------------------------------------------- 분류 */

/**
 * 라운드 65 A(#2) — **검수 화면이 분류를 보여주지도, 고치지도 못했다.**
 *
 * 서버 `PATCH /imports/:jobId/rows/:rowId`는 `selected`만이 아니라 `categoryId`·
 * `parsedItemName`·`parsedAmountKrw`를 받아 다시 검증한다(import.dto.ts). 그런데 화면은 그 세
 * 필드를 **읽은 값 그대로 되돌려 보낼 뿐**이었고, 행 카드에는 분류를 그리는 줄조차 없었다.
 *
 * 그 사이 실제 카드 내역은 대부분 스텁 분류로 떨어진다: 분류는 품목명 **키워드 표**가 정하는데
 * (import-parser.ts의 CATEGORY_KEYWORDS) 카드 적요는 `쿠팡`·`이마트`·`올리브영` 같은 가맹점
 * 이름이라 어느 낱말과도 맞지 않고, 맞지 않은 행은 전부 `가져오기 기본`으로 간다. 그 분류는
 * `selectable=false`라 기록 탭 필터 칩이 없고 리포트에서도 한 덩어리로 뭉친다. 200행을
 * 가져오면 대부분이 그 상태인데 **승인 전에는 볼 수도 없고** 승인 뒤에는 200건을 하나씩 열어
 * 고쳐야 했다.
 *
 * 이번 몫은 두 가지다: **보이게 하고**, **고칠 수 있게**. 품목명·금액 편집은 범위 밖이다
 * (2,000행 가상화 목록 안의 텍스트 입력은 초점·키보드 문제를 함께 데려온다 — 그리고 잠금 행
 * 자체는 같은 라운드의 #1이 없앤다).
 */

/** 칩 하나 = 고를 수 있는 분류 하나. 목록은 `selectableCategories`를 지난 것만 넘긴다. */
export type ImportCategoryOption = { id: string; label: string };

export const IMPORT_ROW_CATEGORY_LABEL = "분류";

/**
 * 이 행의 분류가 **앱이 내미는 목록에 없을 때** 붙는 한 줄. 실질적으로는 가져오기 스텁
 * (`가져오기 기본`)이거나 운영자가 노출을 끈 분류다. "틀렸다"고 말하지 않는다 — 자동 분류가
 * 못 찾았다는 사실과 지금 할 수 있는 일만 말한다(해요체 DNC-018).
 */
export const IMPORT_ROW_CATEGORY_STUB_HINT = "자동으로 분류하지 못했어요 · 분류를 골라 주세요";

export const IMPORT_ROW_CATEGORY_EDIT_LABEL = "분류 고르기";
export const IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL = "분류 목록 닫기";

/** 펼침 상태에 따른 버튼 문구(두 문구가 갈리지 않도록 한 자리에서 고른다). */
export function importRowCategoryEditLabel(expanded: boolean): string {
  return expanded ? IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL : IMPORT_ROW_CATEGORY_EDIT_LABEL;
}

/**
 * `categoryId` -> 이름, **모르면 null**.
 *
 * `buildCategoryNameLookup`(src/categories.ts)을 쓰지 않는 이유: 그쪽은 못 찾은 id를 "기타"로
 * 떨어뜨린다. 이미 저장된 지출의 라벨에는 그게 맞지만, 여기서는 **아직 승인하지 않은 행**의
 * 분류라 모르는 값을 "기타"라고 단언하면 사용자가 승인할 대상을 잘못 읽는다. 모르면 줄 자체를
 * 만들지 않는 편이 정직하다(대상 아이 줄과 같은 규칙).
 */
export function importCategoryNameResolver(
  categories: readonly { id: string; name: string }[] | null | undefined
): (categoryId: string) => string | null {
  const nameById = new Map<string, string>();
  for (const category of categories ?? []) {
    const name = category?.name?.trim();
    if (category?.id && name) nameById.set(category.id, name);
  }
  return (categoryId: string) => nameById.get(categoryId) ?? null;
}

/**
 * 라운드 65 후속(#8): "이 분류가 **가져오기 스텁**인가"를 답하는 술어를 만든다.
 *
 * 근거는 서버가 내려준 `code`다(`import_stub_default` — 접두사 상수는 src/categories.ts의
 * `IMPORT_STUB_CODE_PREFIX` 한 곳). 이름이나 목록 소속으로 추측하지 않는다: 그 둘은 같은 답을
 * 내야 할 이유가 없다.
 *
 * `code`를 모르는 값(응답에 없거나 목록에 없는 id)은 **false**다 — 모르면 아무 말도 하지
 * 않는다(이 모듈의 "모르면 줄을 만들지 않는다"와 같은 규율).
 */
export function importStubCategoryPredicate(
  categories: readonly { id: string; code?: string | null }[] | null | undefined
): (categoryId: string) => boolean {
  const stubIds = new Set<string>();
  for (const category of categories ?? []) {
    if (category?.id && (category.code ?? "").startsWith(IMPORT_STUB_CODE_PREFIX)) stubIds.add(category.id);
  }
  return (categoryId: string) => stubIds.has(categoryId);
}

export type ImportRowCategoryView = {
  /** 화면에 적을 분류 이름. */
  name: string;
  /**
   * 자동 분류가 못 찾아 **가져오기 스텁**으로 떨어진 행인가. 참이면 "분류를 골라 주세요"가 붙는다.
   *
   * 라운드 65 후속(#8) — 판정 근거가 `options.length > 0`(= 고를 수 있는 목록에 없다)이었다.
   * 그 목록은 별칭·비활성 행을 걸러 낸 **좁힌 목록**이라(src/categories.ts `selectableCategories`),
   * 스텁이 아닌 멀쩡한 분류도 목록 밖으로 떨어질 수 있다 — 서버가 그 분류를 `selectable: false`나
   * `active: false`로 내리는 순간, 이미 그 분류로 잘 분류된 행에까지 "자동으로 분류하지
   * 못했어요"라는 **허위 안내**가 붙는다. 이제 서버가 준 `code`로만 판정한다.
   */
  needsChoice: boolean;
};

/**
 * 행 카드의 분류 줄, 그리지 않을 때 `null`.
 *
 * 이름은 두 곳에서 찾는다: 먼저 **고를 수 있는 목록**(칩과 같은 목록이라 라벨이 칩과 한 글자도
 * 다르지 않다), 없으면 전량 목록의 이름 해석. 둘 다 실패하면 null이다.
 *
 * `isImportStub`은 위 `importStubCategoryPredicate`가 만든 술어다. 넘기지 않으면(구 호출부)
 * 아무 행도 "골라 주세요"를 받지 않는다 — 근거 없이 재촉하는 것보다 침묵이 낫다.
 */
export function importRowCategoryView(
  row: ImportPreviewRow,
  options: readonly ImportCategoryOption[],
  resolveName: ((categoryId: string) => string | null) | null,
  isImportStub: ((categoryId: string) => boolean) | null = null
): ImportRowCategoryView | null {
  const categoryId = row.categoryId?.trim();
  if (!categoryId) return null;

  // 고를 수 있는 목록에 있는 값은 스텁일 수 없다(그 목록이 스텁을 걸러 낸 결과다).
  const offered = options.find((option) => option.id === categoryId);
  if (offered) return { name: offered.label, needsChoice: false };

  const name = resolveName?.(categoryId)?.trim();
  if (!name) return null;
  return { name, needsChoice: isImportStub?.(categoryId) ?? false };
}

/**
 * 이 행의 분류를 지금 고칠 수 있는가.
 *
 * 잠긴 행(`locked`)은 제외한다 — 분류를 바꿔도 그 행이 잠긴 이유(날짜·금액·품목명)는 그대로라
 * 누를 수 있는 척이 된다. 서버가 편집을 받는 상태인지(preview_ready)는 화면이 이미 아는 값이라
 * 호출부가 함께 본다.
 */
export function canEditImportRowCategory(row: ImportPreviewRow): boolean {
  return isImportRowSelectable(row);
}

/**
 * 이미 그 분류인 행에는 PATCH를 보내지 않는다. 서버는 어떤 PATCH에서도 `userReviewed`를
 * 세우므로(import-pipeline.service.ts), 값이 그대로인 요청도 검토 표식을 남긴다 — 사용자가
 * 아무것도 고르지 않은 것과 같은 탭에서 그 표식이 생기면 "확인했어요"의 뜻이 흐려진다.
 */
export function shouldPatchImportRowCategory(row: ImportPreviewRow, categoryId: string): boolean {
  const next = categoryId.trim();
  if (!next) return false;
  return (row.categoryId ?? "") !== next;
}

/**
 * 잠금 카드의 스크린리더 라벨. 잠금 카드는 `accessible` 한 덩어리라(자식 텍스트가 따로 읽히지
 * 않는다) 분류도 이 문자열에 함께 실어야 들린다.
 */
export function importRowCategoryA11ySuffix(category: ImportRowCategoryView | null): string {
  if (!category) return "";
  return `, ${IMPORT_ROW_CATEGORY_LABEL} ${category.name}`;
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
 *  1) **잠긴 행만** 뒤집지 않는다. 서버가 그런 행의 selected를 무조건 false로 되돌리므로,
 *     낙관적으로 체크해 두면 잠깐 켜졌다가 재조회 때 꺼지는 거짓 체크가 된다.
 *     검토 가능 행(K-1의 ②)은 반대로 **반드시 뒤집는다** -- PATCH가 userReviewed를 세워
 *     valid로 만들어 주므로 체크는 진짜로 남는다. validationStatus까지 여기서 미리 고쳐
 *     쓰지는 않는다: 낙관 갱신은 selected 하나뿐이고, 상태 정정은 서버 응답이 한다.
 *  2) 아무것도 바뀌지 않으면 **같은 배열 참조를 그대로** 돌려준다 -- 캐시가 새 객체로 갈아
 *     끼워지지 않아 FlatList 행 memo가 깨지지 않는다.
 */
export function toggleImportRowSelection<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  rowId: string
): TRow[] | readonly TRow[] {
  const target = rows.find((row) => row.id === rowId);
  if (!target || !isImportRowSelectable(target)) return rows;
  return rows.map((row) => (row.id === rowId ? { ...row, selected: !row.selected } : row));
}

/** 일괄 선택/해제가 쓰는 절대값 세터(토글과 달리 목표 상태를 못 박는다). */
export function setImportRowSelection<TRow extends ImportPreviewRow>(
  rows: readonly TRow[],
  rowId: string,
  selected: boolean
): TRow[] | readonly TRow[] {
  const target = rows.find((row) => row.id === rowId);
  if (!target || !isImportRowSelectable(target) || target.selected === selected) return rows;
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
 * 잠긴 행은 애초에 대상에서 뺀다 -- 서버가 false로 되돌릴 요청을 2,000번 보낼 이유가 없다.
 * 반대로 검토 가능 행은 **대상에 포함한다**(K-1): 일괄 선택이 곧 "이 행들 확인했어요"다.
 *
 * 라운드 41 K-9: 호출부는 **화면에 보이는 행**(필터 적용 후)을 넘긴다. 필터를 켜 둔 채 누른
 * 버튼이 보이지 않는 행까지 바꾸면, 사용자가 승인한 적 없는 변경이 조용히 일어난다.
 */
export function buildImportBulkSelectionPlan(rows: readonly ImportPreviewRow[]): ImportBulkSelectionPlan {
  const selectable = rows.filter(isImportRowSelectable);
  const nextSelected = selectable.some((row) => !row.selected);
  return {
    nextSelected,
    targetRowIds: selectable.filter((row) => row.selected !== nextSelected).map((row) => row.id)
  };
}

/**
 * 버튼 라벨. 하나라도 안 켜진 행이 있으면 선택, 다 켜져 있으면 해제.
 *
 * K-9: 필터가 켜져 있으면 "전체"라고 말하지 않는다 -- 이 버튼이 건드리는 것은 지금 화면에
 * 보이는 행뿐이고, 라벨이 그 사실을 그대로 말해야 한다.
 */
export function importBulkSelectionLabel(visibleRows: readonly ImportPreviewRow[], filter: ImportRowFilter): string {
  const scope = filter === "all" ? "전체" : "보이는 행";
  return `${scope} ${buildImportBulkSelectionPlan(visibleRows).nextSelected ? "선택" : "해제"}`;
}

/** 체크할 수 있는 행이 하나도 없으면 누를 것이 없다. */
export function canBulkSelectImportRows(rows: readonly ImportPreviewRow[]): boolean {
  return rows.some(isImportRowSelectable);
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
 * 라운드 41 K-2: 여기 넘기는 `childId`는 반드시 **잡 응답의 `job.childId`**여야 한다. 예전에는
 * 선택 아이 스토어 값을 넘겼는데, 서버가 지출을 붙이는 곳은 `job.childId`다
 * (import-pipeline.service.ts의 confirmImport -> insertExpense(job.childId)). 두 값이 갈리는
 * 순간(아이를 바꾼 뒤 예전 링크로 복귀) 헤더가 **거짓을 단언**했다.
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

/**
 * 라운드 42 L-6 — 잡에는 `childId`가 있는데 그 아이의 이름을 해석하지 못했을 때의 한 줄.
 *
 * 예전에는 이 경우 줄이 그냥 사라졌고, 화면은 **대상 아이를 밝히지 않은 채** 확정 버튼을 열어
 * 뒀다 -- K-2가 겨냥한 "엉뚱한 아이에게 수백 건 확정"과 같은 자리다. 그렇다고 아무 이름이나
 * 지어내거나 선택 아이 스토어 값으로 메울 수는 없으므로(그게 정확히 K-2가 지운 거짓말이다),
 * **모른다는 사실**과 확인할 곳을 말한다. 확정 자체는 막지 않는다: 서버가 지출을 넣는 곳은
 * 어차피 `job.childId`이고, 캐시가 비어 있다는 이유로 정상적인 가져오기를 잠그면 그게 더 나쁘다.
 */
export const IMPORT_TARGET_CHILD_UNKNOWN_TEXT =
  "대상 아이를 확인할 수 없어요. 아이 관리에서 확인 후 진행해 주세요";

/**
 * 헤더 카드에 붙일 **경고 한 줄**, 붙이지 않을 때 `null`.
 *
 * - `childId`가 없다(아직 잡을 못 받았다 · 비세션): 아무 말도 하지 않는다. 모르는 것은 모르는
 *   것이지 문제가 아니고, 비로그인 렌더(IMP-003)를 한 픽셀도 바꾸지 않아야 한다.
 * - 이름을 찾았다: 위 `resolveImportTargetChildName`이 그 이름을 값으로 그린다.
 * - `childId`는 있는데 이름을 못 찾았다(캐시 없음 · 목록에 없는 아이): 이 문장을 낸다.
 */
export function importTargetChildNotice(
  childId: string | null | undefined,
  children: readonly ImportTargetChildRef[] | null | undefined
): string | null {
  if (!childId) return null;
  return resolveImportTargetChildName(childId, children) ? null : IMPORT_TARGET_CHILD_UNKNOWN_TEXT;
}
