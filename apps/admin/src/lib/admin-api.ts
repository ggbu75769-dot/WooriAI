// Admin CMS API client. Talks to the NestJS admin endpoints under `/admin/*`
// through the Next.js same-origin rewrite proxy (see next.config.js) using an
// HttpOnly `admin_session` cookie for auth (SEC-102) and a double-submit
// `X-CSRF-Token` header on state-changing requests. No runtime dependency
// beyond `fetch`.
//
// FIX-118C 후속(R19-F, 완료): 위험 순위가 높은 admin 쓰기 경로에는 이제 서버
// 측 멱등키 장치(IdempotencyInterceptor)가 붙어 있다 —
//   POST /admin/product-links/bulk-apply
//   POST /admin/users
//   POST /admin/item-templates, POST /admin/product-links
//   POST /admin/content-revisions/:id/approve-publish
//   POST /admin/content-revisions/:id/rollback (R20-D)
// 이 경로들은 `Idempotency-Key` 헤더를 함께 보내면 같은 키+같은 body의 재시도가
// 핸들러를 다시 실행하지 않고 첫 응답을 그대로 재생한다(키를 안 보내면 서버는
// 기존대로 비멱등 처리 — opt-in 계약). 그래서 아래 쓰기 함수 중 그 경로들만
// `idempotencyKey`를 받고, 타임아웃 안내도 "다시 보내도 중복되지 않아요"로
// 완화된다(IDEMPOTENT_WRITE_TIMEOUT_MESSAGE).
//
// 나머지 쓰기에는 키를 붙이지 않는다. R20-D에서 잔여 상태 전이 POST를 하나씩
// 확인한 결과, submit/reject/schedule은 재시도해도 새 행이나 라이브 쓰기가 없는
// 순수 상태 전이라 서버 쪽 상태 조건(CAS)만으로 이미 안전했다 — 인터셉터를 더
// 붙일 실익이 없다(판단 근거는 content-revisions.controller.ts의 라우트별 주석).
// 그래서 PATCH 수정류·disclosures PUT·submit/reject/schedule은 종전대로 쓰기
// 타임아웃을 "실패"로 단정하지 않는다 — 아래 WRITE_FETCH_TIMEOUT_MS 분기와
// AdminApiTimeoutError.retryUnsafe 참고.

// GAP-075 #5: 아래 상수 표들은 전부 **손 미러**다 — 어드민은 `@wooriai/domain`·
// `@wooriai/contracts`를 의존성으로 들지 않으므로(라운드 60 P2-8의 근거: 번들에 딸려 오는
// 트랜지티브 의존성 + domain의 raw TS `main`이 요구하는 `transpilePackages`는 빌드 설정 변경)
// 정본을 import하지 못하고 값을 옮겨 적는다. 그 대신 `src/admin-canonical-mirrors.test.ts`가
// 정본 파일을 **소스 텍스트로 읽어** 리터럴과 순서를 대조한다. 갈리면 그 계약이 빨개지고,
// 고칠 곳은 여기 사본 하나다. **새 상수 표를 더하면 그 계약의 전수 단언이 먼저 걸린다** —
// 정본을 대장에 적고 대조 단언을 함께 더해야 통과한다.

/** 정본: `packages/domain/src/enums.ts`의 `NECESSITY_LEVELS`. */
export type NecessityLevel = "essential" | "convenience" | "optional";
export const NECESSITY_LEVELS: NecessityLevel[] = ["essential", "convenience", "optional"];
/** 라벨은 **어드민의 말**이다(정본과 대조하는 것은 문자열이 아니라 키 집합). */
export const NECESSITY_LEVEL_LABELS: Record<NecessityLevel, string> = {
  essential: "필수",
  convenience: "편의",
  optional: "선택"
};

/** 정본: `packages/domain/src/enums.ts`의 `CHILD_STAGE_CODES`(리터럴과 순서 그대로). */
export type ChildStageCode =
  | "pregnancy_early"
  | "pregnancy_mid"
  | "pregnancy_late"
  | "newborn_0_3"
  | "infant_4_6"
  | "infant_7_12"
  | "toddler_1_3"
  | "kid_4_7"
  | "elementary"
  | "middle_school";

export const CHILD_STAGE_CODES: ChildStageCode[] = [
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "newborn_0_3",
  "infant_4_6",
  "infant_7_12",
  "toddler_1_3",
  "kid_4_7",
  "elementary",
  "middle_school"
];

/**
 * ⚠️ 이 문구들은 앱의 것과 **일부러 다르다** — 도메인 `MANUAL_STAGE_LABELS`는 `"0~3개월"`이고
 * 여기는 `"신생아 (0~3개월)"`이다. 운영자 표는 코드가 무엇인지를 함께 말해야 하기 때문이고,
 * 그래서 대조 계약은 이 표에서 **키 집합만** 묻는다(면제가 아니라 판정이다).
 */
export const CHILD_STAGE_LABELS: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "신생아 (0~3개월)",
  infant_4_6: "영아 (4~6개월)",
  infant_7_12: "영아 (7~12개월)",
  toddler_1_3: "유아 (1~3세)",
  kid_4_7: "유아동 (4~7세)",
  elementary: "초등학생",
  middle_school: "중학생"
};

/** 정본: `packages/domain/src/enums.ts`의 `PRODUCT_PLATFORMS`. */
export type ProductPlatform = "coupang" | "naver" | "custom";
export const PRODUCT_PLATFORMS: ProductPlatform[] = ["coupang", "naver", "custom"];
export const PRODUCT_PLATFORM_LABELS: Record<ProductPlatform, string> = {
  coupang: "쿠팡",
  naver: "네이버",
  custom: "기타"
};

// COM-105: 워커 헬스체크 판정. null = 아직 확인 전(미확인).
// 정본: `apps/api/src/worker/jobs/link-health.job.ts`의 `LinkHealthStatus`
// (NULL은 그 유니온 밖이라 아래 LINK_HEALTH_UNKNOWN_LABEL은 표의 키가 아니다).
export type LinkHealthStatus = "ok" | "broken" | "unstable";

export const LINK_HEALTH_LABELS: Record<LinkHealthStatus, string> = {
  ok: "정상",
  broken: "깨짐",
  unstable: "불안정"
};

export const LINK_HEALTH_UNKNOWN_LABEL = "미확인";

