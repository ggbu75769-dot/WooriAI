import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  AdminApiTimeoutError,
  WRITE_FETCH_TIMEOUT_MS,
  approvePublishContentRevision,
  bulkApplyProductLinks,
  createAdminUser,
  createIdempotencyKeyHolder,
  createItemTemplate,
  createProductLink,
  isIdempotentTimeoutError,
  isRetryUnsafeTimeoutError,
  newIdempotencyKey,
  rollbackContentRevision,
  updateAdminUser
} from "./lib/admin-api";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const SAMPLE_CSV = "productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x";

/**
 * R19-F: 서버 멱등키(IdempotencyInterceptor)가 붙은 admin 쓰기 경로에 대해
 * 클라이언트가 지켜야 하는 계약.
 *
 * 핵심은 "요청 1회당 새 키"가 아니라 **"시도 1회당 1키, 재시도는 같은 키"** 다 —
 * 매번 새 키를 만들면 서버에는 서로 다른 두 요청으로 보여 멱등 장치가 아무것도
 * 막아 주지 못한다. 반대로 body가 바뀐 뒤에도 같은 키를 재사용하면 서버가
 * 409 IDEMPOTENCY_KEY_CONFLICT로 거절한다. 그 두 실패 모드를 홀더가 막는다.
 */
describe("멱등키 홀더 — 시도당 1키, 재시도 시 재사용, 성공/입력 변경 시 회전 (R19-F)", () => {
  /** 발급 순서를 눈으로 확인할 수 있게 결정적인 생성기를 쓴다. */
  function countingHolder() {
    let counter = 0;
    return createIdempotencyKeyHolder(() => `key-${++counter}`);
  }

  it("같은 시도 안에서는 계속 같은 키를 돌려준다 (재시도가 중복으로 처리되지 않는 지점)", () => {
    const holder = countingHolder();

    expect(holder.current()).toBe("key-1");
    expect(holder.current()).toBe("key-1");
    expect(holder.current()).toBe("key-1");
  });

  it("rotate() 뒤에는 새 키를 발급한다 (성공한 시도는 끝났으므로)", () => {
    const holder = countingHolder();

    expect(holder.current()).toBe("key-1");
    holder.rotate();
    expect(holder.current()).toBe("key-2");
  });

  it("지문(요청 body)이 그대로면 키를 유지하고, 바뀌면 자동으로 회전한다", () => {
    const holder = countingHolder();

    expect(holder.current("csv-a")).toBe("key-1");
    expect(holder.current("csv-a")).toBe("key-1");
    // body가 바뀌었다 — 같은 키를 재사용하면 서버가 409로 막으므로 새 키여야 한다.
    expect(holder.current("csv-b")).toBe("key-2");
    expect(holder.current("csv-b")).toBe("key-2");
    // 되돌아가도 "직전과 다른 body"이므로 새 시도로 취급한다.
    expect(holder.current("csv-a")).toBe("key-3");
  });

  it("peek()는 발급 전 null이고 rotate() 뒤 다시 null이 된다", () => {
    const holder = countingHolder();

    expect(holder.peek()).toBeNull();
    holder.current("x");
    expect(holder.peek()).toBe("key-1");
    holder.rotate();
    expect(holder.peek()).toBeNull();
  });

  it("newIdempotencyKey는 매번 다른 값을 만들고 서버 컬럼 상한(120자) 안에 든다", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));

    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("admin API 클라이언트의 Idempotency-Key 전송 (R19-F)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function headersOfCall(index = 0): Record<string, string> {
    const [, init] = fetchMock.mock.calls[index] as [string, RequestInit];
    return init.headers as Record<string, string>;
  }

  it("키를 넘기면 쓰기 요청에 Idempotency-Key 헤더를 싣는다 (CSRF 헤더는 그대로)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { applied: 500, skipped: 0, errors: 0 }));

    await bulkApplyProductLinks(SAMPLE_CSV, "attempt-key-1");

    expect(headersOfCall()["Idempotency-Key"]).toBe("attempt-key-1");
    expect(headersOfCall()["X-CSRF-Token"]).toBe("csrf-token-123");
  });

  it("키를 안 넘기면 헤더를 붙이지 않는다 — 서버는 기존(비멱등) 동작을 유지한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { applied: 500, skipped: 0, errors: 0 }));

    await bulkApplyProductLinks(SAMPLE_CSV);

    expect(headersOfCall()).not.toHaveProperty("Idempotency-Key");
  });

  it("같은 키로 두 번 호출하면 두 요청 모두 같은 헤더 값을 보낸다 (재시도 계약)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { applied: 500, skipped: 0, errors: 0 }));
    const holder = createIdempotencyKeyHolder();

    await bulkApplyProductLinks(SAMPLE_CSV, holder.current(SAMPLE_CSV));
    await bulkApplyProductLinks(SAMPLE_CSV, holder.current(SAMPLE_CSV));

    expect(headersOfCall(0)["Idempotency-Key"]).toBe(headersOfCall(1)["Idempotency-Key"]);
  });

  it("서버 멱등키가 붙은 나머지 경로도 헤더를 실어 보낸다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await createAdminUser({ email: "a@b.com", role: "editor" }, "users-key");
    await createItemTemplate({ name: "템플릿" }, "items-key");
    await createProductLink({ title: "링크" }, "links-key");
    await approvePublishContentRevision("rev-1", "approve-key");
    await rollbackContentRevision("rev-0", "rollback-key");

    expect(headersOfCall(0)["Idempotency-Key"]).toBe("users-key");
    expect(headersOfCall(1)["Idempotency-Key"]).toBe("items-key");
    expect(headersOfCall(2)["Idempotency-Key"]).toBe("links-key");
    expect(headersOfCall(3)["Idempotency-Key"]).toBe("approve-key");
    // R20-D
    expect(headersOfCall(4)["Idempotency-Key"]).toBe("rollback-key");
  });

  it("서버 멱등키가 없는 쓰기(PATCH 수정류)는 키를 받지 않으므로 헤더도 없다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { admin: {} }));

    await updateAdminUser("admin-id", { role: "analyst" });

    expect(headersOfCall()).not.toHaveProperty("Idempotency-Key");
  });
});

