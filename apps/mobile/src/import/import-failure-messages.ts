/**
 * 라운드 71 트랙 A — **엑셀 가져오기 여정의 실패가 이름을 얻는 자리.**
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 가져오기는 이 앱에서 사용자가 가장 오래 붙잡고 있는 여정이다(업로드 → 분석 대기 → 최대
 * 2,000행 검수 → 확정 → 되돌리기). 그런데 그 여정의 실패는 화면에서 **문자열 하나**로 접혔다:
 * 검수 화면(app/import/[importJobId].tsx)의 `loadFailedText`("불러오지 못했어요. 잠시 후 다시
 * 시도해 주세요.")가 조회 실패 둘뿐 아니라 **행 편집 실패**와 **최종 확정 실패**에도 그대로
 * 섰다. 뒤의 둘은 조회가 아니다 — "불러오지" 못한 것이 아니라 **저장하지 못한 것**이고, 그
 * 자리에는 [다시 시도]도 없어서 사용자가 할 수 있는 일은 같은 버튼을 다시 누르는 것뿐이었다.
 *
 * **서버는 그 실패마다 이름을 갖고 있다.** import-parser.ts와 import-pipeline.service.ts가
 * 던지는 코드는 아홉이고(아래 스윕 계약), 그중 일곱은 `src/api/api-error.ts`의 표에 없다.
 * 표에 없으므로 `apiErrorMessage`를 지나도 폴백이고, 검수 화면은 애초에 그 함수를 부르지도
 * 않았다.
 *
 * ## 가장 도달하기 쉬운 갈래가 하필 가장 조용했다
 *
 * `import-pipeline.service.ts`는 새 미리보기를 만들 때 **같은 아이의 이전 `preview_ready` 잡을
 * 전부 `cancelled`로 내린다**(아이당 검수 중인 잡은 하나까지 — 라운드 60 리뷰 P2-3). 즉 파일을
 * 다시 올리는 순간 앞 미리보기는 끝난 것이 되고, 그 화면에 남아 있던 사람의 체크는
 * `IMPORT_NOT_EDITABLE`로, 확정은 `IMPORT_NOT_CONFIRMABLE`(확정 CAS)로 떨어진다. 30분치 검수가
 * 어디로 갔는지, 무엇을 하면 되는지 앱은 한 글자도 말하지 않았다. 그 두 코드의 문장이 이
 * 모듈에서 가장 중요한 두 줄이고, 둘 다 **재시도를 권하지 않고 다음에 할 일을 말한다.**
 *
 * ## 왜 `src/api/api-error.ts`의 표를 넓히지 않는가
 *
 * 그 표는 **아웃박스 계약의 소유물**이고 앱 전역에서 중립적으로 읽혀야 하는 코드만 담는다.
 * 같은 코드가 화면마다 다른 사실을 뜻한다는 것이 라운드 70의 판정이고(`FORBIDDEN` 한 코드
 * 아래 서버 문장이 일곱이었다), 그 답은 "표를 좁히는 것이 아니라 화면별 문구"였다. 그래서
 * 판정은 한 벌이고(코드 추출은 `apiErrorCodeOf`를 **그대로 읽는다** — 봉투 파서를 한 벌 더
 * 만들지 않는다), 문구만 이 여정의 것이다.
 *
 * 다만 **이미 표에 있는 코드는 표에서 읽는다**(4단계). `IMPORT_TOO_MANY_ROWS` ·
 * `IMPORT_FILE_TYPE_INVALID`는 라운드 45 UX-Z가 업로드 화면을 위해 이미 세워 둔 줄이라,
 * 여기 다시 적으면 같은 실패를 두 문장이 각자 말하게 된다.
 *
 * ## 판정 순서 — 403 → 이 여정의 코드 → 앱 전역 표 → 오프라인 → 동작별 일반
 *
 * `member-mutation-messages.ts`가 세운 순서 그대로다. 코드가 오프라인보다 먼저인 이유도 같다:
 * **서버가 답을 줬다는 사실 자체**가 연결이 있었다는 뜻이라, 그 경우까지 오프라인으로 말하면
 * 그것이 또 하나의 틀린 안내가 된다. 연결 상태는 화면이 실패 시점에 `isCurrentlyOnline()`으로
 * 한 번 확인해 넘긴다(app/family/index.tsx가 이미 쓰는 배선 — 새 훅을 만들지 않는다). 판정이
 * 불가능한 플랫폼에서는 true라, 어긋나도 기존 일반 문구로 안전하게 떨어진다.
 *
 * ## 종전과 바이트 단위로 같아야 하는 것
 *
 * **모르는 실패와 네트워크 실패**(코드 없는 실패 + 연결은 있다고 답한 경우)는 종전 문장
 * 그대로다. 업로드·되돌리기의 두 폴백이 라운드 45·67이 쓴 그 문자열인 것은 의도한 것이다.
 * 갈라지는 것은 **서버가 이름을 준 실패**와 **오프라인**뿐이다.
 *
 * 행 편집·확정의 폴백만 예외적으로 바뀐다 — 그 두 자리의 종전 문장이 조회 실패의 것("불러오지
 * 못했어요")이었기 때문이다. 동사를 고치는 것이 이 트랙의 ⓑ이고, 그 자리를 바이트 단위로
 * 유지하는 것은 곧 틀린 동사를 유지하는 것이다.
 *
 * react-native / expo-router import 없이 유지해서 vitest에서 그대로 단위 테스트한다
 * (member-mutation-messages.ts · invite-accept-messages.ts와 같은 규율).
 */

