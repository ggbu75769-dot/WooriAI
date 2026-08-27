import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R19-E (정찰 발견 10): src/offline/remote-api.ts는 client.ts의 예외 타입을
 * sync-engine.ts의 예외 타입으로 옮기는 **유일한** 어댑터인데 전용 테스트가 없었다.
 * flushOutbox의 세 갈래 분기(conflict / failed / transient-retry)가 전부 이 파일의
 * 번역 결과에 달려 있으므로, 여기서는 client.ts를 모킹해 "무엇이 들어가면 무엇이
 * 나오는가"만 좁게 고정한다 — HTTP 계약 자체는 client-*.test.ts가, 번역된 예외를
 * 받아 상태로 옮기는 쪽은 sync-engine.test.ts가 이미 덮는다.
 *
 * 모킹 방식: 에러 클래스(ExpenseHttpError/ExpenseVersionConflictError)는 어댑터가
 * `instanceof`로 분기하므로 반드시 실물이어야 한다. 그래서 importOriginal로 모듈을
 * 그대로 가져온 뒤 세 개의 요청 함수만 vi.fn()으로 갈아 끼운다.
 */
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    createExpenseWithIdempotency: vi.fn(),
    updateExpenseWithVersion: vi.fn(),
    deleteExpenseWithVersion: vi.fn()
  };
});

import {
  createExpenseWithIdempotency,
  deleteExpenseWithVersion,
  updateExpenseWithVersion,
  ExpenseHttpError,
  ExpenseVersionConflictError,
  type Expense
} from "../api/client";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { createClientRemoteExpenseApi } from "./remote-api";
import type { ExpensePayload } from "./types";

const createMock = vi.mocked(createExpenseWithIdempotency);
const updateMock = vi.mocked(updateExpenseWithVersion);
const deleteMock = vi.mocked(deleteExpenseWithVersion);

const TOKEN = "access-token-1";

function makePayload(overrides: Partial<ExpensePayload> = {}): ExpensePayload {
  return {
    childId: "child-1",
    categoryId: "cat-diaper",
    amountKrw: 12000,
    spentOn: "2026-07-14",
    itemName: "기저귀",
    merchant: "쿠팡",
    memo: "대형 박스",
    paymentMethod: "card",
    linkedItemTemplateId: "tpl-1",
    expenseType: "expense",
    ...overrides
  };
}

function makeServerExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    childId: "child-1",
    categoryId: "cat-diaper",
    amountKrw: 12000,
    spentOn: "2026-07-14",
    itemName: "기저귀",
    merchant: "쿠팡",
    memo: "대형 박스",
    expenseType: "expense",
    source: "manual",
    version: 3,
    ...overrides
  };
}

