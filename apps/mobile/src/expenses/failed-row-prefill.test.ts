import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryOfflineStore } from "../offline/memory-offline-store";
import { RemotePermanentError } from "../offline/errors";
import { isPermissionDeniedSyncError, isRetryableSyncFailureRow } from "../offline/permission-denied";
import { discardFailedMutation, flushOutbox, recordLocalCreate, type RemoteSyncApi } from "../offline/sync-engine";
import type { ExpensePayload } from "../offline/types";
import {
  buildFailedRowPrefillParams,
  NO_FAILED_ROW_PREFILL_DATE,
  parseFailedRowLocalId,
  parseFailedRowPrefillText,
  resolveFailedRowPrefillDate
} from "./failed-row-prefill";
import { parseExpensePrefillParams } from "./record-row-actions";

/**
 * 라운드 58 #5 — 동기화 실패 행의 "고쳐서 다시 보내기".
 *
 * 고정하는 것은 세 가지다.
 *  1. **왕복**: 실패 행 payload → 파라미터 → 기록 시트가 읽는 값이 한 바퀴 돌아 그대로 온다.
 *     여기가 갈리면 증상은 "고쳐서 다시 보내기를 눌렀는데 판매처만 비어 있다"처럼만 드러난다.
 *  2. **날짜 정직성**: 시트가 받아 주지 않는 날짜(미래·손상)는 오늘로 물러서되 **말없이 바꾸지
 *     않는다**. 앱이 날짜를 지어내면 그 달 합계가 사실과 어긋난다.
 *  3. **원본 폐기 순서**: 새 저장이 확정된 뒤에만 원본 실패 행이 사라진다. 저장 전에 버리면
 *     저장이 실패했을 때 원본도 새 기록도 없다(서버에 없는 행이라 되돌릴 수 없다).
 *
 * 화면(app/sync-status.tsx, app/expenses/new.tsx)은 vitest에서 렌더할 수 없으므로
 * (react-native 네이티브 바인딩 없음) 배선은 소스 grep으로 고정한다 —
 * src/offline/sync-status-bulk-actions.test.ts와 같은 관례다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const fullPayload: ExpensePayload = {
  childId: "child-1",
  categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
  amountKrw: 38_500,
  spentOn: "2026-08-03",
  itemName: "기저귀",
  merchant: "쿠팡",
  memo: "밴드형 4단계",
  paymentMethod: "card",
  linkedItemTemplateId: "tpl-1",
  linkedProductLinkId: "link-1"
};

describe("라운드 58 #5 buildFailedRowPrefillParams — 실패 행 → 프리필 파라미터", () => {
  it("행이 들고 있던 값을 하나도 잃지 않고 싣는다 (원본 localId 포함)", () => {
    expect(buildFailedRowPrefillParams({ localId: "local-1", payload: fullPayload })).toEqual({
      failedLocalId: "local-1",
      itemName: "기저귀",
      amountKrw: "38500",
      spentOn: "2026-08-03",
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      paymentMethod: "card",
      merchant: "쿠팡",
      memo: "밴드형 4단계",
      itemTemplateId: "tpl-1",
      linkedProductLinkId: "link-1"
    });
  });

  it("없는 값은 키 자체를 싣지 않는다 — '사용자가 지운 값'과 '원래 없던 값'을 섞지 않는다", () => {
    const params = buildFailedRowPrefillParams({
      localId: "local-2",
      payload: {
        childId: "child-1",
        categoryId: "",
        amountKrw: 1_000,
        spentOn: "2026-08-03",
        itemName: "물티슈",
        merchant: null,
        memo: ""
      }
    });

    expect(params).toEqual({ failedLocalId: "local-2", itemName: "물티슈", amountKrw: "1000", spentOn: "2026-08-03" });
  });

  it('서버 enum의 "unknown" 결제 수단은 실려 가지 않는다 (화이트리스트는 한 벌뿐이다)', () => {
    const params = buildFailedRowPrefillParams({
      localId: "local-3",
      payload: { ...fullPayload, paymentMethod: "unknown" }
    });

    expect(params).not.toBeNull();
    expect(params).not.toHaveProperty("paymentMethod");
  });

  it("선물·환불 행에는 프리필을 만들지 않는다 (시트가 그 구분을 되살릴 수 없다 — DNC-015)", () => {
    // 프리필 계약에는 구분을 싣는 파라미터가 없다. 그대로 열면 선물이 조용히 일반 지출로
    // 저장돼 이번 달 합계가 사용자가 쓰지 않은 돈만큼 부푼다. 그 행에도 "버리기"는 남는다.
    expect(buildFailedRowPrefillParams({ localId: "local-4", payload: { ...fullPayload, expenseType: "gift" } })).toBeNull();
    expect(
      buildFailedRowPrefillParams({ localId: "local-5", payload: { ...fullPayload, expenseType: "refund" } })
    ).toBeNull();
    // 구분이 없는 레거시 행은 예전 관례대로 일반 지출이다.
    expect(
      buildFailedRowPrefillParams({ localId: "local-6", payload: { ...fullPayload, expenseType: undefined } })
    ).not.toBeNull();
  });

  it("시트가 저장할 수 없는 행(빈 품목명·0 이하 금액)에는 프리필이 없다 — 반응 없는 버튼을 만들지 않는다", () => {
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, itemName: "   " } })).toBeNull();
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, amountKrw: 0 } })).toBeNull();
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, amountKrw: -1 } })).toBeNull();
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, amountKrw: 1.5 } })).toBeNull();
    expect(buildFailedRowPrefillParams({ localId: "  ", payload: fullPayload })).toBeNull();
  });

  it("길이 상한을 넘긴 메모도 그대로 싣는다 — 그 행이야말로 고칠 원문이 필요하다", () => {
    const longMemo = "가".repeat(400);
    const params = buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, memo: longMemo } });

    expect(params?.memo).toBe(longMemo);
  });
});

describe("라운드 58 #5 프리필 왕복 — 시트가 읽는 값이 행의 값 그대로다", () => {
  it("품목명·금액·분류·결제 수단은 기존 파서가, 판매처·메모·날짜·localId는 이 모듈이 되돌린다", () => {
    const params = buildFailedRowPrefillParams({ localId: "local-1", payload: fullPayload });
    expect(params).not.toBeNull();

    // 시트(app/expenses/new.tsx)가 실제로 하는 것과 같은 파싱.
    expect(parseExpensePrefillParams(params!)).toEqual({
      itemName: "기저귀",
      amountText: "38500",
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      paymentMethod: "card"
    });
    expect(parseFailedRowPrefillText(params!.merchant)).toBe("쿠팡");
    expect(parseFailedRowPrefillText(params!.memo)).toBe("밴드형 4단계");
    expect(parseFailedRowLocalId(params!.failedLocalId)).toBe("local-1");
    expect(resolveFailedRowPrefillDate(params!.spentOn, "2026-08-27")).toEqual({
      spentOn: "2026-08-03",
      fellBackToToday: false
    });
  });

  it("expo-router가 배열로 넘겨도 같은 값을 읽는다 (파라미터 정규화는 한 벌이다)", () => {
    expect(parseFailedRowLocalId(["local-1", "local-2"])).toBe("local-1");
    expect(parseFailedRowPrefillText(["메모"])).toBe("메모");
    expect(resolveFailedRowPrefillDate(["2026-08-03"], "2026-08-27").spentOn).toBe("2026-08-03");
  });

  it("파라미터가 없으면 평소의 새 기록과 똑같다 — 다른 진입점의 동작이 바뀌지 않는다", () => {
    expect(parseFailedRowLocalId(undefined)).toBeNull();
    expect(parseFailedRowLocalId("   ")).toBeNull();
    expect(parseFailedRowPrefillText(undefined)).toBe("");
    expect(resolveFailedRowPrefillDate(undefined, "2026-08-27")).toEqual(NO_FAILED_ROW_PREFILL_DATE);
    expect(NO_FAILED_ROW_PREFILL_DATE).toEqual({ spentOn: null, fellBackToToday: false });
  });

  it("실제로 400으로 굳은 행에서 프리필이 나온다 (flush → 실패 행 → 파라미터)", async () => {
    const store = createMemoryOfflineStore();
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new RemotePermanentError(400, "미래 날짜의 지출은 저장할 수 없어요.", {
          error: { code: "EXPENSE_FUTURE_DATE", message: "…" }
        });
      },
      async updateExpense() {
        return { version: 1 };
      },
      async deleteExpense() {}
    };
    const created = await recordLocalCreate(store, fullPayload);

    await flushOutbox(store, remote);

    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("failed");
    // 이 행이 바로 화면이 "고쳐서 다시 보내기"를 내미는 조건이다(4xx, 403 아님).
    expect(isRetryableSyncFailureRow(row)).toBe(false);
    expect(isPermissionDeniedSyncError(row)).toBe(false);

    const params = buildFailedRowPrefillParams(row);
    expect(params).toEqual({
      failedLocalId: created.localId,
      itemName: "기저귀",
      amountKrw: "38500",
      spentOn: "2026-08-03",
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      paymentMethod: "card",
      merchant: "쿠팡",
      memo: "밴드형 4단계",
      itemTemplateId: "tpl-1",
      linkedProductLinkId: "link-1"
    });
  });
});

describe("라운드 58 #5 날짜 정직성 — 못 쓰는 날짜는 오늘로 물러서되 말한다", () => {
  it("미래 날짜였던 행은 오늘로 폴백하고 안내를 켠다 (허위 날짜 금지 — 사용자가 고른다)", () => {
    // 기기 시계가 앞섰거나 자정 경계에서 만들어져 400(EXPENSE_FUTURE_DATE)으로 실패한 행이
    // 정확히 이 자리다. 그 값을 그대로 채우면 저장 버튼이 막힌 채 열리고, 몰래 오늘로 바꾸면
    // 사용자가 고른 적 없는 날짜가 기록에 남는다.
    expect(resolveFailedRowPrefillDate("2026-08-28", "2026-08-27")).toEqual({ spentOn: null, fellBackToToday: true });
  });

  it("오늘·과거는 그대로 쓴다 (경계 포함)", () => {
    expect(resolveFailedRowPrefillDate("2026-08-27", "2026-08-27")).toEqual({
      spentOn: "2026-08-27",
      fellBackToToday: false
    });
    expect(resolveFailedRowPrefillDate("2025-12-31", "2026-08-27")).toEqual({
      spentOn: "2025-12-31",
      fellBackToToday: false
    });
  });

  it("형식이 아니거나 달력에 없는 날짜도 같은 폴백을 받는다 (손상된 값을 화면에 그리지 않는다)", () => {
    for (const broken of ["2026-02-30", "20260803", "어제", "2026-13-01"]) {
      expect(resolveFailedRowPrefillDate(broken, "2026-08-27"), broken).toEqual({
        spentOn: null,
        fellBackToToday: true
      });
    }
  });
});

describe("라운드 58 #5 원본 폐기의 두 갈래 (엔진 결과)", () => {
  /** 실패로 굳은 행 하나. 화면이 "고쳐서 다시 보내기"를 내미는 상태 그대로다. */
  async function seedPermanentlyFailedRow(store: ReturnType<typeof createMemoryOfflineStore>) {
    const created = await recordLocalCreate(store, fullPayload);
    await store.updateLocalExpense(created.localId, {
      syncState: "failed",
      lastError: "미래 날짜의 지출은 저장할 수 없어요.",
      lastErrorStatus: 400,
      lastErrorCode: "EXPENSE_FUTURE_DATE"
    });
    return created.localId;
  }

  it("저장이 확정된 뒤 원본을 버리면 새 기록만 남는다 (아웃박스도 함께 정리된다)", async () => {
    const store = createMemoryOfflineStore();
    const failedLocalId = await seedPermanentlyFailedRow(store);

    // 시트가 하는 순서: 로컬 우선 저장 → 확정(onSuccess) → 그때 비로소 원본 폐기.
    const rewritten = await recordLocalCreate(store, { ...fullPayload, amountKrw: 35_000, spentOn: "2026-08-27" });
    await discardFailedMutation(store, failedLocalId);

    expect((await store.listLocalExpenses()).map((row) => row.localId)).toEqual([rewritten.localId]);
    expect((await store.listOutboxMutations()).map((mutation) => mutation.targetLocalId)).toEqual([rewritten.localId]);
  });

  it("저장이 실패하면 원본이 대기 중인 전송까지 그대로 남는다 (이중 손실 금지)", async () => {
    const store = createMemoryOfflineStore();
    const failedLocalId = await seedPermanentlyFailedRow(store);

    // 저장 실패 경로(onError)는 폐기를 부르지 않는다 -- 사용자는 고치던 값을 그대로 들고
    // 다시 누르면 되고, 원본도 제자리에 있다.
    expect((await store.getLocalExpense(failedLocalId))?.syncState).toBe("failed");
    expect(await store.listOutboxMutationsForLocalId(failedLocalId)).toHaveLength(1);
  });

  it("폐기는 멱등이다 — '저장하고 계속 기록'으로 두 번 저장해도 다른 행을 건드리지 않는다", async () => {
    const store = createMemoryOfflineStore();
    const failedLocalId = await seedPermanentlyFailedRow(store);
    const survivor = await recordLocalCreate(store, { ...fullPayload, itemName: "물티슈" });

    await discardFailedMutation(store, failedLocalId);
    await discardFailedMutation(store, failedLocalId);

    expect((await store.listLocalExpenses()).map((row) => row.localId)).toEqual([survivor.localId]);
  });
});

