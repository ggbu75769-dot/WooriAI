import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_ERROR_MESSAGES,
  ApiHttpError,
  apiErrorCodeOf,
  apiErrorMessage,
  parseApiErrorEnvelope
} from "./api-error";
import { createExcelImport, getItemDetail, updateItemStatus } from "./client";
import { createMemoryOfflineStore } from "../offline/memory-offline-store";
import { isRetryableSyncError } from "../offline/permission-denied";
import { createClientRemoteExpenseApi } from "../offline/remote-api";
import {
  MAX_SERVER_ERROR_ATTEMPTS,
  SERVER_ERROR_GIVE_UP_MESSAGE,
  SERVER_TRANSIENT_ERROR_MESSAGE,
  flushOutbox,
  recordLocalItemStatus,
  retryableClientErrorSyncMessage
} from "../offline/sync-engine";
import type { ItemStatusOutboxRow, OfflineStore } from "../offline/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 프록시(Caddy 등)가 앱과 서버 사이에서 직접 내는 응답 — 본문이 JSON이 아니다. */
function htmlResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function itemRows(store: OfflineStore): Promise<ItemStatusOutboxRow[]> {
  return store.listItemStatusMutations();
}

/**
 * 라운드 106 B-4 — **HTTP 경계에서 status를 잃지 않는다.**
 *
 * ## 종전 동작과 그 끝
 *
 * `src/api/client.ts`의 전송 셋 중 지출 경로(`requestExpenseJson`)만 `response.json()`을
 * `.catch(() => null)`로 접고 있었다. `requestJson`·`requestMultipartJson`은 무방비였다 —
 * 본문이 JSON이 아니면 파싱이 그 자리에서 `SyntaxError`로 터지고, **응답의 status가 통째로
 * 사라진 채** 호출부로 나갔다. 비-JSON 응답은 가정이 아니라 상시 경로다: 앱과 서버 사이의
 * 프록시는 게이트웨이 실패를 HTML 502·504로 내려보낸다.
 *
 * status가 없는 실패는 오프라인 엔진에서 "기기가 오프라인"과 구분되지 않는다. 그래서
 * `requestJson`을 타는 **준비템 상태 큐**에서는 라운드 104가 세운 분류가 설계대로 돌지 못했다.
 *   - 비-JSON 5xx에 `MAX_SERVER_ERROR_ATTEMPTS`(8회) 상한이 걸리지 않아, 프록시가 계속 502를
 *     내는 동안 같은 행이 상한 없이 pending으로 재시도됐다(사용자에게는 재시도/삭제 UI가 없다).
 *   - 비-JSON 429·401도 `retryableClientErrorStatus`에 잡히지 않아, 라운드 104가 지정한 문구
 *     대신 파서의 원문(`Unexpected token '<' ...`)이 동기화 상태 화면에 그대로 남았다.
 *
 * ## 이제
 *
 * 세 전송이 **같은 파싱 규칙**을 쓴다. 본문이 JSON이 아니면 `null`로 접고 status는 살려서
 * `ApiHttpError`에 싣는다. 아래 테스트는 그 사실을 문장이 아니라 **값**으로 잠근다 —
 * 특히 §3은 준비템 큐를 실제로 8번 돌려 상한이 걸리는 것을 확인한다.
 */