/** 어댑터가 던진 예외를 잡아 돌려준다 (resolve 하면 테스트 실패). */
async function captureThrown(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the adapter to throw, but it resolved");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createClientRemoteExpenseApi -- 성공 경로와 client.ts 호출 인자", () => {
  it("createExpense는 토큰/childId/멱등키를 그대로 넘기고, 응답에서 {id, version}만 남긴다", async () => {
    createMock.mockResolvedValue(makeServerExpense({ id: "exp-new", version: 1 }));
    const api = createClientRemoteExpenseApi(TOKEN);

    const result = await api.createExpense(makePayload(), "idem-create-1");

    // 서버 응답에는 itemName/source 등이 함께 오지만 sync-engine이 쓰는 건 id/version뿐 —
    // 어댑터가 그 좁은 계약(RemoteCreateResult)으로 줄이는 것이 이 테스트의 대상이다.
    expect(result).toEqual({ id: "exp-new", version: 1 });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      TOKEN,
      "child-1",
      {
        categoryId: "cat-diaper",
        amountKrw: 12000,
        spentOn: "2026-07-14",
        itemName: "기저귀",
        merchant: "쿠팡",
        paymentMethod: "card",
        memo: "대형 박스",
        linkedItemTemplateId: "tpl-1",
        expenseType: "expense"
      },
      "idem-create-1"
    );
  });

  it("createExpense는 null 가능 필드(merchant/memo/linkedItemTemplateId)를 undefined로 정규화한다", async () => {
    createMock.mockResolvedValue(makeServerExpense({ id: "exp-new", version: 1 }));
    const api = createClientRemoteExpenseApi(TOKEN);

    await api.createExpense(
      makePayload({ merchant: null, memo: null, linkedItemTemplateId: null }),
      "idem-create-2"
    );

    // 로컬 payload는 "값 없음"을 null로 들고 있지만 wire body는 undefined(=키 생략)여야
    // JSON.stringify가 그 키를 아예 빼고, 서버 DTO의 optional 계약과 맞는다.
    const body = createMock.mock.calls[0][2];
    expect(body.merchant).toBeUndefined();
    expect(body.memo).toBeUndefined();
    expect(body.linkedItemTemplateId).toBeUndefined();
  });

  it("updateExpense는 PATCH가 받는 필드만 추려 보내고, 응답에서 version만 남긴다", async () => {
    updateMock.mockResolvedValue(makeServerExpense({ version: 4 }));
    const api = createClientRemoteExpenseApi(TOKEN);

    const result = await api.updateExpense("exp-1", makePayload(), 3, "idem-update-1");

    expect(result).toEqual({ version: 4 });
    expect(updateMock).toHaveBeenCalledWith(
      TOKEN,
      "exp-1",
      {
        categoryId: "cat-diaper",
        amountKrw: 12000,
        spentOn: "2026-07-14",
        itemName: "기저귀",
        memo: "대형 박스",
        expenseType: "expense"
      },
      3,
      "idem-update-1"
    );
    // childId/merchant/paymentMethod/linkedItemTemplateId는 client.ts의
    // UpdateExpenseBody(=서버 UpdateExpenseDto)에 없는 필드라 의도적으로 빠진다 —
    // 넣으면 서버가 400으로 거절하므로 이 누락은 계약이지 버그가 아니다.
    const patch = updateMock.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(
      ["amountKrw", "categoryId", "expenseType", "itemName", "memo", "spentOn"].sort()
    );
  });

  it("updateExpense는 memo=null을 undefined로 바꿔 '변경 없음'으로 보낸다", async () => {
    updateMock.mockResolvedValue(makeServerExpense({ version: 4 }));
    const api = createClientRemoteExpenseApi(TOKEN);

    await api.updateExpense("exp-1", makePayload({ memo: null }), 3, "idem-update-2");

    // 편집 화면은 메모를 비울 때 빈 문자열("")을 보내므로(app/expenses/[expenseId].tsx)
    // 실제 "메모 지우기"는 여기서 undefined가 되지 않는다 — null은 애초에 값이 없던
    // 행에서만 온다. 그 구분을 고정해 둔다.
    expect(updateMock.mock.calls[0][2].memo).toBeUndefined();
    updateMock.mockClear();

    await api.updateExpense("exp-1", makePayload({ memo: "" }), 3, "idem-update-3");
    expect(updateMock.mock.calls[0][2].memo).toBe("");
  });

  it("deleteExpense는 인자를 그대로 넘기고 응답 본문을 버린다", async () => {
    deleteMock.mockResolvedValue({ success: true });
    const api = createClientRemoteExpenseApi(TOKEN);

    await expect(api.deleteExpense("exp-1", 3, "idem-delete-1")).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith(TOKEN, "exp-1", 3, "idem-delete-1");
  });
});