/**
 * FIX-118C는 서버 멱등키가 없다는 이유로 쓰기 타임아웃 문구에서 재시도 권유를
 * 뺐다. R19-F로 그 전제가 바뀐 경로에서는 문구를 다시 완화한다 — 단, 완화는
 * 실제로 키를 실어 보낸 요청에 한정된다.
 */
describe("멱등 쓰기의 타임아웃 안내 완화 (R19-F)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function hangingFetch(_url: string, init: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  }

  it("키를 실어 보낸 쓰기의 타임아웃은 재시도를 권하고 retryUnsafe가 꺼진다", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);

    const pending = bulkApplyProductLinks(SAMPLE_CSV, "attempt-key-1").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(WRITE_FETCH_TIMEOUT_MS);
    const failure = await pending;

    expect(failure).toBeInstanceOf(AdminApiTimeoutError);
    expect((failure as AdminApiTimeoutError).method).toBe("POST");
    expect((failure as AdminApiTimeoutError).idempotent).toBe(true);
    expect((failure as AdminApiTimeoutError).retryUnsafe).toBe(false);
    expect(isIdempotentTimeoutError(failure)).toBe(true);
    expect(isRetryUnsafeTimeoutError(failure)).toBe(false);
    expect((failure as AdminApiError).message).toContain("같은 요청을 다시 보내면 중복 없이 처리돼요");
  });

  it("키 없는 쓰기의 타임아웃은 FIX-118C 그대로 재시도를 권하지 않는다", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);

    const pending = bulkApplyProductLinks(SAMPLE_CSV).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(WRITE_FETCH_TIMEOUT_MS);
    const failure = await pending;

    expect((failure as AdminApiTimeoutError).idempotent).toBe(false);
    expect((failure as AdminApiTimeoutError).retryUnsafe).toBe(true);
    expect(isIdempotentTimeoutError(failure)).toBe(false);
    expect((failure as AdminApiError).message).toContain("반영 여부가 확실하지 않으니");
  });

  it("읽기 타임아웃은 멱등 판정 대상이 아니다", async () => {
    expect(isIdempotentTimeoutError(new AdminApiTimeoutError(new Error("x"), "GET", true))).toBe(false);
    expect(isIdempotentTimeoutError(new AdminApiError(0, "연결 실패"))).toBe(false);
    expect(isIdempotentTimeoutError(null)).toBe(false);
  });
});

/**
 * 홀더를 들고는 있지만 매 렌더/매 클릭마다 새로 만들거나, 실패 경로에서 회전해
 * 버리면 멱등 계약이 조용히 깨진다. 회전 지점이 "성공"과 "입력 변경(지문)"에만
 * 있는지 소스로 고정한다.
 */