import { apiErrorCodeOf, apiErrorMessageForCode } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/**
 * 여정의 어느 걸음이 실패했는가. 문구를 고르는 데만 쓰이고, 서버 요청·판정에는 관여하지 않는다.
 *  - `upload`  : 파일 업로드(app/import/index.tsx)
 *  - `row_edit`: 검수 화면의 행 체크·분류 편집(PATCH)
 *  - `confirm` : 마지막 [선택한 항목 가져오기]
 *  - `undo`    : 확정한 가져오기 되돌리기(라운드 67 #3)
 */
export type ImportFailureKind = "upload" | "row_edit" | "confirm" | "undo";

/**
 * ⚠ **테스트 전용 export**(라운드 71 리뷰 S-8). 화면은 걸음 이름을 리터럴로 넘기므로 이 목록을
 * 부르지 않는다 — 쓰는 곳은 "네 걸음 전부에서 이렇게 보인다"를 도는 계약뿐이다
 * (import-failure-messages.test.ts). **지우지 않는다**: 걸음이 하나 늘면 그 계약이 자동으로
 * 새 걸음까지 돌아야 하고, 목록을 테스트에 옮겨 적는 순간 그 자동이 사라진다.
 */
export const IMPORT_FAILURE_KINDS = ["upload", "row_edit", "confirm", "undo"] as const;

/**
 * --- 동작별 일반 문구(모르는 실패 · 네트워크 실패) ---
 *
 * 앞의 둘은 종전 값 **그대로**다(라운드 45 UX-Z · 라운드 67 #3). 뒤의 둘만 동사가 바뀐다 —
 * 종전에는 조회 실패 문구가 그 자리에 섰다.
 */