describe("409 스냅숏 변환 (toEngineConflictSnapshot)", () => {
  /** 409를 create 경로로 흘려 번역된 RemoteVersionConflictError를 돌려받는다. */
  async function conflictFrom(current: ConstructorParameters<typeof ExpenseVersionConflictError>[0]) {
    createMock.mockRejectedValue(new ExpenseVersionConflictError(current));
    const api = createClientRemoteExpenseApi(TOKEN);
    const error = await captureThrown(() => api.createExpense(makePayload(), "idem-conflict"));
    expect(error).toBeInstanceOf(RemoteVersionConflictError);
    return error as RemoteVersionConflictError;
  }

  it("current=null은 null 스냅숏 그대로 전달한다", async () => {
    const error = await conflictFrom(null);
    // sync-engine의 flushOutbox는 current===null을 '해결 불가'로 보고 conflict가 아닌
    // failed로 보낸다 — 그 분기가 성립하려면 null이 null로 살아 있어야 한다.
    expect(error.current).toBeNull();
  });

  it("톰스톤(deleted:true)은 {deleted:true,id,version} 모양으로 옮긴다", async () => {
    const error = await conflictFrom({ id: "exp-1", deleted: true, version: 9 });
    expect(error.current).toEqual({ deleted: true, id: "exp-1", version: 9 });
  });

  it("live 지출은 deleted:false + expense 필드로 옮긴다 (서버 전용 필드는 버린다)", async () => {
    const error = await conflictFrom(makeServerExpense({ version: 7 }));

    expect(error.current).toEqual({
      deleted: false,
      expense: {
        id: "exp-1",
        version: 7,
        childId: "child-1",
        categoryId: "cat-diaper",
        amountKrw: 12000,
        spentOn: "2026-07-14",
        itemName: "기저귀",
        merchant: "쿠팡",
        memo: "대형 박스",
        expenseType: "expense"
      }
    });
    // wire 모양(§2.2)에는 live 케이스를 가리키는 discriminant가 없다 — 어댑터가
    // deleted:false를 새로 붙여 sync-engine 쪽 switch를 성립시킨다.
    expect(error.current).not.toBeNull();
    expect((error.current as { deleted: boolean }).deleted).toBe(false);
    // source는 ExpensePayload에 없는 서버 전용 필드라 옮기지 않는다.
    expect(Object.keys((error.current as { expense: object }).expense)).not.toContain("source");
  });

  it("expenseType=refund는 undefined로 낮춘다 (오프라인 payload는 expense|gift만 표현)", async () => {
    const error = await conflictFrom(makeServerExpense({ expenseType: "refund" }));
    const snapshot = error.current as { deleted: false; expense: { expenseType?: string } };
    expect(snapshot.expense.expenseType).toBeUndefined();
  });

  it("expenseType=gift는 그대로 보존한다", async () => {
    const error = await conflictFrom(makeServerExpense({ expenseType: "gift" }));
    const snapshot = error.current as { deleted: false; expense: { expenseType?: string } };
    expect(snapshot.expense.expenseType).toBe("gift");
  });

  it("update/delete 경로에서도 같은 번역을 거친다", async () => {
    const api = createClientRemoteExpenseApi(TOKEN);

    updateMock.mockRejectedValue(new ExpenseVersionConflictError({ id: "exp-1", deleted: true, version: 2 }));
    const onUpdate = await captureThrown(() => api.updateExpense("exp-1", makePayload(), 1, "idem-u"));
    expect(onUpdate).toBeInstanceOf(RemoteVersionConflictError);
    expect((onUpdate as RemoteVersionConflictError).current).toEqual({ deleted: true, id: "exp-1", version: 2 });

    deleteMock.mockRejectedValue(new ExpenseVersionConflictError(makeServerExpense({ version: 5 })));
    const onDelete = await captureThrown(() => api.deleteExpense("exp-1", 1, "idem-d"));
    expect(onDelete).toBeInstanceOf(RemoteVersionConflictError);
    expect((onDelete as RemoteVersionConflictError).current).toMatchObject({ deleted: false });
  });
});

