/**
 * 라운드 56 트랙 D(#5) — **검토하던 가져오기로 돌아가는 길**의 순수 판정·문구 단일 소스.
 *
 * ## 무엇이 문제였나
 * 업로드가 성공하면 화면은 곧바로 검수 화면으로 밀고(app/import/index.tsx의 `router.push`),
 * 그 jobId는 **어디에도 남지 않는다**. 서버에는 "내 가져오기 목록" 엔드포인트가 없다
 * (apps/api의 imports 컨트롤러는 생성·조회·행 수정·확정뿐이다). 그런데 DNC-012상 검수 단계가
 * 길어지는 것은 정상이다 -- 수백 행을 훑다가 전화가 오거나, 카테고리를 확인하러 다른 탭에
 * 다녀오거나, 앱이 내려가면 그 잡은 **미아**가 된다. 다시 들어갈 주소를 아는 사람이 아무도 없다.
 *
 * ## 채택안: 기기에 1건만 남긴다
 * 서버는 한 글자도 바뀌지 않는다. 업로드가 성공한 순간의 `{childId, jobId, fileName, createdAt}`
 * 한 건을 persist 스토어(src/stores/import-resume.store.ts)에 적어 두고, /import 상단에
 * "이어서 보기" 카드로 되돌려 준다. 1건인 이유: 이 앱의 가져오기는 한 번에 한 파일이고(업로드
 * 화면이 파일 하나만 고른다), 목록을 흉내 내는 순간 서버에 없는 상태를 기기가 지어내는 셈이 된다.
 *
 * ## 이 모듈이 고정하는 것
 *  - **살릴 수 있는 저장본의 모양**(sanitize) — 옛/손상 blob이 카드로 둔갑하지 않는다.
 *  - **아이 스코프** — 다른 아이의 가져오기 카드는 보이지 않는다(잡은 childId에 묶여 있고,
 *    확정하면 그 아이의 가계부에 들어간다. 아이를 바꾼 사람에게 남의 파일 이름을 보여 주는
 *    것은 그 자체로 틀린 화면이다).
 *  - **언제 지우는가** — 취소/실패로 끝난 잡, 그리고 서버에 더는 없는 잡(404).
 *  - **확정된 잡은 지우지 않는다**(라운드 67 #3) — 건수를 적어 "방금 가져온 결과" 카드로 남기고,
 *    그 카드가 되돌리기(POST /imports/:id/undo)의 유일한 입구다. 종전에는 확정하는 순간
 *    저장본을 지웠기 때문에 잘못 확정한 200건을 특정할 길이 앱에 없었다.
 *  - **카드 문구**(해요체) — 파일명과 "언제"만 말한다. 행 수·진행률은 여기서 알 수 없으므로
 *    지어내지 않는다(허위 표시 금지).
 *
 * react-native·zustand를 import하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다.
 */

import { formatRelativeTime } from "../notifications/relative-time";

/**
 * 저장하는 1건. createdAt은 **업로드가 성공한 시각**의 ISO 문자열이다.
 *
 * 라운드 67 #3: `importedCount`가 있으면 그 잡은 **확정된 잡**이고, 카드는 "이어서 보기"가 아니라
 * "방금 가져온 결과"(되돌리기 입구)가 된다. 없으면 종전 그대로 검토 중인 잡이다. 이 한 칸이
 * 두 카드를 가르는 유일한 값이다 — 상태 문자열을 저장본에 복사하지 않는 이유는, 그 순간
 * 서버의 상태 목록이 기기에 두 번째 사본으로 생기기 때문이다.
 */
export type ImportResumeEntry = {
  childId: string;
  jobId: string;
  fileName: string;
  createdAt: string;
  importedCount?: number;
};

/**
 * id·파일명 길이 상한. 딥링크나 손상 blob으로 들어온 긴 쓰레기 값이 저장소에 눌러앉지 않게
 * 묶는 선이다(category-drilldown.ts의 같은 관례). 파일명 상한은 화면 한 줄에 들어올 리 없는
 * 길이를 자르는 것이지 사용자의 파일명을 검열하는 값이 아니다 -- 자른 값은 저장하지 않고
 * **통째로 버린다**(잘린 이름을 사실처럼 보여 주지 않는다).
 */