describe("라운드 58 #5 sync-status 화면 배선 (소스 계약)", () => {
  const screen = () => source("app/sync-status.tsx");

  it("재시도가 무익한 4xx 행에만 '고쳐서 다시 보내기'가 선다", () => {
    const src = screen();
    expect(src).toContain('import { buildFailedRowPrefillParams } from "../src/expenses/failed-row-prefill";');
    expect(src).toContain("SYNC_STATUS_FIX_AND_RESEND_LABEL");
    const branchStart = src.indexOf("if (!isRetryableSyncFailureRow(row)) {");
    expect(branchStart).toBeGreaterThan(-1);
    const branch = src.slice(branchStart, src.indexOf("\n  return (", branchStart));
    expect(branch).toContain("const fixParams = buildFailedRowPrefillParams(row);");
    expect(branch).toContain("label={SYNC_STATUS_FIX_AND_RESEND_LABEL}");
    expect(branch).toContain('router.push({ pathname: "/expenses/new", params: fixParams })');
    // 사유 문장과 안내 한 줄은 그대로 남는다 — 버튼이 설명을 대체하지 않는다.
    expect(branch).toContain("{SYNC_STATUS_PERMANENT_FAILURE_HINT}");
    // 프리필을 만들 수 없는 행(선물·환불 등)에서는 버리기만 남는다.
    expect(branch).toContain("{fixParams ? (");
    expect(branch).toContain("SYNC_STATUS_DISCARD_LABEL");
  });

  it("403 권한 거절 행에는 내밀지 않는다 — 고칠 내용이 아니라 권한이 문제다", () => {
    const src = screen();
    const branchStart = src.indexOf("if (isPermissionDeniedSyncError(row)) {");
    expect(branchStart).toBeGreaterThan(-1);
    // 403 갈래는 **그 다음 갈래가 시작하기 전까지**다(재시도 무익 4xx 갈래가 바로 뒤에 온다).
    const branch = src.slice(branchStart, src.indexOf("if (!isRetryableSyncFailureRow(row)) {", branchStart));
    expect(branch.length).toBeGreaterThan(0);
    expect(branch).not.toContain("SYNC_STATUS_FIX_AND_RESEND_LABEL");
    expect(branch).not.toContain("buildFailedRowPrefillParams");
    expect(branch).toContain("{SYNC_STATUS_PERMISSION_DENIED_HINT}");
  });

  it("준비템 상태 실패 행에는 없다 — 그 행에는 고칠 '내용'이라는 것이 없다", () => {
    const src = screen();
    const itemStatusRow = src.slice(src.indexOf("function ItemStatusSyncRow("), src.indexOf("function SectionTitle("));
    expect(itemStatusRow).not.toContain("SYNC_STATUS_FIX_AND_RESEND_LABEL");
    expect(itemStatusRow).toContain("SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT");
  });

  it("화면이 프리필을 직접 조립하지 않는다 (규칙은 순수 모듈 한 곳)", () => {
    const src = screen();
    expect(src).not.toContain("failedLocalId:");
    expect(src).not.toContain("spentOn:");
  });
});