describe("라운드 106 B-4: 비-JSON 응답에서도 status가 보존된다", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("§1 세 전송의 파싱이 대칭이다 (소스 계약)", () => {
    it("client.ts의 전송 셋이 모두 존재하고, 무방비 파싱이 하나도 남아 있지 않다", () => {
      const client = source("src/api/client.ts");
      // 양쪽 끝 존재 가드 — 셋 중 하나라도 이름이 바뀌면 아래 카운트가 조용히 통과하지 않는다.
      expect(client).toContain("async function requestJson<T>(");
      expect(client).toContain("async function requestMultipartJson<T>(");
      expect(client).toContain("async function requestExpenseJson<T>(");

      // 무방비 파싱(`(await response.json()) as T`)이 0개.
      expect(client.split("(await response.json()) as T").length - 1).toBe(0);
      // 접힌 파싱은 넷: refreshAccessToken + requestJson + requestMultipartJson + requestExpenseJson.
      expect(client.split("response.json().catch(() => null)").length - 1).toBe(4);
    });
  });

  describe("§2 requestJson(준비템 경로): 비-JSON 502가 ApiHttpError(502)로 온다", () => {
    it("HTML 502에서 SyntaxError가 아니라 status를 든 ApiHttpError가 나온다", async () => {
      const fetchMock = vi.fn(async () => htmlResponse(502, "<html><head><title>502 Bad Gateway</title></head></html>"));
      vi.stubGlobal("fetch", fetchMock);

      const error = await updateItemStatus("real-access-token", "child-1", "item-carseat", "prepared").then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect(error).toBeInstanceOf(ApiHttpError);
      // 종전에는 여기가 SyntaxError였고 status라는 필드 자체가 없었다.
      expect((error as ApiHttpError).status).toBe(502);
      expect((error as ApiHttpError).body).toBeNull();
      expect((error as ApiHttpError).code).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("GET 경로(getItemDetail)도 같다 — 504 게이트웨이 타임아웃 본문", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(504, "gateway timeout")));

      const error = await getItemDetail("real-access-token", "child-1", "item-carseat").then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect(error).toBeInstanceOf(ApiHttpError);
      expect((error as ApiHttpError).status).toBe(504);
    });

    it("2xx 본문이 JSON이면 종전 그대로 값이 온다 (접기가 성공 경로를 바꾸지 않는다)", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { id: "item-carseat", name: "카시트" })));

      const detail = await getItemDetail("real-access-token", "child-1", "item-carseat");

      expect(detail).toMatchObject({ id: "item-carseat" });
    });
  });

  describe("§3 준비템 큐에서 라운드 104 분류가 값으로 돈다", () => {
    /**
     * 여기서 확인하는 것은 client.ts 한 줄이 아니라 **그 한 줄이 살려 보낸 status가 엔진까지
     * 닿는가**다. 전송은 실제 `createClientRemoteExpenseApi`(remote-api.ts)를 쓰고, fetch만
     * 프록시 응답으로 바꾼다 — 중간에 페이크를 끼우면 status가 어디서 끊겼는지 알 수 없다.
     */
    it("비-JSON 502: 행이 5xx transient로 읽히고 8회 상한에서 'failed'로 올라간다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(502, "<html>502 Bad Gateway</html>")));
      const store = createMemoryOfflineStore();
      const remote = createClientRemoteExpenseApi("real-access-token");
      await recordLocalItemStatus(store, {
        childId: "child-1",
        itemTemplateId: "item-carseat",
        status: "prepared",
        itemName: "카시트"
      });

      for (let attempt = 1; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
        await flushOutbox(store, remote);
        const [row] = await itemRows(store);
        expect(row.syncState, `attempt ${attempt}`).toBe("pending");
        expect(row.attemptCount, `attempt ${attempt}`).toBe(attempt);
        // 사유 채널에 status가 남는다 — 종전(SyntaxError)에는 여기가 null이었다.
        expect(row.lastErrorStatus, `attempt ${attempt}`).toBe(502);
        expect(row.lastError, `attempt ${attempt}`).toBe(SERVER_TRANSIENT_ERROR_MESSAGE);
        // 백오프를 건너뛰어 다음 pass를 바로 돌린다(시간이 아니라 상한을 보는 테스트다).
        await store.updateItemStatusMutation(row.mutationId, { nextRetryAt: null });
      }

      await flushOutbox(store, remote);
      const [row] = await itemRows(store);
      expect(row.attemptCount).toBe(MAX_SERVER_ERROR_ATTEMPTS);
      // 상한이 걸린다 — 종전에는 status가 없어 cappedTransientStatus가 null이라 영영 pending이었다.
      expect(row.syncState).toBe("failed");
      expect(row.lastError).toBe(SERVER_ERROR_GIVE_UP_MESSAGE);
      expect(row.lastErrorStatus).toBe(502);
    });

    it("비-JSON 429: 재시도 가능 4xx로 읽혀 라운드 104의 문구와 상한을 받는다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(429, "<html>429 Too Many Requests</html>")));
      const store = createMemoryOfflineStore();
      const remote = createClientRemoteExpenseApi("real-access-token");
      await recordLocalItemStatus(store, {
        childId: "child-1",
        itemTemplateId: "item-bottle",
        status: "prepared",
        itemName: "젖병"
      });

      // 판정의 단일 소스가 실제로 이 status를 재시도 가능이라고 답하는지 먼저 못 박는다.
      expect(isRetryableSyncError(429)).toBe(true);

      await flushOutbox(store, remote);
      const [first] = await itemRows(store);
      expect(first.syncState).toBe("pending");
      expect(first.lastErrorStatus).toBe(429);
      expect(first.lastError).toBe(retryableClientErrorSyncMessage(429, "retrying"));

      for (let attempt = 2; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
        const [row] = await itemRows(store);
        await store.updateItemStatusMutation(row.mutationId, { nextRetryAt: null });
        await flushOutbox(store, remote);
      }
      const [beforeCap] = await itemRows(store);
      await store.updateItemStatusMutation(beforeCap.mutationId, { nextRetryAt: null });
      await flushOutbox(store, remote);

      const [capped] = await itemRows(store);
      expect(capped.attemptCount).toBe(MAX_SERVER_ERROR_ATTEMPTS);
      expect(capped.syncState).toBe("failed");
      expect(capped.lastError).toBe(retryableClientErrorSyncMessage(429, "gave-up"));
    });
  });

  describe("§4 에러 봉투 파서는 종전과 같이 동작한다", () => {
    it("봉투가 오면 code/문구가 종전 그대로다 (접기가 봉투 경로를 건드리지 않는다)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(403, { error: { code: "FORBIDDEN", message: "권한이 없습니다.", requestId: "req-1" } }))
      );

      const error = await updateItemStatus("real-access-token", "child-1", "item-carseat", "prepared").then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect((error as ApiHttpError).status).toBe(403);
      expect((error as ApiHttpError).code).toBe("FORBIDDEN");
      expect(apiErrorMessage(error, "폴백")).toBe(API_ERROR_MESSAGES.FORBIDDEN);
      // message는 예전 `JSON.stringify(data)` 그대로 — 문자열을 파싱하는 기존 소비자 무파괴.
      expect((error as ApiHttpError).message).toContain("FORBIDDEN");
    });

    it("봉투 모양이 아니면 null → 호출부 폴백 (본문이 JSON이든 아니든 같다)", async () => {
      // 봉투가 아닌 JSON.
      expect(parseApiErrorEnvelope({ message: "nope" })).toBeNull();
      // 접기가 만든 null 본문.
      expect(parseApiErrorEnvelope(null)).toBeNull();

      vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(502, "<html>502</html>")));
      const error = await updateItemStatus("real-access-token", "child-1", "item-carseat", "prepared").then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect(apiErrorCodeOf(error)).toBeNull();
      expect(apiErrorMessage(error, "요청을 처리하지 못했어요.")).toBe("요청을 처리하지 못했어요.");
      // 본문이 null이어도 message는 문자열이라 기존 `instanceof Error` 소비자가 그대로 받는다.
      expect((error as ApiHttpError).message).toBe("null");
    });
  });

  describe("§5 requestMultipartJson(가져오기 업로드)도 같은 규칙이다", () => {
    it("업로드 중 프록시 502에서 status를 든 ApiHttpError가 나온다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(502, "<html>502 Bad Gateway</html>")));

      const error = await createExcelImport("real-access-token", "child-1", {
        uri: "file:///tmp/expenses.xlsx",
        name: "expenses.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }).then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect(error).toBeInstanceOf(ApiHttpError);
      expect((error as ApiHttpError).status).toBe(502);
    });

    it("업로드 거절(봉투 있는 4xx)의 code는 종전 그대로 전달된다", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse(400, { error: { code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." } })
        )
      );

      const error = await createExcelImport("real-access-token", "child-1", {
        uri: "file:///tmp/expenses.xlsx",
        name: "expenses.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }).then(
        () => null,
        (thrown: unknown) => thrown
      );

      expect((error as ApiHttpError).status).toBe(400);
      expect((error as ApiHttpError).code).toBe("IMPORT_TOO_MANY_ROWS");
      expect(apiErrorMessage(error, "폴백")).toBe(API_ERROR_MESSAGES.IMPORT_TOO_MANY_ROWS);
    });
  });

  it("API_BASE_URL이 계약대로 /api/v1을 가리킨다 (경로 가드)", () => {
    expect(API_BASE_URL).toContain("/api/v1");
  });
});