const ID_MAX_LENGTH = 64;
const FILE_NAME_MAX_LENGTH = 200;

function sanitizedId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= ID_MAX_LENGTH ? trimmed : null;
}

function sanitizedFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= FILE_NAME_MAX_LENGTH ? trimmed : null;
}

/** 저장된 시각으로 살릴 수 있는 값인가 — 파싱되는 ISO 문자열만. */
function sanitizedCreatedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? value : null;
}

/**
 * 확정 건수로 살릴 수 있는 값인가 — 0 이상의 정수만(서버 `importedCount`의 모양 그대로).
 * 없거나 모양이 어긋나면 null = "확정된 잡이 아니다"로 읽는다.
 */
function sanitizedImportedCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * 저장본 한 건 → 살릴 수 있으면 그 값, 아니면 null.
 *
 * 네 필드가 **모두** 성해야 살린다: jobId가 없으면 갈 곳이 없고, childId가 없으면 아이 스코프를
 * 판정할 수 없어(= 남의 아이 카드가 뜰 수 있다) 카드 자체가 위험해진다. 파일명·시각이 없으면
 * 카드가 말할 것이 없다.
 */
export function sanitizeImportResumeEntry(value: unknown): ImportResumeEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Record<keyof ImportResumeEntry, unknown>>;
  const childId = sanitizedId(candidate.childId);
  const jobId = sanitizedId(candidate.jobId);
  const fileName = sanitizedFileName(candidate.fileName);
  const createdAt = sanitizedCreatedAt(candidate.createdAt);
  if (!childId || !jobId || !fileName || !createdAt) return null;
  const importedCount = sanitizedImportedCount(candidate.importedCount);
  // 라운드 67 #3: 건수만 어긋난 저장본은 **버리지 않는다** — 네 필드가 성하면 그 잡으로 가는
  // 길은 여전히 살아 있고, 건수를 잃은 카드는 검수 화면이 다시 채운다(그 화면이 서버의
  // importedCount를 읽는다). 반대로 지어낸 숫자를 살리면 카드가 거짓을 말한다.
  return importedCount === null
    ? { childId, jobId, fileName, createdAt }
    : { childId, jobId, fileName, createdAt, importedCount };
}

/** persist blob(`{ entry: … }`) → 살릴 수 있는 1건. 모양이 어긋나면 null(카드 없음). */
export function sanitizeImportResumeBlob(persisted: unknown): ImportResumeEntry | null {
  if (!persisted || typeof persisted !== "object") return null;
  return sanitizeImportResumeEntry((persisted as { entry?: unknown }).entry);
}

/** 카드 제목. 화면이 아니라 여기서 온다(문구가 두 벌이 되지 않게). */
export const IMPORT_RESUME_CARD_TITLE = "검토하던 가져오기 이어서 보기";

/**
 * 카드 둘째 줄: **파일명 · 언제**. 시각 표기는 알림함과 **같은 모듈**을 쓴다
 * (src/notifications/relative-time.ts) -- 같은 앱에서 "3시간 전"이 자리마다 다르게 들리지 않게.
 * 시각을 읽을 수 없으면 파일명만 남긴다(없는 시각을 지어내지 않는다).
 */
export function importResumeCardSubtitle(entry: ImportResumeEntry, nowMs: number): string {
  const createdAtMs = Date.parse(entry.createdAt);
  if (!Number.isFinite(createdAtMs)) return entry.fileName;
  return `${entry.fileName} · ${formatRelativeTime(createdAtMs, nowMs)}`;
}

/** 카드 전체를 한 줄로 읽어 주는 라벨(보이는 두 줄과 같은 문자열로 만든다). */
export function importResumeCardAccessibilityLabel(entry: ImportResumeEntry, nowMs: number): string {
  return `${IMPORT_RESUME_CARD_TITLE}. ${importResumeCardSubtitle(entry, nowMs)}`;
}