describe("라운드 58 #5 기록 시트 배선 — 저장 확정 후에만 원본을 버린다 (소스 계약)", () => {
  const newExpense = () => source("app/expenses/new.tsx");

  it("실패 행 전용 파라미터 셋을 읽는다", () => {
    const src = newExpense();
    const paramsBlock = src.slice(src.indexOf("const params = useLocalSearchParams<{"), src.indexOf("}>();"));
    for (const name of ["memo", "spentOn", "failedLocalId"]) {
      expect(paramsBlock, `/expenses/new이 ${name} 파라미터를 읽지 않는다`).toContain(`${name}?: string;`);
    }
    expect(src).toContain("const failedLocalId = parseFailedRowLocalId(params.failedLocalId);");
    expect(src).toContain("const prefilledMemo = parseFailedRowPrefillText(params.memo);");
    expect(src).toContain("resolveFailedRowPrefillDate(params.spentOn, initialExpenseDate.iso)");
  });

  it("메모·날짜가 실제로 초기값이 되고, 날짜 폴백은 화면이 한 줄로 밝힌다", () => {
    const src = newExpense();
    expect(src).toContain('const [memo, setMemo] = useState(() => (authToken ? prefilledMemo : ""));');
    expect(src).toContain(
      "const [expenseDateIso, setExpenseDateIso] = useState(() => prefilledSpentOn.spentOn ?? initialExpenseDate.iso);"
    );
    expect(src).toContain("{FAILED_ROW_PREFILL_DATE_RESET_NOTICE}");
    // 비세션(픽셀 락 캡처 EXP-001)은 프리필을 보지 않는다.
    expect(src).toContain("const prefilledSpentOn = authToken");
  });

  it("폐기는 onSuccess에서 단 한 번, await로 일어난다", () => {
    const src = newExpense();
    expect(src.match(/discardOfflineMutation\(/g) ?? []).toHaveLength(1);
    const onSuccess = src.slice(src.indexOf("onSuccess: async () => {"), src.indexOf("const isPixelLockAmountCapture"));
    expect(onSuccess).toContain("if (failedLocalId) {");
    expect(onSuccess).toContain("await discardOfflineMutation(failedLocalId);");
  });

  it("저장 실패 경로는 원본을 건드리지 않는다 (이중 손실 금지)", () => {
    const src = newExpense();
    const mutationFn = src.slice(src.indexOf("const saveExpense = useMutation({"), src.indexOf("onMutate: () => {"));
    const onError = src.slice(src.indexOf("onError: (error) => {"), src.indexOf("onSuccess: async () => {"));
    expect(mutationFn).not.toContain("discardOfflineMutation");
    expect(onError).not.toContain("discardOfflineMutation");
  });

  it("오프라인 저장 경로에서도 그대로 동작한다 — 로컬 우선 저장이 곧 확정이다", () => {
    const src = newExpense();
    // 저장은 SQLite 우선이라 연결이 없어도 onSuccess까지 온다(그래서 폐기도 로컬에서 끝난다).
    expect(src).toContain("return createExpenseOffline(authToken, queryClient, {");
    expect(src).toContain('import { discardOfflineMutation } from "../../src/offline/sync-controller";');
  });
});