export const IMPORT_UPLOAD_FAILED_MESSAGE = "업로드하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const IMPORT_UNDO_FAILED_MESSAGE = "되돌리지 못했어요. 잠시 후 다시 시도해 주세요.";
/** 검수 중의 체크·분류 편집은 **저장**이다. "불러오지"는 이 자리의 동사가 아니다. */
export const IMPORT_ROW_EDIT_FAILED_MESSAGE = "검수 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
/** 마지막 버튼도 마찬가지다 — 실패한 것은 조회가 아니라 가져오기다. */
export const IMPORT_CONFIRM_FAILED_MESSAGE = "가져오지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 403 전용 문구.
 *
 * 서버는 이 여정의 네 걸음 전부에 편집 권한을 요구한다(`requireImportJobAccess(user, id, true)`
 * → `requireChildAccess` → `FORBIDDEN` — apps/api/src/onboarding/child-access.service.ts).
 * 화면 앞단의 역할 게이트(`useExpenseEntryGate`)가 대부분 먼저 막지만, **역할이 그 사이에 바뀐
 * 사람**은 여기까지 온다. 앱 전역 표의 `FORBIDDEN` 문구("권한이 없어 처리하지 못했어요…")는
 * 중립적으로 넓게 쓰인 문장이라 이 여정에서는 사용자가 알아야 할 사실을 말하지 못한다 —
 * 라운드 70의 판정("판정은 한 벌, 문구는 화면별") 그대로 여기서 좁혀 말한다.
 *
 * 재시도를 권하지 않는다: 다시 눌러도 같은 403이다.
 *
 * ⚠️ 라운드 71 접점 메모 — 트랙 E가 `src/family/record-permissions.ts`에 화면 머리말용 보기 전용
 * 상수를 세우는 중이다. 이 문장은 그 상수가 확정되기 전의 **이 트랙 자체 문구**이고, 형식은
 * `BUDGET_VIEW_ONLY_MESSAGE`("보기 전용으로 참여하고 있어요. 예산은 관리자·공동부모가 정할 수
 * 있어요.")를 그대로 따랐다. E가 머리말 계열을 확정하면 이 한 줄이 그 계열을 읽도록 잇는 것이
 * 남은 일이다(값은 같은 사실을 말하므로 화면 동작은 바뀌지 않는다).
 */
export const IMPORT_FORBIDDEN_MESSAGE = "보기 전용으로 참여하고 있어요. 가져오기는 관리자·공동부모가 할 수 있어요.";

/**
 * --- 이 여정의 코드 → 문구 ---
 *
 * 전부 `apps/api/src/imports/import-parser.ts`와
 * `apps/api/src/onboarding/import-pipeline.service.ts`가 던지는 코드다(아래 스윕 계약이 그 두
 * 파일을 실제로 읽어 대조한다). 서버 원문은 넷이 영어이고 하나는 한 코드 아래 네 문장이라
 * (`IMPORT_FILE_INVALID`), 어느 쪽도 그대로 화면에 낼 수 없다 — 문구는 앱이 책임진다는
 * `api-error.ts` 머리말의 판정 그대로다.
 *
 * 일곱 줄 어디에도 "잠시 후 다시" · "다시 시도"가 없다. 전부 **다시 눌러도 같은 답이 오는
 * 사실**이고, 그때 재시도를 권하는 것은 안내가 아니라 시간 낭비다(DNC-018 — 대신 다음에
 * 무엇을 하면 되는지를 말한다).
 */
export const IMPORT_FAILURE_MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  /**
   * 400 — 파일은 왔는데 읽을 내용이 없다. 서버는 이 한 코드로 네 갈래를 말한다("가져올 데이터를
   * 찾을 수 없어요." · "엑셀 파일을 읽을 수 없어요." · "엑셀 파일에 시트가 없어요." ·
   * "가져오기 파일을 읽을 수 없어요."). 어느 갈래인지 앱은 알 수 없으므로 **단정하지 않고**
   * 넷을 함께 덮는 한 문장을 준다(invite-accept-messages.ts의 "…일 수 있어요" 규율과 같다).
   * 이 여정에서 **사용자가 실제로 고칠 수 있는** 유일한 실패라 문장이 확인할 것을 짚는다.
   */
  IMPORT_FILE_INVALID: "파일에서 가져올 내용을 읽지 못했어요. 엑셀·CSV 파일이 맞는지, 내용이 비어 있지 않은지 확인해 주세요.",
  /** 400 — 요청에 파일이 실리지 않았다(선택이 취소됐거나 캐시 복사가 비었다). */
  IMPORT_FILE_REQUIRED: "파일이 전달되지 않았어요. 파일을 다시 골라 주세요.",
  /**
   * 400 — **이 트랙의 본체.** 잡이 `preview_ready`가 아니게 됐다. 절대다수는 "같은 아이의 파일을
   * 새로 올려 앞 잡이 `cancelled`로 내려간" 경우다. 그래서 문장이 그 사실을 함께 말한다 —
   * 30분치 검수가 어디로 갔는지 모른 채 같은 버튼을 다시 누르게 두지 않는다.
   */
  IMPORT_NOT_EDITABLE:
    "이 미리보기는 끝나서 더 고칠 수 없어요. 같은 아이의 파일을 새로 올리면 앞 미리보기는 정리돼요. 파일을 다시 올려 주세요.",
  /** 404 — 그 행이 이 잡에 없다(잡이 정리됐거나 화면이 낡은 목록을 들고 있다). */
  IMPORT_ROW_NOT_FOUND: "이 행은 미리보기에 남아 있지 않아요. 화면을 새로 열어 확인해 주세요.",
  /**
   * 400 — 마지막 버튼이 받는 답. 상태 검사와 확정 CAS 두 자리가 같은 코드로 던진다
   * (동시에 두 기기가 확정을 눌러 한쪽이 진 경우까지 여기로 온다). 검수 내용이 남지 않는다는
   * 사실을 감추지 않는다 — 그것이 사용자가 다음 행동을 정하는 데 필요한 유일한 정보다.
   */
  IMPORT_NOT_CONFIRMABLE: "이 미리보기는 끝나서 가져올 수 없어요. 검수한 내용은 남지 않으니 파일을 다시 올려 주세요.",
  /**
   * 400 — 되돌리기. 서버 원문이 이미 해요체라 **그 문장을 그대로 쓰고**(같은 실패가 표면마다
   * 다르게 들리지 않게) 왜 그런지 한 줄을 덧붙인다. 단정하지 않는다: 이미 되돌렸을 수도,
   * 확정되지 않은 잡일 수도 있다.
   */
  IMPORT_NOT_UNDOABLE: "되돌릴 수 있는 가져오기가 아니에요. 이미 되돌렸거나 아직 확정되지 않은 가져오기일 수 있어요.",
  /** 404 — 잡 자체가 없다(파기됐거나 링크가 낡았다). 되돌리기·검수·확정 어디서나 올 수 있다. */
  IMPORT_JOB_NOT_FOUND: "이 가져오기를 찾을 수 없어요. 파일을 다시 올려 주세요."
};