/**
 * 지금 이 화면이 카드를 그릴 것인가.
 *
 *  - 저장본이 없으면 없다.
 *  - **아이 스코프**: 지금 고른 아이의 가져오기가 아니면 그리지 않는다(지우지도 않는다 --
 *    아이를 되돌리면 그 카드는 그대로 돌아와야 한다).
 *  - `canResume === false`(비로그인·아이 미선택)이면 그리지 않는다. 이 화면의 비로그인 렌더는
 *    IMP-003 픽셀락 캡처 경로라, 그쪽에 없던 카드가 새로 생기면 캡처가 깨진다.
 */
export function resolveImportResumeCard(input: {
  entry: ImportResumeEntry | null;
  childId: string | null;
  canResume: boolean;
}): ImportResumeEntry | null {
  if (!input.canResume || !input.entry || !input.childId) return null;
  return input.entry.childId === input.childId ? input.entry : null;
}

/**
 * 잡의 상태(서버 `ImportJob["status"]`) 중 **더 볼 것이 남지 않은** 값들.
 *
 * 라운드 67 #3에서 `confirmed`가 이 목록에서 빠졌다. 종전에는 확정하는 순간 저장본을 지웠고,
 * 그래서 **확정한 가져오기는 그 순간 앱에서 도달 불가**가 됐다(서버에 "내 가져오기 목록"이
 * 없으므로 다시 찾아갈 주소를 아는 곳이 아무 데도 없다). 이제 확정된 잡은 지우는 대신
 * **건수를 적어 남긴다**(`markImportResumeConfirmed`) — 그 한 건이 되돌리기의 입구다.
 * 취소·실패는 종전 그대로 지운다: 되돌릴 지출이 애초에 없다.
 */
const FINISHED_IMPORT_STATUSES = ["cancelled", "failed"] as const;

/** 확정된 잡의 저장본인가 — 건수가 적혀 있으면 그렇다(위 `ImportResumeEntry` 주석). */
export function isConfirmedImportEntry(entry: ImportResumeEntry): boolean {
  return typeof entry.importedCount === "number";
}

/**
 * 검수 화면이 저장본을 **확정 결과로 바꿔야** 하는가.
 *
 * 확정 뮤테이션의 성공만 보지 않고 화면이 읽은 **잡 상태**로 판정한다: 확정 직후 그 화면을
 * 떠났다가 다시 들어온 경우(또는 멱등 재전송으로 이미 confirmed인 잡을 연 경우)에도 카드가
 * 같은 결론에 도달해야 한다. 건수는 서버가 말한 값(`ImportJob["importedCount"]`)이다 —
 * 앱이 행을 세지 않는다.
 */
export function shouldMarkImportResumeConfirmed(input: { status: string | undefined }): boolean {
  return input.status === "confirmed";
}

/** "방금 가져온 결과" 카드 제목. 되돌리기 입구의 이름이다. */
export const IMPORT_UNDO_CARD_TITLE = "방금 가져온 결과";

/** 되돌리기 버튼 라벨(스크린리더가 읽는 문장도 이 값에서 나온다). */
export const IMPORT_UNDO_ACTION_LABEL = "되돌리기";

/**
 * 확정 결과 카드의 둘째 줄: **파일명 · 건수 · 언제**. 시각 표기는 이어서 보기 카드와 같은
 * 모듈을 쓴다. 건수를 모르면(모양이 어긋난 저장본) 이 카드 자체가 서지 않으므로
 * (`isConfirmedImportEntry`) 여기서 없는 숫자를 지어낼 일은 없다.
 */
export function importUndoCardSubtitle(entry: ImportResumeEntry, nowMs: number): string {
  const countPart = `${entry.importedCount ?? 0}건`;
  const createdAtMs = Date.parse(entry.createdAt);
  if (!Number.isFinite(createdAtMs)) return `${entry.fileName} · ${countPart}`;
  return `${entry.fileName} · ${countPart} · ${formatRelativeTime(createdAtMs, nowMs)}`;
}

/** 카드 전체를 한 줄로 읽어 주는 라벨(보이는 두 줄과 같은 문자열). */
export function importUndoCardAccessibilityLabel(entry: ImportResumeEntry, nowMs: number): string {
  return `${IMPORT_UNDO_CARD_TITLE}. ${importUndoCardSubtitle(entry, nowMs)}`;
}