describe("호출부가 시도 세션당 키를 유지한다 (R19-F)", () => {
  it("bulk-apply 패널: useRef로 홀더를 고정하고, CSV 지문으로 키를 잡고, 성공에서만 회전한다", () => {
    const source = readSource("src/components/ProductLinkBulkReplace.tsx");

    expect(source).toContain("useRef(createIdempotencyKeyHolder()).current");
    expect(source).toContain("bulkApplyProductLinks(csv, applyKey.current(csv))");
    // 회전은 성공 직후 한 곳뿐 — 타임아웃/실패 경로에서 회전하면 재시도가 새
    // 요청이 되어 500행이 두 번 반영될 수 있다.
    expect(source.match(/applyKey\.rotate\(\)/g)).toHaveLength(1);
    // 멱등 타임아웃은 재시도를 권하는 분기로 따로 처리한다.
    expect(source).toContain("isIdempotentTimeoutError");
    expect(source).toContain("같은 요청을 다시 보내면 중복 없이 처리되니");
  });

  it("관리자 계정 생성: 요청 body를 지문으로 키를 잡고, 생성 성공에서만 회전한다", () => {
    const source = readSource("app/users/page.tsx");

    expect(source).toContain("useRef(createIdempotencyKeyHolder()).current");
    expect(source).toContain("createAdminUser(input, createKey.current(JSON.stringify(input)))");
    expect(source.match(/createKey\.rotate\(\)/g)).toHaveLength(1);
    // 타임아웃 재시도는 "입력값을 바꾸지 말고" 다시 누르라고 안내해야 한다 —
    // 입력이 바뀌면 지문이 달라져 새 키가 되고 멱등 보호가 사라지기 때문이다.
    expect(source).toContain("입력값을 바꾸지 말고");
  });

  it("생성류·승인 게시 화면도 같은 홀더 패턴을 쓴다", () => {
    const items = readSource("app/items/page.tsx");
    expect(items).toContain("createItemTemplate(input, createKey.current(JSON.stringify(input)))");
    expect(items.match(/createKey\.rotate\(\)/g)).toHaveLength(1);

    const links = readSource("app/links/page.tsx");
    expect(links).toContain("createProductLink(input, createKey.current(JSON.stringify(input)))");
    expect(links.match(/createKey\.rotate\(\)/g)).toHaveLength(1);

    const reviews = readSource("app/reviews/page.tsx");
    expect(reviews).toContain("approvePublishContentRevision(detail.id, approveKey.current(detail.id))");
    expect(reviews.match(/approveKey\.rotate\(\)/g)).toHaveLength(1);
    // R20-D: 롤백도 같은 홀더 패턴 — 지문은 롤백 대상 리비전 id.
    expect(reviews).toContain("rollbackContentRevision(revisionId, rollbackKey.current(revisionId))");
    expect(reviews.match(/rollbackKey\.rotate\(\)/g)).toHaveLength(1);
  });
});

/**
 * 서버 쪽 부착이 빠지면 클라이언트가 헤더를 보내도 아무 효과가 없다(인터셉터가
 * 없는 라우트에서 헤더는 그냥 무시된다). 부착 지점을 소스로 고정해 조용한
 * 회귀를 막는다.
 */
describe("서버 쪽 인터셉터 부착 (R19-F)", () => {
  const apiRoot = join(adminRoot, "..", "api");

  function readApiSource(relativePath: string): string {
    const filePath = join(apiRoot, relativePath);
    expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
    return readFileSync(filePath, "utf8");
  }

  it("bulk-apply · 계정 생성 · 생성류 · 승인 게시에 IdempotencyInterceptor가 붙어 있다", () => {
    const bulk = readApiSource("src/admin/product-link-bulk.controller.ts");
    expect(bulk).toContain("@UseInterceptors(IdempotencyInterceptor)");
    // 미리보기는 쓰기가 아니라 부착 대상이 아니다.
    expect(bulk.match(/@UseInterceptors\(IdempotencyInterceptor\)/g)).toHaveLength(1);

    const users = readApiSource("src/admin/admin-users.controller.ts");
    expect(users.match(/@UseInterceptors\(IdempotencyInterceptor\)/g)).toHaveLength(1);

    const admin = readApiSource("src/admin/admin.controller.ts");
    expect(admin.match(/@UseInterceptors\(IdempotencyInterceptor\)/g)).toHaveLength(2);

    // R20-D: approve-publish + rollback 두 곳. 나머지 상태 전이 POST
    // (submit/reject/schedule)는 CAS만으로 재시도 안전이라 일부러 비워 둔다 —
    // 과잉 부착 회귀를 이 개수로 막는다.
    const revisions = readApiSource("src/admin/content-revisions.controller.ts");
    expect(revisions.match(/@UseInterceptors\(IdempotencyInterceptor\)/g)).toHaveLength(2);
  });

  it("R20-D: 잔여 상태 전이 POST 중 rollback에만 붙고 submit/reject/schedule은 CAS로 남는다", () => {
    const revisions = readApiSource("src/admin/content-revisions.controller.ts");
    // 부착 지점은 rollback 핸들러 바로 위여야 한다.
    expect(revisions).toMatch(
      /@UseInterceptors\(IdempotencyInterceptor\)\s*\n\s*async rollback\(/
    );
    // 비부착 라우트에는 판단 근거(왜 안 붙였는지)가 주석으로 남아 있어야 한다.
    for (const handler of ["submit", "reject", "schedule"]) {
      const body = revisions.slice(0, revisions.indexOf(`async ${handler}(`));
      expect(body, `${handler}는 비부착 근거 주석을 가져야 한다`).toContain("멱등키 **비부착**");
    }
  });

  it("인터셉터는 admin 세션(request.adminUser)을 스코프로 인정한다", () => {
    const interceptor = readApiSource("src/common/idempotency/idempotency.interceptor.ts");
    expect(interceptor).toContain("request.user?.id ?? request.adminUser?.id");
    // idempotency_keys.user_id가 uuid 컬럼이라 uuid가 아닌 actor id(레거시
    // x-admin-token의 "dev-admin")는 결정적 uuid로 접어 넣는다.
    expect(interceptor).toContain("toActorUuid");
  });
});
