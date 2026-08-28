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
 *  - **언제 지우는가** — 확정/취소/실패로 끝난 잡, 그리고 서버에 더는 없는 잡(404).
 *  - **카드 문구**(해요체) — 파일명과 "언제"만 말한다. 행 수·진행률은 여기서 알 수 없으므로
 *    지어내지 않는다(허위 표시 금지).
 *
 * react-native·zustand를 import하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다.
 */

import { formatRelativeTime } from "../notifications/relative-time";

/** 저장하는 1건. createdAt은 **업로드가 성공한 시각**의 ISO 문자열이다. */
export type ImportResumeEntry = {
  childId: string;
  jobId: string;
  fileName: string;
  createdAt: string;
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
  return { childId, jobId, fileName, createdAt };
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

/** 잡의 상태(서버 `ImportJob["status"]`) 중 **더 검토할 것이 남지 않은** 값들. */
const FINISHED_IMPORT_STATUSES = ["confirmed", "cancelled", "failed"] as const;

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
 * 두 갈래뿐이다: **끝난 잡**(확정/취소/실패 — 이어서 볼 것이 없다)과 **사라진 잡**(404 — 카드를
 * 눌러도 오류 화면만 나온다). 그 외(uploaded/analyzing/preview_ready, 네트워크 실패, 아직
 * 응답 없음)에는 손대지 않는다 -- 잠깐 끊긴 것을 "없어졌다"로 단정하면 사용자가 돌아갈 길을
 * 앱이 스스로 지운다.
 */
export function shouldForgetImportResume(input: { status: string | undefined; error: unknown }): boolean {
  if (input.status && (FINISHED_IMPORT_STATUSES as readonly string[]).includes(input.status)) return true;
  return isMissingImportJobError(input.error);
}