export type ProductLink = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  active: boolean;
  // COM-105: link_health 워커 잡이 기록한 최근 헬스체크 결과 (ISO 8601 타임스탬프).
  healthStatus: LinkHealthStatus | null;
  healthCheckedAt: string | null;
  /**
   * GAP-064 #4: 판매처 가격 스냅샷과 그 확인 시각. 지금까지 이 값을 쓰는 유일한 경로는
   * CSV 일괄 교체였는데 어드민 어디에서도 되읽을 수 없었다 — 헬스는 표에 배지가 서고
   * 가격만 없는 비대칭이었다. 앱 응답과 달리 **한쪽만 있는 상태도 그대로 실린다**
   * (레거시 행: 가격만 있고 확인 시각 NULL). 그 상태를 화면이 이름으로 말한다.
   *
   * `priceExpired`는 "앱에서 이미 이 가격이 보이지 않는다"는 서버 판정이다(보존 창을
   * 넘겼다는 뜻 — 문턱은 packages/contracts의 LINK_PRICE_MAX_AGE_DAYS이고, 그 숫자를
   * 어드민 번들에 다시 박지 않으려고 서버가 계산해서 불리언으로 내려준다. 라운드 64 M-2:
   * 그래서 이 주석도 일수를 적지 않는다 — 숫자를 적는 순간 어드민이 자기 사본을 갖는다).
   * 가산 optional: 이 필드들 이전에 캐시된 응답과 섞여도 표가 깨지지 않는다.
   */
  priceSnapshotKrw?: number | null;
  priceCheckedAt?: string | null;
  priceExpired?: boolean;
  /**
   * GAP-064 #8: 공개 리다이렉트 `GET /api/v1/r/:code`의 코드와 그 공유용 절대 URL.
   * 라우트·컬럼은 처음부터 완성돼 있었지만 코드를 노출하는 화면이 하나도 없어 도달
   * 불가였다. URL 조립은 서버가 한다(베이스는 API 환경변수 INVITE_LINK_BASE_URL —
   * 브라우저에서는 읽을 수 없다).
   *
   * 라운드 64 S-1: `redirectShareUrl`은 **활성 링크에만** 실린다(리다이렉트가 active
   * 행만 302로 보낸다). 그래서 비활성 행에는 이 값이 null이고 화면은 복사 버튼을 아예
   * 그리지 않는다 — 누르면 404가 나는 버튼을 세우지 않는다. `redirectCode`는 비활성
   * 행에도 그대로 실린다(되살리면 같은 코드가 다시 도달 가능해진다).
   *
   * DNC-010: 이 URL은 혼자 나가면 안 되므로 화면의 복사 동작은 같은 행의
   * `shareDisclosureText`를 함께 싣는다(src/lib/link-share.ts).
   */
  redirectCode?: string | null;
  redirectShareUrl?: string | null;
  /**
   * 라운드 64 M-1: **앱 밖으로 나갈 때** 이 링크에 붙는 고지 문구. 편집·표시용
   * `disclosureText`(운영이 쓴 값 그대로)와 달리, 제휴 링크에는 수수료 문장이 반드시
   * 들어 있다 — 판정은 서버 한 곳(apps/api src/items-commerce/share-disclosure.ts)이고
   * 앱의 `purchaseLinkShareMessage`가 지나는 규율과 같은 것이다. 어드민은 이 값을
   * 지어내지도 고쳐 쓰지도 않는다.
   *
   * 가산 optional: 이 필드 이전에 캐시된 응답에서는 없을 수 있다(그때는 복사 문구가
   * 고지 없이 URL만 나가는 대신, link-share.ts가 `disclosureText`로 물러선다).
   */
  shareDisclosureText?: string | null;
};

export type ItemTemplate = {
  id: string;
  name: string;
  necessityLevel: NecessityLevel;
  // 라운드 49 C-02(어드민 조각) → 49 QA(P3-6): 준비템의 분류. 이제 어드민 응답(목록·생성·
  // 수정)이 이 값을 실어 주므로 수정 폼이 저장된 분류로 프리필된다(분류가 없으면 null).
  // optional로 남겨 두는 이유는 이 필드 이전에 캐시된 응답과 섞여도 폼이 깨지지 않게 하기
  // 위해서다 — 그때는 종전대로 빈 선택으로 시작한다(빈 선택 = PATCH에서 분류를 그대로 둠).
  categoryId?: string | null;
  status: string;
  timingLabel?: string;
  priceBandText?: string;
  // ADM-124: 표시용 문구(priceBandText)와 별개로 수정 폼이 프리필할 원시 값. 서버가
  // 어드민 응답에만 실어 준다(앱용 요약/상세 DTO는 그대로).
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText?: string | null;
  usedSecondhandOk: boolean;
  safetyNote?: string | null;
  // 라운드 48 T1: 의료/영양제 성격 준비템의 상담 안내 표시 여부(DNC-020). 서버는 항상
  // boolean을 주지만, 이 필드 이전에 캐시된 응답과 섞여도 폼이 깨지지 않게 optional이다.
  medicalDisclaimerRequired?: boolean;
  active: boolean;
  stageCodes: ChildStageCode[];
  // UX-X(R43) M-5: productLinks에는 비활성 링크도 그대로 실린다(어드민은 내려둔 링크를
  // 보고 되살릴 수 있어야 한다). 사용자에게 실제로 보이는 구매처 수는 서버가 따로
  // 세어 준다 — 목록의 "링크 수"와 '상품 링크 없음만 보기'는 이쪽을 기준으로 한다.
  activeLinkCount: number;
  productLinks: ProductLink[];
};

export type Disclosure = { id: string | null; key: string; text: string };

// ADM-123: 클릭 통계 분해. 기존 두 필드(totalClicks/byPlatform)는 전체 기간
// 집계 그대로이고, 아래 네 필드가 선택한 기간(7/30일) 분해다 — 서버가 하위호환
// 확장으로 같은 엔드포인트에 덧붙인다.
export type ClickSummaryDays = 7 | 30;

/** 정본: `apps/api/src/admin/affiliate-click-breakdown.service.ts`의 `CLICK_BREAKDOWN_WINDOWS`
 * (서버가 실제로 받는 창 — 여기 없는 값을 화면이 고르면 400이 돌아온다). */
export const CLICK_SUMMARY_DAYS_OPTIONS: ClickSummaryDays[] = [7, 30];

/** 상위 링크 한 줄. 링크가 삭제되면 이름/리테일러가 null로 떨어지지만
 * 클릭 수는 남는다(집계가 windowTotalClicks와 어긋나지 않게). */
export type ClickTopLink = {
  productLinkId: string;
  productLinkTitle: string | null;
  itemTemplateId: string | null;
  itemTemplateName: string | null;
  platform: string | null;
  count: number;
};

export type ClickSummary = {
  totalClicks: number;
  byPlatform: { platform: string; count: number }[];
  days: ClickSummaryDays;
  /** 선택 기간 안의 클릭 수(전체 기간 totalClicks와 별개). */
  windowTotalClicks: number;
  topLinks: ClickTopLink[];
  /** 기간 내 서울 기준 날짜별 클릭 수(오름차순, 0건도 채워짐). */
  dailyTotals: { date: string; count: number }[];
};

export type ItemTemplateInput = {
  name?: string;
  // 라운드 49 C-02(어드민 조각): 준비템 분류. 서버 DTO(AdminCreate/UpdateItemTemplateDto)가
  // 이미 받는 값이라 폼만 배선하면 된다. 생략은 "분류 없이 생성"(POST) / "그대로 둠"(PATCH).
  categoryId?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  // ADM-124: PATCH에서 null = "가격대 지우기"(생략은 종전대로 "그대로 두기").
  priceMinKrw?: number | null;
  priceMaxKrw?: number | null;
  reasonText?: string;
  skipReasonText?: string;
  usedSecondhandOk?: boolean;
  safetyNote?: string;
  medicalDisclaimerRequired?: boolean;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

export type ProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string;
  active?: boolean;
};

// Same-origin `/api/v1` (relative, no host) so every request goes through the
// next.config.js rewrite (`/api/v1/:path*` -> the real API), which is what
// makes the `admin_session`/`admin_csrf` cookies same-origin in the first
// place. Only overridden for setups that intentionally call the API
// cross-origin (uncommon; loses that same-origin cookie simplicity).
const DEFAULT_API_BASE_URL = "/api/v1";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE_NAME = "admin_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