const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/**
 * --- 라운드 106 T3 — **확정 실패가 어느 행 때문인지 말한다** ---
 *
 * ## 무엇이 남아 있었나
 * 위 표는 "무슨 실패인가"까지 답했지만, 이 여정에서 가장 비싼 실패에는 답이 하나 더 필요하다:
 * 확정은 배치 한 트랜잭션이라 **한 행이 걸리면 파일 전체가 롤백**된다(서버
 * `confirmImport` 주석). 수백 행을 검수한 사람이 받던 것은 코드 하나가 고른 한 문장뿐이었고,
 * 그 문장으로는 **어느 행을 고쳐야 다시 누를 수 있는지**를 알 수 없었다(라운드 103 리뷰 M-2의
 * 이월).
 *
 * 서버는 이제 그 행들을 기존 봉투의 `details`에 싣는다(계약 변경 0건 — `errorResponseSchema`의
 * `details`는 처음부터 있던 칸이다). 여기서 하는 일은 그 값을 **문장으로 바꾸는 것 하나**이고,
 * 문장은 이 모듈에서만 만들어진다 — 화면은 종전과 똑같이 `importFailureMessage` 한 줄을
 * 그리고 읽는다(그래서 이 라운드의 화면 변경은 0줄이고, 낭독 배선도 무접촉이다).
 *
 * ## 왜 별도 문장이 아니라 **같은 문장의 뒤**인가
 * 코드가 고른 문장이 "무엇을 고쳐야 하는가"를 이미 말한다(예: `EXPENSE_CATEGORY_INVALID` →
 * "카테고리를 다시 선택해 주세요."). 여기서 더하는 사실은 **어디를**과 **아무것도 들어가지
 * 않았다** 둘뿐이고, 그 둘이 앞 문장과 떨어져 다른 노드에 서면 스크린리더가 둘을 다른 사건으로
 * 읽는다. 한 문장이면 화면·소리·순서가 종전 그대로다.
 *
 * ## ⚠️ "파일의 N번째 줄"이라고 말하지 않는다
 * 서버 `rowIndex`는 파서가 **빈 줄을 걷어낸 데이터 행**에 0부터 매긴 자리다(머리글 행도 빠져
 * 있다 — apps/api/src/imports/import-parser.ts). 그 값에 1을 더한 수는 **검수 목록에서 그 행이
 * 서 있는 자리**와는 정확히 같지만(목록은 언제나 `rowIndex` 오름차순이다) 원본 파일의 줄
 * 번호와는 다를 수 있다. 그래서 문장은 아는 사실만 말한다: "검수 목록의 N번째".
 */

/** 봉투가 지목한 행 하나. 값은 전부 서버가 만든 것이다(사용자가 올린 원문은 실리지 않는다). */
export type ImportFailedRow = {
  /** 미리보기 행의 서버 id. 위치가 아니라 **행 자체**를 가리키는 유일한 손잡이다. */
  rowId: string;
  /** 파서가 매긴 0부터의 자리. 사람에게 보일 때는 +1 해서 "검수 목록의 N번째"가 된다. */
  rowIndex: number;
  /** 그 행이 걸린 사유(서버 오류 코드). 오늘은 한 번의 실패에 한 사유다. */
  reason: string;
};