describe("예외 번역 분기 (rethrowAsSyncEngineError)", () => {
  it("ExpenseVersionConflictError -> RemoteVersionConflictError (메시지 VERSION_CONFLICT)", async () => {
    createMock.mockRejectedValue(new ExpenseVersionConflictError(null));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = await captureThrown(() => api.createExpense(makePayload(), "idem-1"));

    expect(error).toBeInstanceOf(RemoteVersionConflictError);
    expect((error as Error).message).toBe("VERSION_CONFLICT");
    expect(error).not.toBeInstanceOf(RemotePermanentError);
  });

  it("4xx ExpenseHttpError -> RemotePermanentError (status/body 보존, 사용자 문구로 교체)", async () => {
    const body = { error: { code: "VALIDATION_ERROR", message: "금액이 올바르지 않습니다." } };
    createMock.mockRejectedValue(new ExpenseHttpError(422, body));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() => api.createExpense(makePayload(), "idem-2"))) as RemotePermanentError;

    expect(error).toBeInstanceOf(RemotePermanentError);
    expect(error.status).toBe(422);
    expect(error.body).toBe(body);
    // lastError로 그대로 화면에 노출되는 값이라 원문 영어 메시지 대신 한국어 문구를 쓴다.
    expect(error.message).toBe("요청을 처리하지 못했어요.");
  });

  it("삭제 404 EXPENSE_NOT_FOUND의 body를 그대로 실어 보내 sync-engine의 '이미 삭제됨' 수렴을 가능하게 한다", async () => {
    const body = { error: { code: "EXPENSE_NOT_FOUND", message: "지출을 찾을 수 없습니다." } };
    deleteMock.mockRejectedValue(new ExpenseHttpError(404, body));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() => api.deleteExpense("exp-1", 3, "idem-3"))) as RemotePermanentError;

    expect(error).toBeInstanceOf(RemotePermanentError);
    expect(error.status).toBe(404);
    // sync-engine.ts isDeleteTargetAlreadyGoneOnServer가 보는 바로 그 경로 —
    // 어댑터가 body를 삼키면 COV-T5의 삭제-404 영구 실패 루프가 되살아난다.
    expect((error.body as { error: { code: string } }).error.code).toBe("EXPENSE_NOT_FOUND");
  });

  it("404지만 EXPENSE_NOT_FOUND 코드가 아닌 body도 손대지 않고 그대로 넘긴다", async () => {
    const body = { message: "Not Found" };
    deleteMock.mockRejectedValue(new ExpenseHttpError(404, body));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() => api.deleteExpense("exp-1", 3, "idem-4"))) as RemotePermanentError;

    expect(error.body).toBe(body);
  });

  it("타임아웃/네트워크 오류는 번역하지 않고 원본 그대로 던진다 (flushOutbox의 transient 재시도 경로)", async () => {
    const timeout = new Error("Request timed out");
    timeout.name = "AbortError";
    updateMock.mockRejectedValue(timeout);
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = await captureThrown(() => api.updateExpense("exp-1", makePayload(), 3, "idem-5"));

    // 동일 참조여야 한다: RemotePermanentError로 감싸는 순간 'failed'로 떨어져
    // 자동 재시도가 멈추고, 오프라인 복귀 시 큐가 스스로 비워지지 않는다.
    expect(error).toBe(timeout);
    expect(error).not.toBeInstanceOf(RemotePermanentError);
    expect(error).not.toBeInstanceOf(RemoteVersionConflictError);
  });

  it("Error가 아닌 rejection(문자열 등)도 그대로 던진다", async () => {
    deleteMock.mockRejectedValue("boom");
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = await captureThrown(() => api.deleteExpense("exp-1", 3, "idem-6"));

    expect(error).toBe("boom");
  });

  /**
   * R19-E가 재현만 해 두고 R19-H가 고친 실버그의 회귀 테스트. client.ts는 409를 뺀
   * 모든 비-2xx를 하나의 ExpenseHttpError로 접어 던지므로, 어댑터가 status를 보지 않으면
   * 502/503까지 RemotePermanentError가 되고 flushOutbox는 그 행을 'failed'로 파킹해
   * 자동 재시도를 멈춘다(사용자가 직접 '재시도'를 눌러야 큐가 풀림). errors.ts의 분류
   * 계약대로 5xx는 transient여야 한다.
   */
  it("5xx는 permanent로 번역하지 않고 원본을 그대로 던진다 (transient 재시도 경로)", async () => {
    const serverError = new ExpenseHttpError(503, { error: { code: "SERVICE_UNAVAILABLE" } });
    createMock.mockRejectedValue(serverError);
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = await captureThrown(() => api.createExpense(makePayload(), "idem-5xx"));

    // 동일 참조 + 두 타입 모두 아님 = flushOutbox의 마지막 갈래(pending 유지 + 백오프 재시도).
    expect(error).toBe(serverError);
    expect(error).not.toBeInstanceOf(RemotePermanentError);
    expect(error).not.toBeInstanceOf(RemoteVersionConflictError);
  });

  it("500/502도 같은 transient 취급이고, 경계값 499는 여전히 permanent다", async () => {
    const api = createClientRemoteExpenseApi(TOKEN);

    for (const status of [500, 502]) {
      const serverError = new ExpenseHttpError(status, { error: { code: "INTERNAL" } });
      updateMock.mockRejectedValue(serverError);
      const error = await captureThrown(() => api.updateExpense("exp-1", makePayload(), 3, `idem-${status}`));
      expect(error).toBe(serverError);
    }

    // 5xx 미만은 하나도 새지 않아야 한다 — 경계는 status >= 500 딱 한 곳.
    deleteMock.mockRejectedValue(new ExpenseHttpError(499, { error: { code: "CLIENT_CLOSED_REQUEST" } }));
    const boundary = (await captureThrown(() => api.deleteExpense("exp-1", 3, "idem-499"))) as RemotePermanentError;
    expect(boundary).toBeInstanceOf(RemotePermanentError);
    expect(boundary.status).toBe(499);
  });
});