// R19-F: 서버 IdempotencyInterceptor가 읽는 헤더 이름. 인터셉터는 값 자체를
// 그대로 (actor, endpoint, key) 유니크 키로 쓰므로 값의 형식은 자유이고,
// 컬럼 상한(varchar(120))만 지키면 된다 — uuid(36자)로 충분하다.
const IDEMPOTENCY_HEADER_NAME = "Idempotency-Key";

/** 한 번의 "시도"를 식별하는 새 멱등키. crypto.randomUUID가 없는 환경(구형
 * 브라우저, jsdom 없는 테스트 러너)에서는 시간+난수 조합으로 폴백한다. */
export function newIdempotencyKey(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * R19-F: 멱등키의 값은 "요청 1회당 1키"가 아니라 **시도 1회당 1키**여야 한다 —
 * 재시도가 같은 키를 다시 보내야 서버가 중복을 걸러 주기 때문이다. 매 호출마다
 * 새 키를 만들면 서버 입장에서는 전혀 다른 두 요청이라 멱등 장치가 무의미해진다.
 *
 * 그래서 호출부(컴포넌트)는 이 홀더를 하나 들고 다니면서
 *  - `current(fingerprint?)` — 이번 시도(및 그 재시도)에 쓸 키.
 *  - `rotate()` — 시도가 **끝났을 때**(성공) 호출. 다음 시도는 새 키.
 * 규칙으로 쓴다.
 *
 * `fingerprint`는 보낼 요청 body를 대표하는 문자열(보통 `JSON.stringify(input)`
 * 또는 CSV 원문)이다. 값이 직전과 다르면 키를 자동으로 새로 발급한다 — body가
 * 바뀌었는데 키를 그대로 재사용하면 서버가
 * 409 IDEMPOTENCY_KEY_CONFLICT("이미 다른 요청 본문으로 사용된 키")로 막기
 * 때문이다. 폼의 onChange 하나하나에 회전 호출을 심는 대신 이 지문 비교 한
 * 군데로 그 규칙을 보장한다.
 */
export type IdempotencyKeyHolder = {
  current(fingerprint?: string): string;
  rotate(): void;
  /** 아직 발급 전이면 null (테스트/디버깅용). */
  peek(): string | null;
};

export function createIdempotencyKeyHolder(generate: () => string = newIdempotencyKey): IdempotencyKeyHolder {
  let key: string | null = null;
  let lastFingerprint: string | null = null;
  return {
    current(fingerprint?: string) {
      const next = fingerprint ?? null;
      if (key === null || next !== lastFingerprint) {
        key = generate();
        lastFingerprint = next;
      }
      return key;
    },
    rotate() {
      key = null;
      lastFingerprint = null;
    },
    peek() {
      return key;
    }
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

// ADM-117 timeout hardening: mirrors the mobile client's fetch-timeout
// precedent (apps/mobile/src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS) -- a
// plain `fetch` against a hung/unreachable API can sit for 60-90+ seconds (or
// forever) before the OS gives up, leaving admin pages stuck on their
// "처리 중..."/"불러오는 중..." state indefinitely. Every request below is
// bounded so a call that never settles is force-failed into the existing
// AdminApiError-based error/재시도 UI instead of hanging.
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

// FIX-118C: 쓰기(비-GET)에는 더 넉넉한 상한을 쓴다. 읽기는 끊어도 다시 부르면
// 그만이지만, admin 쓰기는 서버 멱등 장치가 없어(위 후속 과제 주석) 클라이언트가
// 먼저 끊는 순간 "실패했는지 성공했는지 모르는" 상태가 된다. 서버가 10초를 넘겨
// 성공했는데 UI가 "시간 초과"로 표시하면 운영자가 재시도해 이중 반영(bulk 500행
// 2회 적용, displayOrder 중복 등)이 일어난다. 60초는 실제로 무거운 admin 쓰기
// (bulk-apply 최대 500행, 승인·게시)가 끝나기에 충분하면서도, 완전히 죽은
// 연결이 UI를 영원히 "처리 중..."에 묶어두지는 않는 절충값이다.
export const WRITE_FETCH_TIMEOUT_MS = 60_000;

/** 메서드별 fetch 타임아웃 상한. GET(읽기)은 10초, 나머지(쓰기)는 60초. */
export function timeoutMsForMethod(method: string): number {
  return STATE_CHANGING_METHODS.has(method.toUpperCase()) ? WRITE_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS;
}

const READ_TIMEOUT_MESSAGE = "요청 시간이 초과됐어요(10초). 네트워크 상태를 확인하고 다시 시도해 주세요.";

// 쓰기 타임아웃 문구는 의도적으로 재시도를 권하지 않는다 — 서버가 이미 반영했을
// 수 있으므로 "다시 시도해 주세요"는 이중 반영을 유도하는 안내가 된다.
const WRITE_TIMEOUT_MESSAGE =
  "요청이 오래 걸리고 있어요(60초). 반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.";

// R19-F: 멱등키를 실어 보낸 쓰기는 서버가 중복을 걸러 주므로, 타임아웃 뒤에도
// 재시도를 그대로 권할 수 있다 — 같은 키로 다시 보내면 서버는 핸들러를 다시
// 실행하지 않고 첫 결과를 재생한다.
const IDEMPOTENT_WRITE_TIMEOUT_MESSAGE =
  "요청이 오래 걸리고 있어요(60초). 같은 요청을 다시 보내면 중복 없이 처리돼요 — 다시 시도해 주세요.";

/**
 * GAP-077 트랙 B(R19-F 후속) — **연결 실패도 타임아웃과 같은 판정을 지난다.**
 *
 * 바로 위 타임아웃 세 문장은 `method`·`idempotent` 둘로 갈린다. 연결 실패(`fetch` 자체의
 * 거절)는 오늘까지 그 판정을 지나지 않고 **한 문장**이었고, 그 문장이 GET·POST·PATCH·
 * DELETE에 똑같이 서면서 *"다시 시도해 주세요"* 라고 말했다.
 *
 * ⚠️ **판정이 필요한 이유가 타임아웃과 정확히 같다.** `fetch`의 거절은 *"보내지 못했다"* 와
 * *"보냈는데 답을 못 받았다"* 를 **구분하지 않는다** — 연결이 서기 전에 죽으면 서버는
 * 아무것도 모르지만, 요청 본문이 나간 뒤 커넥션이 끊기면(리셋 · TLS 종료 · 중간 프록시)
 * 서버는 이미 처리했을 수 있다. 클라이언트가 그 둘을 가를 방법은 없고, 그것이 바로
 * `WRITE_TIMEOUT_MESSAGE`가 존재하는 이유다. 같은 불확실성에 타임아웃은 보수적으로,
 * 연결 실패는 낙관적으로 말하고 있었다.
 *
 * ⚠️ **타임아웃 상수를 재활용하지 않는 이유**: 그 셋은 *"(10초)"* · *"(60초)"* 를 문장에
 * 못박고 있어 연결 실패에 그대로 쓰면 거짓이다. 그래서 **같은 규율의 새 문장 둘**을 짓는다
 * (읽기 문장은 오늘의 것 그대로 — 바이트 불변).
 */

/** 멱등키 없는 쓰기의 연결 실패. `WRITE_TIMEOUT_MESSAGE`와 **같은 모양**이다 — 반영 여부를
 * 단정하지 않고, 재시도보다 **새로고침 확인을 먼저** 권한다. ⚠️ 꼬리가 `"다시 시도해
 * 주세요"`가 아닌 것이 이 문장의 본체다(오늘 멱등키 없는 쓰기가 **열여덟**이라, 서버가
 * 중복을 걸러 주지 않는 자리에 재시도를 권하면 이중 반영을 유도하는 안내가 된다). */
const WRITE_CONNECTION_FAILURE_MESSAGE =
  "서버에 연결하지 못했어요. 반영 여부가 확실하지 않으니 네트워크 상태를 확인하고, 목록을 새로고침해 확인한 뒤 다시 시도하세요.";

/** 멱등키를 실어 보낸 쓰기(오늘 **여섯**)의 연결 실패. 서버가 중복을 걸러 주므로
 * `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`와 같은 규율로 재시도를 권해도 된다 — 단,
 * 재시도는 **같은 키**로 보내야 한다(`IdempotencyKeyHolder` 참고). */
const IDEMPOTENT_WRITE_CONNECTION_FAILURE_MESSAGE =
  "서버에 연결하지 못했어요. 같은 요청을 다시 보내면 중복 없이 처리되니, 네트워크 상태를 확인하고 다시 시도해 주세요.";

/**
 * 쓰기의 연결 실패 문장을 고른다. ⚠️ **판정을 새로 만들지 않는다** —
 * `AdminApiTimeoutError`의 생성자가 쓰는 그 두 값(`STATE_CHANGING_METHODS.has(method)` ·
 * `Boolean(idempotencyKey)`에서 온 `idempotent`)으로만 갈리고, 갈래의 모양도 같다.
 *
 * ⚠️ **읽기 갈래는 이 함수가 아니라 `request()`의 catch 자리에 리터럴로 남는다.** 조회 실패
 * 한 벌(라운드 73~75 트랙 D)의 테스트가 그 한 줄을 **소스에서 정규식으로** 읽어 네트워크
 * 갈래의 에러를 재현하기 때문이다. 그 파일은 이 트랙의 무접촉 대상이고, 그 스크레이프가 곧
 * **"읽기 문장 바이트 불변"의 안전망**이다 — 문장을 여기 상수로 올리면 그 그물이 조용히
 * 찢어진다(읽기 갈래가 상수 이름으로 바뀌어 정규식이 아무것도 못 찾는다).
 */
function writeConnectionFailureMessage(idempotent: boolean): string {
  return idempotent ? IDEMPOTENT_WRITE_CONNECTION_FAILURE_MESSAGE : WRITE_CONNECTION_FAILURE_MESSAGE;
}

/** Thrown when fetchWithTimeout's OWN timeout bound fires (never for genuine
 * network failures -- those take the `connectionFailureMessage` mapping above,
 * which splits on the same two values this class does).
 * Extends AdminApiError (status 0, code "TIMEOUT") so every existing
 * `error instanceof AdminApiError`/`error.message` display path shows the
 * Korean timeout guidance without changes. `cause` carries the original abort
 * rejection (typically a DOMException named "AbortError") for debugging.
 *
 * FIX-118C: `method`와 `retryUnsafe`를 함께 실어 보낸다. `retryUnsafe === true`
 * (비-GET 쓰기)면 서버가 이미 처리했을 수 있으므로 호출부는 자동 재시도를 걸거나
 * 재시도를 권하는 문구를 보여선 안 된다.
 *
 * R19-F: 멱등키를 실어 보낸 쓰기(`idempotent === true`)는 예외다 — 서버가 중복을
 * 걸러 주므로 `retryUnsafe`는 false가 되고 문구도 재시도를 권한다. 단, 재시도는
 * **같은 키**로 보내야 한다(IdempotencyKeyHolder 참고). */
export class AdminApiTimeoutError extends AdminApiError {
  /** 타임아웃된 요청의 HTTP 메서드(대문자). */
  readonly method: string;
  /** 비-GET 쓰기인데 서버 멱등키 보호가 없어 재시도 시 이중 반영 위험이 있는지. */
  readonly retryUnsafe: boolean;
  /** 이 요청이 `Idempotency-Key`를 실어 보냈는지 (= 같은 키로 재시도해도 안전). */
  readonly idempotent: boolean;

  constructor(cause: unknown, method: string = "GET", idempotent: boolean = false) {
    const normalized = method.toUpperCase();
    const isWrite = STATE_CHANGING_METHODS.has(normalized);
    const retryUnsafe = isWrite && !idempotent;
    const message = isWrite
      ? idempotent
        ? IDEMPOTENT_WRITE_TIMEOUT_MESSAGE
        : WRITE_TIMEOUT_MESSAGE
      : READ_TIMEOUT_MESSAGE;
    super(0, message, "TIMEOUT");
    this.name = "AdminApiTimeoutError";
    this.method = normalized;
    this.retryUnsafe = retryUnsafe;
    this.idempotent = isWrite && idempotent;
    this.cause = cause;
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof AdminApiTimeoutError;
}

/** 연결 실패(fetch 거절 — status 0) 판별. 타임아웃은 같은 status 0이지만
 * AdminApiTimeoutError로 따로 서므로 여기서는 false. 화면이 status 코드를 손으로
 * 읽지 않고 이 술어를 읽게 하려고 판정을 이 파일에 둔다(라운드 77 B·C 접점). */
export function isConnectionFailureError(error: unknown): boolean {
  return error instanceof AdminApiError && !(error instanceof AdminApiTimeoutError) && error.status === 0;
}

/** 쓰기 타임아웃(반영 여부 불명 → 재시도 시 이중 반영 위험) 판별. 읽기 타임아웃,
 * 일반 네트워크 실패, 그리고 멱등키를 실어 보낸 쓰기에는 false. */
export function isRetryUnsafeTimeoutError(error: unknown): boolean {
  return error instanceof AdminApiTimeoutError && error.retryUnsafe;
}

/** R19-F: 멱등키를 실어 보낸 쓰기의 타임아웃 판별. 이 경우 호출부는 **같은 키를
 * 유지한 채** 재시도를 권해도 된다 — 서버가 중복 반영을 막아 준다. */
export function isIdempotentTimeoutError(error: unknown): boolean {
  return error instanceof AdminApiTimeoutError && error.idempotent;
}

/** Wraps `fetch` with an AbortController-based timeout so a hung connection
 * always settles (as a rejection) within `timeoutMs`. A rejection caused by
 * this function's own timeout abort is translated into AdminApiTimeoutError
 * (callers never pass their own `signal` -- the spread always overrides it, so
 * the only abort source here is the timer); every other rejection is rethrown
 * untouched. Same double guard as the mobile client: `timedOut` (our timer
 * actually fired) AND the abort shape (`name === "AbortError"`), so a genuine
 * network error landing in the same tick as the timer is never mislabeled. */
function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  method: string = "GET",
  idempotent: boolean = false
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return fetch(input, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (timedOut && (error as { name?: unknown } | null)?.name === "AbortError") {
        throw new AdminApiTimeoutError(error, method, idempotent);
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

/**
 * @param idempotencyKey R19-F: 서버 IdempotencyInterceptor가 붙은 쓰기 경로에서만
 * 넘긴다. 재시도 시 **같은 값**을 다시 넘겨야 중복이 걸러진다.
 */
async function request<T>(path: string, init?: RequestInit, idempotencyKey?: string): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> ?? {}) };
  const idempotent = STATE_CHANGING_METHODS.has(method) && Boolean(idempotencyKey);
  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
    if (idempotencyKey) {
      headers[IDEMPOTENCY_HEADER_NAME] = idempotencyKey;
    }
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${apiBaseUrl()}${path}`,
      { ...init, method, credentials: "include", headers },
      // FIX-118C: 읽기 10초 / 쓰기 60초. 쓰기를 일찍 끊으면 서버는 성공했는데
      // 운영자가 재시도해 이중 반영될 수 있어서다.
      timeoutMsForMethod(method),
      method,
      idempotent
    );
  } catch (error) {
    // The timeout keeps its own typed error (and Korean guidance); every other
    // rejection is the connection failure -- which now runs through R19-F's
    // judgment on the SAME two values the timeout branch already computed
    // (`method`, `idempotent`), instead of one sentence for GET/POST/PATCH/DELETE.
    // 타입은 종전 그대로 `AdminApiError(0, …)`이라 `writeErrorMessage`/`loadErrorCopy`가
    // 한 글자도 바뀌지 않고 이 문장을 나른다(새 클래스 0건).
    if (error instanceof AdminApiTimeoutError) throw error;
    if (!STATE_CHANGING_METHODS.has(method)) {
      // 읽기(GET·HEAD)는 **오늘의 문장 그대로다 — 바이트 불변.** 조회는 다시 눌러도
      // 안전하므로 재시도 안내가 그대로 옳다(쓰기와 정반대라는 것이 R19-F의 값이다).
      // ⚠️ 이 갈래만 문장이 리터럴로 여기에 남는 이유는 writeConnectionFailureMessage의
      // 주석 참고(무접촉 파일의 소스 스크레이프가 이 꼴을 읽는다).
      throw new AdminApiError(0, "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    }
    throw new AdminApiError(0, writeConnectionFailureMessage(idempotent));
  }

  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as Record<string, unknown>).error : undefined;
    const code =
      errorBody && typeof errorBody === "object" && "code" in (errorBody as Record<string, unknown>)
        ? String((errorBody as Record<string, unknown>).code)
        : undefined;
    const message =
      errorBody && typeof errorBody === "object" && "message" in (errorBody as Record<string, unknown>)
        ? String((errorBody as Record<string, unknown>).message)
        : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
    throw new AdminApiError(response.status, message, code);
  }

  return (body ?? ({} as unknown)) as T;
}

export function listItemTemplates() {
  return request<{ items: ItemTemplate[] }>("/admin/item-templates");
}

/** R19-F: 서버 멱등키 적용 경로. `idempotencyKey`를 넘기면 같은 키+같은 입력의
 * 재시도가 중복 생성 없이 첫 응답을 재생한다. */
export function createItemTemplate(input: ItemTemplateInput, idempotencyKey?: string) {
  return request<ItemTemplate>(
    "/admin/item-templates",
    { method: "POST", body: JSON.stringify(input) },
    idempotencyKey
  );
}

export function updateItemTemplate(itemTemplateId: string, input: ItemTemplateInput) {
  return request<ItemTemplate>(`/admin/item-templates/${itemTemplateId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function listProductLinks() {
  return request<{ links: ProductLink[] }>("/admin/product-links");
}

/** R19-F: 서버 멱등키 적용 경로 (createItemTemplate과 동일 계약). */
export function createProductLink(input: ProductLinkInput, idempotencyKey?: string) {
  return request<ProductLink>(
    "/admin/product-links",
    { method: "POST", body: JSON.stringify(input) },
    idempotencyKey
  );
}

export function updateProductLink(productLinkId: string, input: ProductLinkInput) {
  return request<ProductLink>(`/admin/product-links/${productLinkId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

// COM-107-prep: CSV bulk affiliate-link replacement. Admin-role-only on the
// API side (RequireAdminRoles("admin") in product-link-bulk.controller.ts),
// matching the direct product-link write endpoints; the links page hides the
// panel for editor/analyst sessions. Preview never writes; apply updates only
// valid rows and is idempotent (unchanged rows count as skipped).
export type ProductLinkBulkPreviewRow = {
  /** 1-based CSV line number; line 1 is the header row. */
  rowNumber: number;
  status: "valid" | "error";
  matchedProductLinkId: string | null;
  matchedTitle: string | null;
  currentAffiliateUrl: string | null;
  newAffiliateUrl: string | null;
  /** GAP-064 #4ⓐ: 대상 링크에 지금 저장된 가격(없으면 null). 적용 전후 대조를 URL에서
   * 가격까지 넓힌다 — 종전에는 CSV로 쓴 가격이 반영됐는지 확인할 자리가 없었다. */
  currentPriceSnapshotKrw?: number | null;
  /** 이 행이 쓰려는 가격. CSV의 가격 칸이 비었으면 null(가격은 그대로 둔다). */
  newPriceSnapshotKrw?: number | null;
  errorCode?: string;
  errorMessage?: string;
};

export type ProductLinkBulkPreviewResult = {
  rows: ProductLinkBulkPreviewRow[];
  summary: { total: number; valid: number; errors: number };
};

export type ProductLinkBulkApplyResult = { applied: number; skipped: number; errors: number };

/** CSV 템플릿 헤더: productLinkId 또는 itemTemplate(코드/이름)+platform 중 하나로 대상을 지정한다. */
export const PRODUCT_LINK_BULK_CSV_HEADER = "productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw";

export function bulkPreviewProductLinks(csv: string) {
  return request<ProductLinkBulkPreviewResult>("/admin/product-links/bulk-preview", {
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

/** R19-F: admin 쓰기 중 재시도 위험이 가장 큰 경로라 서버 멱등키가 붙어 있다.
 * `idempotencyKey`를 유지한 채 재시도하면 500행이 두 번 반영되지 않고 첫
 * 결과(applied/skipped/errors)가 그대로 재생된다. CSV가 바뀌면 반드시 키도
 * 새로 발급해야 한다(같은 키 + 다른 body는 서버가 409로 막는다). */
export function bulkApplyProductLinks(csv: string, idempotencyKey?: string) {
  return request<ProductLinkBulkApplyResult>(
    "/admin/product-links/bulk-apply",
    {
      method: "POST",
      body: JSON.stringify({ csv })
    },
    idempotencyKey
  );
}

export function listDisclosures() {
  return request<{ disclosures: Disclosure[] }>("/admin/disclosures");
}

export function updateDisclosure(key: string, text: string) {
  return request<Disclosure>(`/admin/disclosures/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ text })
  });
}

export function getAffiliateClickSummary(days: ClickSummaryDays = 7) {
  return request<ClickSummary>(`/admin/affiliate-clicks/summary?days=${days}`);
}

// ADM-008: read-only ops counters for the admin dashboard home. Any admin role
// (admin/editor/analyst) may read it — the API route has no RequireAdminRoles.
export type AdminDashboardSummary = {
  activeUsers: number;
  households: number;
  childrenCount: number;
  expensesTotal: number;
  affiliateClicks7d: number;
  analyticsEvents7d: number;
  pendingContentRevisions: number;
  // UX-X(R43) M-4: 링크 헬스 3종은 모두 활성 링크(active=true) 안에서 센 값이다.
  // 미검사(healthStatus=null)를 함께 받아야 "깨짐 0"이 전수 검사 결과인지 아닌지
  // 대시보드가 말할 수 있다(worker-health-view.ts brokenLinkCountCaption).
  productLinksBrokenCount: number;
  productLinksActiveCount: number;
  productLinksUncheckedCount: number;
};

export function getAdminDashboardSummary() {
  return request<AdminDashboardSummary>("/admin/dashboard/summary");
}

// UX-X C5: GET /health/worker (INF-007/OPS-130). 백그라운드 워커가 실제로 돌고 있는지
// 대시보드에서 확인하기 위한 읽기. `/admin/*`이 아니라 무인증 공개 엔드포인트이고
// (서버가 id·에러 문자열을 걷어낸 카운트/불리언만 내려준다), 같은 `/api/v1` 리라이트
// 프록시를 타므로 별도 클라이언트 없이 request()를 그대로 쓴다.
export type WorkerHealthJob = {
  name: string;
  lastStatus: "ok" | "failed";
  lastRunAt: string;
  lastDurationMs: number;
  /** 연속 실패 횟수. 성공하면 0으로 초기화된다. */
  consecutiveFailures: number;
  /** 서버가 sanitize한 잡 요약 — 숫자/불리언만 남는다. */
  lastSummary: Record<string, number | boolean>;
};

export type WorkerHealth = {
  enabled: boolean;
  intervalMs: number;
  lastTickStartedAt: string | null;
  lastTickFinishedAt: string | null;
  msSinceLastTick: number | null;
  /** 켜져 있는데 주기의 3배 동안 틱이 끝난 적 없음. */
  stale: boolean;
  /** 어떤 잡이 failureThreshold회 연속 실패 중. */
  degraded: boolean;
  failureThreshold: number;
  jobs: WorkerHealthJob[];
};

export function getWorkerHealth() {
  return request<WorkerHealth>("/health/worker");
}

// ADM-009: read-only analytics-event aggregation for the KPI funnel page
// (/analytics). Any admin role (admin/editor/analyst) may read it — the API
// route has no RequireAdminRoles, same as the dashboard summary.
export type AnalyticsSummaryDays = 7 | 30;

/** Canonical registry event names (packages/contracts/src/analytics.ts), in
 * registry order. The API's `byName` always contains all six (0 included).
 *
 * ⚠️ 이 목록은 레지스트리의 **앞부분**만 든다 — 뒤에 append된 이름들의 한국어 라벨은
 * `app/analytics/page.tsx`의 `ANA127_EVENT_LABELS`가 진다(0건이어도 표에 서는 것은 앞부분,
 * 나머지는 응답 `byName`으로 들어온다는 렌더 규칙이 라운드 60·39의 자리다).
 * 그 **둘의 합집합이 레지스트리 전부와 같은지**를 `src/admin-canonical-mirrors.test.ts`가
 * 센다(라벨 없는 이름 0건 · 유령 라벨 0건). 새 이벤트가 레지스트리 뒤에 붙으면 그 계약이
 * 빨개지고, 고칠 곳은 이 목록이 아니라 페이지의 라벨 표다. */
export type AnalyticsEventName =
  | "app_opened"
  | "onboarding_completed"
  | "expense_recorded"
  | "expense_synced"
  | "item_status_changed"
  | "affiliate_link_clicked";

export const ANALYTICS_EVENT_NAMES: AnalyticsEventName[] = [
  "app_opened",
  "onboarding_completed",
  "expense_recorded",
  "expense_synced",
  "item_status_changed",
  "affiliate_link_clicked"
];

export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventName, string> = {
  app_opened: "앱 실행",
  onboarding_completed: "온보딩 완료",
  expense_recorded: "지출 기록",
  expense_synced: "지출 동기화",
  item_status_changed: "준비템 상태 변경",
  affiliate_link_clicked: "제휴 링크 클릭"
};

export type AdminAnalyticsFunnel = {
  appOpened: number;
  onboardingCompleted: number;
  expenseRecorded: number;
  itemStatusChanged: number;
  affiliateLinkClicked: number;
  expenseSynced: number;
};

/**
 * ANA-128: 구매 확인 프롬프트(COM-108) 응답을 payload의 answer별로 쪼갠 값.
 * byName의 `purchase_followup_answered`는 세 갈래의 합계라서 "샀어요" 건수가 아니다 —
 * 링크 클릭 → "샀어요" 응답률은 `purchased`로만 계산해야 한다.
 *
 * 라운드 60 리뷰(P2-5): `purchased`도 **답의 수이지 구매의 수가 아니다.** 라운드 60 트랙 B가
 * "샀어요" 버튼에서 done 확정을 떼어 저장 자리로 옮긴 뒤(모바일 PurchaseFollowupPrompt.tsx),
 * 그 버튼은 기록 화면을 열 뿐이라 사용자가 화면을 닫으면 답만 남고 지출은 없다. 실제 구매는
 * `expense_recorded`가 말한다.
 *
 * 세 값의 합 <= byName 총계일 수 있다: answer가 없거나(레거시·손상 페이로드)
 * 알 수 없는 값인 행은 API가 어느 갈래에도 넣지 않고 무시한다.
 */
export type AdminPurchaseFollowupBreakdown = {
  /** "샀어요" */
  purchased: number;
  /** "아직이요" */
  notPurchased: number;
  /** "괜찮아요" */
  dismissed: number;
};

/**
 * 라운드 61 #5: `onboarding_step_viewed`를 payload의 `step`별로 쪼갠 값. 라운드 60 #9는
 * 계측만 붙였고 요약 API가 이벤트 이름 단위로만 집계해서, 어드민은 네 단계의 **합계**
 * 하나만 볼 수 있었다 — "온보딩 중 어디서 그만두는가"에는 합계로 답할 수 없다.
 *
 * 항상 계약 레지스트리(packages/contracts/src/analytics.ts의 `ONBOARDING_STEPS`) 순서로
 * 전 단계가 0건 포함 내려온다. `stepNumber`는 그 배열 위치(1부터)이고, 페이로드가 실어
 * 보낸 번호가 아니다.
 *
 * 네 값의 합 <= byName의 `onboarding_step_viewed`일 수 있다: `step`이 없거나 알 수 없는
 * 값인 행은 API가 어느 단계에도 넣지 않고 무시한다(ANA-128의 answer 분해와 같은 규칙).
 */
export type AdminOnboardingStepBreakdown = {
  /** 계약 레지스트리의 단계 리터럴 (예: "child_status"). */
  step: string;
  /** 1부터 세는 단계 순서. */
  stepNumber: number;
  count: number;
};

export type AdminAnalyticsSummary = {
  days: AnalyticsSummaryDays;
  totalEvents: number;
  /** All six registry names always present (count 0 included). */
  byName: { name: string; count: number }[];
  /** One entry per Seoul-calendar day in the window (ascending, zero-filled). */
  dailyTotals: { date: string; count: number }[];
  /** Same counts as byName, keyed for convenience (KPI funnel). */
  funnel: AdminAnalyticsFunnel;
  /** ANA-128: purchase_followup_answered의 answer 3갈래 분해. */
  purchaseFollowup: AdminPurchaseFollowupBreakdown;
  /**
   * 라운드 61 #5: onboarding_step_viewed의 step 단계별 분해 (레지스트리 순서, 0건 포함).
   *
   * 라운드 61 S-2 — 이 타입은 **지금 계약이 무엇을 주기로 했는가**의 미러라 필수로 둔다. 다만
   * 실행 시점의 응답은 그것과 다를 수 있다(정적 번들이 API보다 앞서 배포되거나 API가 롤백된
   * 경우 이 키가 아예 없다). 읽는 쪽은 그래서 `?? []`로 방어한다 —
   * `src/lib/onboarding-steps-view.ts`가 그 자리이고, 왜 0으로 그리는 것이 거짓이 아닌지의
   * 근거도 그 파일 머리말에 있다. 방어가 없으면 카드 하나가 아니라 분석 페이지 전체가 오류
   * 경계로 떨어진다.
   */
  onboardingSteps: AdminOnboardingStepBreakdown[];
  /** count(distinct user_anon_id) in the window. */
  uniqueAnonUsers: number;
};

export function getAdminAnalyticsSummary(days: AnalyticsSummaryDays) {
  return request<AdminAnalyticsSummary>(`/admin/analytics/summary?days=${days}`);
}

/** Session-expiry only: a role-forbidden (RBAC), CSRF, or MFA-setup-required 403
 * is not "log the admin out", so this intentionally checks 401 alone. */
export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401;
}

/** 정본: `apps/api/prisma/schema.prisma`의 `enum AdminRole`(선언 순서 그대로). */
export type AdminRole = "admin" | "editor" | "analyst";
export const ADMIN_ROLES: AdminRole[] = ["admin", "editor", "analyst"];
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: "관리자",
  editor: "편집자",
  analyst: "분석가"
};