/** 되돌리기 버튼의 접근성 라벨 — 무엇을 되돌리는지까지 말한다. */
export function importUndoActionAccessibilityLabel(entry: ImportResumeEntry): string {
  return `${entry.fileName} ${IMPORT_UNDO_ACTION_LABEL}`;
}

export const IMPORT_UNDO_CONFIRM_TITLE = "가져온 기록을 되돌릴까요?";

/**
 * 확인 Alert 본문. 세 가지를 말한다 — **몇 건**이 사라지는지, **확정 뒤에 고친 기록도 함께**
 * 사라진다는 것, 그리고 **되돌릴 수 없다**는 것.
 *
 * 건수를 숫자로 못박는 것은 `syncStatusDiscardAllConfirmMessage`가 세운 관례다(일괄로 사라지는
 * 것의 크기를 사용자가 누르기 전에 알아야 한다). 둘째 문장이 이 화면에만 있는 사실이다:
 * 되돌리기의 정의가 "그 파일에서 온 행 전부"라 확정 뒤에 금액·분류를 고친 행도 함께 사라진다 —
 * 그 사실을 말하지 않으면 사용자는 자기가 손본 기록이 살아남을 것이라고 믿는다. 해요체(DNC-018).
 */
export function importUndoConfirmMessage(count: number): string {
  return `이 파일에서 가져온 ${count}건이 모두 사라져요. 가져온 뒤에 고친 기록도 함께 사라지고, 되돌릴 수 없어요.`;
}

/**
 * 되돌린 뒤의 결과 문구. 서버가 실제로 지운 건수를 말한다 — 카드에 적힌 숫자를 되풀이하지
 * 않는 이유는, 그 사이 사용자가 손으로 지운 행이 있으면 두 숫자가 다르기 때문이다(그때
 * 카드의 숫자를 말하면 화면이 거짓을 말한다). 0건이면 그 사실을 그대로 말한다.
 */
export function importUndoResultMessage(deletedCount: number): string {
  if (deletedCount === 0) return "되돌릴 기록이 이미 없었어요.";
  return `${deletedCount}건을 되돌렸어요.`;
}

/**
 * 서버가 "그런 잡 없다"고 답했는가 — 만료·삭제된 검수 링크.
 *
 * 상태코드로 판정한다(src/api/api-error.ts의 ApiHttpError가 status를 들고 온다). 문자열 비교로
 * 하지 않는 이유는 permission-denied.ts가 남긴 후속 티켓(#8)과 같다 -- 문구는 계약이 아니다.
 * ApiHttpError를 import하지 않고 모양으로 보는 이유: 이 모듈을 순수하게 두고, status를 실어
 * 나르는 다른 오류 클래스(ExpenseHttpError 등)도 같은 규칙으로 통과시키기 위해서다.
 */
export function isMissingImportJobError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { status?: unknown }).status === 404;
}

/**
 * 검수 화면이 저장본을 지워야 하는가.
 *
 * 두 갈래뿐이다: **끝난 잡**(취소/실패 — 남은 것도 되돌릴 것도 없다)과 **사라진 잡**(404 —
 * 카드를 눌러도 오류 화면만 나온다). 그 외(uploaded/analyzing/preview_ready, 네트워크 실패,
 * 아직 응답 없음)에는 손대지 않는다 -- 잠깐 끊긴 것을 "없어졌다"로 단정하면 사용자가 돌아갈
 * 길을 앱이 스스로 지운다.
 *
 * 라운드 67 #3: **확정된 잡은 더 이상 여기서 지워지지 않는다** — `shouldMarkImportResumeConfirmed`가
 * 받아 결과 카드로 바꾼다. 저장본이 지워지는 것은 되돌린 뒤(그때는 되돌릴 것이 없다)이고,
 * 그 자리는 /import 화면이다.
 */
export function shouldForgetImportResume(input: { status: string | undefined; error: unknown }): boolean {
  if (input.status && (FINISHED_IMPORT_STATUSES as readonly string[]).includes(input.status)) return true;
  return isMissingImportJobError(input.error);
}