/** 봉투가 실어 온 실패 행 묶음. `rows`는 상한까지만 오고 `totalCount`가 실제 수다. */
export type ImportFailedRows = {
  rows: readonly ImportFailedRow[];
  totalCount: number;
};

/** 한 문장에 늘어놓을 자리의 최대 개수. 나머지는 "외 N개 행"으로 접는다. */
const IMPORT_FAILED_ROW_POSITION_LIMIT = 5;

function readFailedRows(details: Record<string, unknown>): ImportFailedRow[] {
  const raw = details.failedRows;
  if (!Array.isArray(raw)) return [];
  const rows: ImportFailedRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { rowId, rowIndex, reason } = entry as { rowId?: unknown; rowIndex?: unknown; reason?: unknown };
    // 모양이 어긋난 항목은 **버린다**(지어내지 않는다). 하나도 못 읽으면 아래에서 문장이 없다.
    if (typeof rowId !== "string" || rowId.length === 0) continue;
    if (typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 0) continue;
    rows.push({ rowId, rowIndex, reason: typeof reason === "string" ? reason : "" });
  }
  return rows;
}

/**
 * 실패에서 "어느 행" 정보를 꺼낸다. 없으면 `null`이고, 그때 문구는 종전과 바이트 단위로 같다.
 *
 * 봉투의 `error.details`를 읽는 곳은 여기 하나다 — 코드 추출은 종전처럼
 * `apiErrorCodeOf`(src/api/api-error.ts)를 그대로 지난다. 그 함수가 돌려주는 것은 `code`뿐이라
 * (`ApiErrorEnvelope`에 `details`가 없다) 이 칸만 여기서 읽고, 읽는 경로는 그 함수가 쓰는 것과
 * **같은 자리**다(`error.body.error`).
 */
export function importFailedRows(error: unknown): ImportFailedRows | null {
  if (!error || typeof error !== "object") return null;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return null;
  const envelope = (body as { error?: unknown }).error;
  if (!envelope || typeof envelope !== "object") return null;
  const details = (envelope as { details?: unknown }).details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const rows = readFailedRows(details as Record<string, unknown>);
  if (rows.length === 0) return null;
  const rawCount = (details as Record<string, unknown>).failedRowCount;
  // 전체 수가 없거나 목록보다 작으면 **목록이 곧 전체**다(수를 부풀리지 않는다).
  const totalCount =
    typeof rawCount === "number" && Number.isInteger(rawCount) && rawCount > rows.length ? rawCount : rows.length;
  return { rows, totalCount };
}

/**
 * "어느 행에서 멈췄는가" 한 문장. 지목할 행이 없으면 `null`.
 *
 * 재시도를 권하지 않는다(DNC-018): 같은 파일을 그대로 다시 확정하면 같은 행에서 같은 답이
 * 온다. 대신 **다음에 무엇을 하면 되는지**를 말하고, 사용자가 가장 알고 싶어 하는 사실
 * ("그럼 몇 건은 들어간 건가?")을 감추지 않는다 — 확정은 전량 롤백이라 답은 0건이다.
 */
export function importFailedRowsNotice(error: unknown): string | null {
  const failed = importFailedRows(error);
  if (!failed) return null;
  const positions = failed.rows
    .slice(0, IMPORT_FAILED_ROW_POSITION_LIMIT)
    .map((row) => row.rowIndex + 1)
    .join(" · ");
  const remaining = failed.totalCount - Math.min(failed.rows.length, IMPORT_FAILED_ROW_POSITION_LIMIT);
  const where = remaining > 0 ? `검수 목록의 ${positions}번째 행 외 ${remaining}개 행` : `검수 목록의 ${positions}번째 행`;
  return `${where}에서 멈춰 아무 기록도 가져오지 않았어요. 그 행을 고친 뒤 다시 가져와 주세요.`;
}

const FALLBACK_MESSAGE_BY_KIND: Readonly<Record<ImportFailureKind, string>> = {
  upload: IMPORT_UPLOAD_FAILED_MESSAGE,
  row_edit: IMPORT_ROW_EDIT_FAILED_MESSAGE,
  confirm: IMPORT_CONFIRM_FAILED_MESSAGE,
  undo: IMPORT_UNDO_FAILED_MESSAGE
};