export type AdminProfile = { id: string; email: string; displayName: string; role: AdminRole };

/**
 * GAP-064 #7: 세션 응답의 `mfaRecoveryCodesRemaining`은 **남은 복구 코드 장수**다.
 * 값도 해시도 아니고 개수만이며, 세션이 발급된 뒤의 응답에만 실린다(로그인 ok 분기 ·
 * verify-login · me). 복구 코드로 로그인한 경우 이 값은 방금 태운 한 장을 뺀 값이다.
 * 가산 필드라 이 키가 없던 응답과 섞여도 화면이 깨지지 않게 optional로 둔다 — 그때는
 * 잔량 줄을 그리지 않는다(모르는 것을 0으로 단정하지 않는다).
 */
export type AdminLoginResult =
  | { mfaRequired: true; mfaToken: string; expiresIn: number }
  | { mfaRequired: false; admin: AdminProfile; mfaEnabled: boolean; mfaRecoveryCodesRemaining?: number };

export function adminLogin(email: string, password: string) {
  return request<AdminLoginResult>("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function adminVerifyMfaLogin(mfaToken: string, code: string) {
  return request<Extract<AdminLoginResult, { mfaRequired: false }>>("/admin/auth/mfa/verify-login", {
    method: "POST",
    body: JSON.stringify({ mfaToken, code })
  });
}

export function adminMe() {
  return request<{ admin: AdminProfile; mfaEnabled: boolean; mfaRecoveryCodesRemaining?: number }>("/admin/auth/me");
}

export function adminLogout() {
  return request<{ success: true }>("/admin/auth/logout", { method: "POST" });
}

/** ADM-007: change the logged-in admin's own password. MFA-exempt on the API
 * side (same precedent as mfa/setup) so a freshly created admin can rotate the
 * one-time temp password from POST /admin/users before enrolling MFA. On
 * success the API revokes every OTHER session of the admin; the session that
 * performed the change stays valid. */
export function adminChangePassword(currentPassword: string, newPassword: string) {
  return request<{ success: true }>("/admin/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export function adminMfaSetupStart() {
  return request<{ otpauthUrl: string; secret: string; email: string }>("/admin/auth/mfa/setup/start", {
    method: "POST"
  });
}

export function adminMfaSetupVerify(code: string) {
  return request<{ recoveryCodes: string[] }>("/admin/auth/mfa/setup/verify", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export function adminMfaDisable(code: string) {
  return request<{ success: true }>("/admin/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
}

// COM-103: CMS draft -> review -> publish workflow. editor sessions route
// items/links/disclosures saves through these instead of the direct
// create/update endpoints above (see app/items,links,disclosures/page.tsx and
// app/reviews/page.tsx).
export type ContentRevisionEntityType = "item_template" | "product_link" | "disclosure";
// "publishing" is a short-lived internal state between an approve-publish/
// rollback CAS claim and the live write completing (see the API's M-2
// diff-review follow-up) -- included so a GET polled mid-flight round-trips
// through this type without falling outside the union.
export type ContentRevisionStatus = "draft" | "in_review" | "publishing" | "published" | "rejected" | "archived";

export type ContentRevision = {
  id: string;
  entityType: ContentRevisionEntityType;
  entityId: string | null;
  revisionNo: number;
  payload: Record<string, unknown>;
  status: ContentRevisionStatus;
  authorAdminId: string;
  reviewerAdminId: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentRevisionDetail = ContentRevision & { live: Record<string, unknown> | null };

export function listContentRevisions(filter?: {
  entityType?: ContentRevisionEntityType;
  entityId?: string;
  status?: ContentRevisionStatus;
}) {
  const params = new URLSearchParams();
  if (filter?.entityType) params.set("entityType", filter.entityType);
  if (filter?.entityId) params.set("entityId", filter.entityId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return request<{ revisions: ContentRevision[] }>(`/admin/content-revisions${qs ? `?${qs}` : ""}`);
}

export function getContentRevision(id: string) {
  return request<ContentRevisionDetail>(`/admin/content-revisions/${id}`);
}

export function createContentRevision(input: {
  entityType: ContentRevisionEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
}) {
  return request<ContentRevision>("/admin/content-revisions", { method: "POST", body: JSON.stringify(input) });
}

export function updateContentRevisionDraft(id: string, payload: Record<string, unknown>) {
  return request<ContentRevision>(`/admin/content-revisions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ payload })
  });
}

export function submitContentRevision(id: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/submit`, { method: "POST" });
}

/** R19-F: 서버 멱등키 적용 경로. 승인·게시가 타임아웃돼도 같은 키로 다시 보내면
 * 라이브 콘텐츠를 두 번 갱신하지 않고 첫 응답을 재생한다. */
export function approvePublishContentRevision(id: string, idempotencyKey?: string) {
  return request<ContentRevision>(
    `/admin/content-revisions/${id}/approve-publish`,
    { method: "POST" },
    idempotencyKey
  );
}

export function rejectContentRevision(id: string, note: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note })
  });
}

/** R20-D: 서버 멱등키 적용 경로. 롤백은 호출할 때마다 **새 리비전 행**을 만들고
 * 라이브 콘텐츠에 다시 쓰므로(대상은 계속 published라 상태 조건이 재실행을 막지
 * 못한다), 타임아웃 뒤 같은 키로 재시도하면 첫 응답을 재생해 이력에 유령 리비전이
 * 쌓이는 것을 막는다. */
export function rollbackContentRevision(id: string, idempotencyKey?: string) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/rollback`, { method: "POST" }, idempotencyKey);
}

/** COM-103b: set (ISO timestamp, must be in the future) or clear (null) the
 * scheduled-publish time on an in_review revision. Admin-only on the API side,
 * with the same author/approver separation as approve-publish — scheduling is
 * a publish decision. The actual publish is performed by the background worker
 * (a process started with WORKER_ENABLED=1) once the time arrives. */
export function scheduleContentRevision(id: string, scheduledFor: string | null) {
  return request<ContentRevision>(`/admin/content-revisions/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ scheduledFor })
  });
}