describe("토큰 캡처", () => {
  it("팩토리에 넘긴 토큰을 세 메서드 모두가 사용한다 (세션별 어댑터 인스턴스)", async () => {
    createMock.mockResolvedValue(makeServerExpense());
    updateMock.mockResolvedValue(makeServerExpense());
    deleteMock.mockResolvedValue({ success: true });

    const api = createClientRemoteExpenseApi("token-session-b");
    await api.createExpense(makePayload(), "i1");
    await api.updateExpense("exp-1", makePayload(), 1, "i2");
    await api.deleteExpense("exp-1", 1, "i3");

    expect(createMock.mock.calls[0][0]).toBe("token-session-b");
    expect(updateMock.mock.calls[0][0]).toBe("token-session-b");
    expect(deleteMock.mock.calls[0][0]).toBe("token-session-b");
  });
});

/**
 * 라운드 45 UX-Z — 실패 행의 `lastError`는 동기화 상태 화면에 **그대로 보이는 문장**이다
 * (sync-engine.ts가 RemotePermanentError.message를 그 자리에 넣는다). 서버가 코드로 말해 준
 * 사유를 여기서 잃으면 사용자는 "요청을 처리하지 못했어요."만 보고 무엇을 고쳐야 할지 영영 알 수
 * 없다. 분류(4xx=permanent)와 status/body 보존은 위 테스트들이 이미 고정하므로, 여기서는
 * **문구만** 본다.
 */
describe("실패 사유 문구 (화이트리스트 매핑)", () => {
  const cases: Array<[string, string, string]> = [
    ["EXPENSE_FUTURE_DATE", "미래 날짜의 지출은 저장할 수 없어요.", "미래 날짜의 지출은 저장할 수 없어요."],
    ["EXPENSE_DATE_INVALID", "날짜를 다시 확인해 주세요.", "날짜를 다시 확인해 주세요."],
    ["EXPENSE_ITEM_NAME_REQUIRED", "품목명을 입력해 주세요.", "품목명을 입력해 주세요."],
    ["EXPENSE_AMOUNT_INVALID", "금액은 0보다 큰 원화 정수만 입력할 수 있어요.", "금액은 0보다 큰 숫자로 입력해 주세요."],
    ["FORBIDDEN", "접근 권한이 없어요.", "권한이 없어 처리하지 못했어요. 가족 구성원 여부와 내 역할을 확인해 주세요."]
  ];

  it.each(cases)("%s -> 사용자 문구", async (code, serverMessage, expected) => {
    createMock.mockRejectedValue(new ExpenseHttpError(400, { error: { code, message: serverMessage } }));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() => api.createExpense(makePayload(), `idem-${code}`))) as RemotePermanentError;

    expect(error).toBeInstanceOf(RemotePermanentError);
    expect(error.message).toBe(expected);
    // 분류와 원본 정보는 그대로다 — 문구만 바뀐다.
    expect(error.status).toBe(400);
  });

  it("표에 없는 코드는 예전 문구 그대로다 (서버 원문이 화면으로 새지 않는다)", async () => {
    const body = { error: { code: "SOMETHING_NEW", message: "Unexpected server wording" } };
    updateMock.mockRejectedValue(new ExpenseHttpError(422, body));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() =>
      api.updateExpense("exp-1", makePayload(), 1, "idem-unknown")
    )) as RemotePermanentError;

    expect(error.message).toBe("요청을 처리하지 못했어요.");
    expect(error.message).not.toContain("Unexpected server wording");
    expect(error.body).toBe(body);
  });

  it("봉투가 아닌 4xx 본문도 예전 문구 그대로다", async () => {
    deleteMock.mockRejectedValue(new ExpenseHttpError(400, { message: "Bad Request" }));
    const api = createClientRemoteExpenseApi(TOKEN);

    const error = (await captureThrown(() => api.deleteExpense("exp-1", 2, "idem-plain"))) as RemotePermanentError;

    expect(error.message).toBe("요청을 처리하지 못했어요.");
  });
});