/**
 * 이 여정이 이름을 아는 실패인가(= 재시도가 아니라 다른 행동이 필요한 실패인가).
 *
 * ⚠ **테스트 전용 export**(라운드 71 리뷰 S-8). 화면은 문장만 그리므로 이 판정을 부르지 않고,
 * 쓰는 곳은 "표가 아는 코드와 모르는 코드의 경계"를 고정하는 계약이다. **지우지 않는다** —
 * 재시도 버튼을 이름 있는 실패에서 접는 화면이 생기면 그때 필요한 것이 바로 이 술어이고,
 * 지금은 그 경계를 값으로 지켜 두는 일을 한다.
 */
export function isNamedImportFailure(error: unknown): boolean {
  const code = apiErrorCodeOf(error);
  if (!code) return false;
  if (code === FORBIDDEN_ERROR_CODE) return true;
  return Object.prototype.hasOwnProperty.call(IMPORT_FAILURE_MESSAGE_BY_CODE, code);
}

/**
 * 실패 → **무슨 실패인가**를 말하는 문장.
 *
 * 판정 순서: 403 → 이 여정의 코드 → 앱 전역 표 → 오프라인 → 동작별 일반(위 머리말).
 * 서버 원문은 어떤 경로로도 화면에 나가지 않는다(save-error-messages.ts와 같은 규칙).
 *
 * ⚠️ 두 시점(라운드 106 T3): 종전에는 이 함수가 `importFailureMessage`라는 이름으로 **화면이
 * 부르는 유일한 자리**였다. 지금은 그 이름이 아래 한 겹 위로 옮겨 갔고(어느 행인가를 잇는
 * 자리), 여기는 그 이음이 부르는 **판정 한 벌**로 남는다 — 판정 순서·문장·폴백은 한 글자도
 * 바뀌지 않았고, 행 정보가 없는 실패에서 두 함수의 값은 같다.
 */
function importFailureReasonMessage(
  kind: ImportFailureKind,
  error: unknown,
  { isOnline }: { isOnline: boolean }
): string {
  const code = apiErrorCodeOf(error);
  if (code === FORBIDDEN_ERROR_CODE) return IMPORT_FORBIDDEN_MESSAGE;
  if (code && Object.prototype.hasOwnProperty.call(IMPORT_FAILURE_MESSAGE_BY_CODE, code)) {
    return IMPORT_FAILURE_MESSAGE_BY_CODE[code];
  }
  // 앱 전역 표가 이미 이 코드를 알고 있으면 그 문구를 쓴다(라운드 45가 업로드 화면에 세운
  // 행 수·확장자·용량 세 줄이 여기로 그대로 들어온다 — 같은 실패를 두 문장이 말하지 않는다).
  const knownGlobally = apiErrorMessageForCode(code);
  if (knownGlobally) return knownGlobally;
  if (!isOnline) return OFFLINE_RETRY_NOTICE;
  return FALLBACK_MESSAGE_BY_KIND[kind];
}

/**
 * 실패 → 화면에 서는 **완성된 한 문장**. 위 판정에 "어느 행에서 멈췄나" 한 마디를 잇는다.
 *
 * **화면이 부르는 이름은 종전 그대로다.** 그래서 이 라운드의 화면 변경은 0줄이고, 그리는
 * 자리(danger `<Text>` 하나)도 읽는 자리(`announceForA11y`)도 무접촉이다 — 새 문장이 새 노드를
 * 만들면 그 노드는 스스로 읽히거나 침묵하거나 둘 중 하나이고, 둘 다 이 화면의 낭독 계약을
 * 건드린다(src/a11y-contract.test.ts의 자리 수 대장).
 *
 * 행 정보가 없는 실패에서는 값이 종전과 **바이트 단위로 같다**(네 걸음의 폴백·403·표 문장 전부).
 *
 * 걸음을 가리지 않는 이유: 문장을 가르는 것은 걸음이 아니라 **봉투가 그 정보를 실었는가**다.
 * 오늘 그것을 싣는 서버 경로는 확정 하나뿐이고(apps/api의 `withFailedImportRows`), 다른 걸음이
 * 같은 사실을 싣게 되는 날 이 자리는 이미 옳다.
 */
export function importFailureMessage(
  kind: ImportFailureKind,
  error: unknown,
  { isOnline }: { isOnline: boolean }
): string {
  const message = importFailureReasonMessage(kind, error, { isOnline });
  const notice = importFailedRowsNotice(error);
  return notice ? `${message} ${notice}` : message;
}