// ADM-006: admin account management. Every endpoint is admin-role-only on the
// API side (RequireAdminRoles("admin") in admin-users.controller.ts); the
// frontend additionally hides the page/nav for editor/analyst sessions (see
// app/users/page.tsx and AdminShell.tsx).
export type AdminUserAccount = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminUserCreateInput = { email: string; role: AdminRole; displayName?: string };
export type AdminUserUpdateInput = { role?: AdminRole; active?: boolean };

export function listAdminUsers() {
  return request<{ adminUsers: AdminUserAccount[] }>("/admin/users");
}

/** The `tempPassword` in this response is shown EXACTLY ONCE by the API and can
 * never be retrieved again — render it immediately, never persist it anywhere.
 *
 * R19-F: 그래서 이 경로에 서버 멱등키가 특히 중요하다. 키 없이 재시도하면 계정은
 * 이미 만들어져 있어 409 ADMIN_EMAIL_EXISTS로 막히고 임시 비밀번호는 영영 사라진다
 * (계정 삭제 API도 없다). 같은 키로 재시도하면 첫 응답이 tempPassword까지 그대로
 * 재생된다. */
export function createAdminUser(input: AdminUserCreateInput, idempotencyKey?: string) {
  return request<{ admin: AdminUserAccount; tempPassword: string }>(
    "/admin/users",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    idempotencyKey
  );
}

export function updateAdminUser(adminUserId: string, input: AdminUserUpdateInput) {
  return request<{ admin: AdminUserAccount }>(`/admin/users/${adminUserId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

/** ADM-006: the API 403s an admin demoting or deactivating their own account
 * (last-admin lockout prevention) with this dedicated code. */
export function isSelfUpdateForbiddenError(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === "ADMIN_SELF_UPDATE_FORBIDDEN";
}

// ADM-113: read-only audit log viewer. The API route is admin-role-only
// (RequireAdminRoles("admin") in audit-logs.controller.ts), same as ADM-006;
// the frontend hides the nav entry from editor/analyst sessions (AdminShell)
// and the page renders an access notice instead of a broken screen. The API
// masks credential-like values in before/after snapshots server-side.
export type AdminAuditLogEntry = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  /** actorUserId가 관리자 계정이면 그 이메일, 아니면 null (일반 사용자/시스템 행위). */
  actorEmail: string | null;
  householdId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ipHash: string | null;
};

export type AdminAuditLogsPageInfo = { total: number; limit: number; offset: number; hasMore: boolean };

export type AdminAuditLogsResult = { auditLogs: AdminAuditLogEntry[]; pageInfo: AdminAuditLogsPageInfo };

export type AdminAuditLogsQuery = {
  limit?: number;
  offset?: number;
  /** 액션 타입 정확 일치 (예: "admin.admin_user.update"). */
  action?: string;
  actorUserId?: string;
  /** createdAt >= from (ISO-8601). */
  from?: string;
  /** createdAt <= to (ISO-8601). */
  to?: string;
};

export function listAuditLogs(query?: AdminAuditLogsQuery) {
  const params = new URLSearchParams();
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.offset !== undefined) params.set("offset", String(query.offset));
  if (query?.action) params.set("action", query.action);
  if (query?.actorUserId) params.set("actorUserId", query.actorUserId);
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  const qs = params.toString();
  return request<AdminAuditLogsResult>(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
}

/** Convenience: draft-create then immediately submit for review, the shape
 * every editor save flow needs (create+submit is always paired in this CMS). */
export async function draftAndSubmitContentRevision(input: {
  entityType: ContentRevisionEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
}) {
  const draft = await createContentRevision(input);
  return await submitContentRevision(draft.id);
}

// ADM-127: 카테고리 운영 조회/수정. 조회(GET)는 로그인한 모든 어드민 역할에
// 열려 있고, 수정(PATCH)만 admin 전용이다(API의
// admin-categories.controller.ts — RequireAdminRoles("admin")). 그래서
// /categories 페이지는 editor/analyst에게도 표를 보여주되 편집 컨트롤만 감춘다.
//
// DNC-007: 생성·삭제 함수는 의도적으로 없다. 카테고리 행의 id/code는 모바일
// 퀵타일 별칭이 하드코딩해 쓰고 이미 저장된 지출이 참조하므로, 편집 축은
// 이름/순서/active/selectable 넷뿐이다.
export type AdminCategory = {
  id: string;
  code: string;
  name: string;
  iconName: string | null;
  displayOrder: number;
  isSystem: boolean;
  /** 행이 살아 있는가 — false면 `GET /categories`에서 완전히 빠진다. */
  active: boolean;
  /** CAT-124: 앱이 "고르라고" 내미는 선택지인가. active와 독립된 축. */
  selectable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryUpdateInput = {
  name?: string;
  displayOrder?: number;
  active?: boolean;
  selectable?: boolean;
};

export function listAdminCategories() {
  return request<{ categories: AdminCategory[] }>("/admin/categories");
}

export function updateAdminCategory(categoryId: string, input: AdminCategoryUpdateInput) {
  return request<{ category: AdminCategory }>(`/admin/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

// ADM-127: 최종 사용자 조회(CS 문의 대응). 읽기 전용이고 admin 전용이다
// (RequireAdminRoles("admin") — 개인정보를 다루므로 ADM-006/ADM-113과 같은 등급).
// 서버는 이 조회 자체도 감사 로그(admin.user_lookup.search)에 남긴다.
//
// 노출 범위는 서버가 select 화이트리스트로 좁혀 둔다 — 전화번호, 소셜 고유키,
// 프로필 이미지, 아이 생년월일/출산예정일, 그리고 지출 금액·품목은 응답에 없다.
// 지출은 **건수**(expenseCount)만 온다.
export type AdminLookupChildStageMode = "pregnant" | "born" | "manual";
export type AdminLookupMemberRole = "owner" | "co_parent" | "viewer" | "gift_participant";
export type AdminLookupMemberStatus = "pending" | "active" | "removed" | "left";
export type AdminLookupUserStatus = "active" | "withdrawn" | "blocked";
export type AdminLookupAuthProvider = "kakao" | "apple" | "google";

export type AdminLookupChild = {
  id: string;
  nickname: string;
  stageMode: AdminLookupChildStageMode;
};

export type AdminLookupHousehold = {
  id: string;
  name: string;
  role: AdminLookupMemberRole;
  memberStatus: AdminLookupMemberStatus;
  isOwner: boolean;
  children: AdminLookupChild[];
};

export type AdminLookupUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  authProvider: AdminLookupAuthProvider;
  status: AdminLookupUserStatus;
  createdAt: string;
  /** 마지막 활동 = users.last_login_at (기존 컬럼 그대로). */
  lastLoginAt: string | null;
  /** 탈퇴(soft delete) 시각. null이면 살아 있는 계정. */
  deletedAt: string | null;
  households: AdminLookupHousehold[];
  /** 살아 있는 지출 건수만 — 금액/품목은 서버가 내려주지 않는다. */
  expenseCount: number;
};

export type AdminUsersLookupResult = { users: AdminLookupUser[]; limit: number };

export function lookupAdminEndUsers(query: string, limit?: number) {
  const params = new URLSearchParams();
  params.set("query", query);
  if (limit !== undefined) params.set("limit", String(limit));
  return request<AdminUsersLookupResult>(`/admin/users-lookup?${params.toString()}`);
}
