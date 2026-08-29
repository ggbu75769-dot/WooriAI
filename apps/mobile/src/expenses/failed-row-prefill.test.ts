import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEntryDateFloor, getSeoulToday } from "@wooriai/domain";
import { createMemoryOfflineStore } from "../offline/memory-offline-store";
import { RemotePermanentError } from "../offline/errors";
import { isPermissionDeniedSyncError, isRetryableSyncFailureRow } from "../offline/permission-denied";
import { discardFailedMutation, flushOutbox, recordLocalCreate, type RemoteSyncApi } from "../offline/sync-engine";
import type { ExpensePayload } from "../offline/types";
// 라운드 69 트랙 A(P3): 이 문구는 열 라운드 이월 끝에 동기화 상태 화면 문구의 단일 소스로
// 이사했다(값 불변). 그래서 이 파일도 그 자리에서 읽는다 — 두 벌이 되지 않게.
import { FAILED_ROW_OTHER_CHILD_NOTICE } from "../offline/messages";
import {
  buildFailedRowPrefillParams,
  isFailedRowChildMismatch,
  NO_FAILED_ROW_PREFILL_DATE,
  parseFailedRowLocalId,
  parseFailedRowPrefillText,
  resolveFailedRowPrefillDate
} from "./failed-row-prefill";
import {
  parseExpenseEntrySource,
  POST_SAVE_DEFAULT_DESTINATION,
  POST_SAVE_SYNC_STATUS_DESTINATION,
  resolvePostSaveDestination,
  SYNC_FIX_ENTRY_SOURCE
} from "./post-save-destination";
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
      childId: "child-1",
      // 라운드 59 #2: 저장 후 착지도 이 계약의 일부다(아래 "저장 후 착지" describe).
      from: SYNC_FIX_ENTRY_SOURCE,
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

    expect(params).toEqual({
      failedLocalId: "local-2",
      childId: "child-1",
      from: SYNC_FIX_ENTRY_SOURCE,
      itemName: "물티슈",
      amountKrw: "1000",
      spentOn: "2026-08-03"
    });
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

  it("아이를 말하지 않는 행에는 프리필을 만들지 않는다 (어느 아이 밑으로 갈지 확인할 수 없다)", () => {
    // 라운드 58 통합리뷰 P1-1: childId가 비면 화면의 아이 게이트도 시트의 어긋남 판정도
    // 물어볼 것이 없다 — 이중 방어가 둘 다 무력해지는 유일한 경우라 아예 열지 않는다.
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, childId: "" } })).toBeNull();
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, childId: "   " } })).toBeNull();
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
      childId: "child-1",
      from: SYNC_FIX_ENTRY_SOURCE,
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

/**
 * 라운드 58 통합리뷰 P1-1 — **아이 불일치로 인한 데이터 손실**을 막는 두 겹.
 *
 * 무엇이 위험했나: 이 시트의 저장은 언제나 *지금 선택된 아이* 밑으로 간다. 아이 A의 실패 행을
 * B가 선택된 상태에서 "고쳐서 다시 보내기"로 열어 저장하면 (1) 그 지출이 B의 합계에 들어가고
 * (2) 저장 확정과 동시에 A의 원본 실패 행이 폐기된다 — 서버에 없는 행이라 되돌릴 수 없다.
 */
describe("라운드 58 통합리뷰 P1-1 아이 왕복·불일치", () => {
  it("행이 어느 아이의 것인지도 프리필에 실린다 (시트가 스스로 확인할 수 있게)", () => {
    const params = buildFailedRowPrefillParams({ localId: "local-1", payload: fullPayload });

    expect(params?.childId).toBe("child-1");
    // 왕복: 실려 간 값이 그대로 판정 재료가 된다 — 같은 아이면 어긋남이 아니다.
    expect(isFailedRowChildMismatch(params!.childId, "child-1")).toBe(false);
    // 다른 아이가 선택돼 있으면 어긋남이다(시트가 저장을 막는다).
    expect(isFailedRowChildMismatch(params!.childId, "child-2")).toBe(true);
  });

  it("expo-router가 배열로 넘겨도, 앞뒤 공백이 있어도 같은 판정이다", () => {
    expect(isFailedRowChildMismatch(["child-1"], "child-1")).toBe(false);
    expect(isFailedRowChildMismatch(["child-1"], "child-2")).toBe(true);
    expect(isFailedRowChildMismatch(" child-1 ", "child-1")).toBe(false);
    expect(isFailedRowChildMismatch("child-1", " child-1 ")).toBe(false);
  });

  it("이 계약을 싣지 않는 진입점·아이 미선택에서는 어긋남이 아니다 (다른 동선이 바뀌지 않는다)", () => {
    // "또 기록"·준비템·정기 지출은 childId 파라미터를 싣지 않는다 — 그 화면들은 종전 그대로다.
    expect(isFailedRowChildMismatch(undefined, "child-1")).toBe(false);
    expect(isFailedRowChildMismatch("", "child-1")).toBe(false);
    expect(isFailedRowChildMismatch("   ", "child-1")).toBe(false);
    // 아이를 아직 고르지 않았다면 저장은 시트의 기존 가드가 막는다 — 여기서 또 말하지 않는다.
    expect(isFailedRowChildMismatch("child-1", null)).toBe(false);
    expect(isFailedRowChildMismatch("child-1", undefined)).toBe(false);
    expect(isFailedRowChildMismatch("child-1", "  ")).toBe(false);
  });
});

/**
 * 라운드 59 #2 — **저장 후 착지**.
 *
 * 이 진입점의 저장은 새 기록을 만들면서 원본 실패 행을 버린다. 그 폐기가 보이는 화면은 동기화
 * 상태 화면 하나뿐인데, 종전에는 `from`을 싣지 않아 저장 후 기록 탭으로 튕겨 나갔다 — 새 기록
 * 한 줄만 보이고 "그 실패 행이 정리됐다"는 사실은 어디에도 없었다.
 */
describe("라운드 59 #2 고쳐서 다시 보내기 → 저장 후 동기화 상태 화면", () => {
  it("프리필이 진입점을 함께 싣고, 그 값이 그대로 목적지 판정을 지난다 (왕복)", () => {
    const params = buildFailedRowPrefillParams({ localId: "local-1", payload: fullPayload });

    expect(params?.from).toBe(SYNC_FIX_ENTRY_SOURCE);
    expect(SYNC_FIX_ENTRY_SOURCE).toBe("sync-fix");
    // 싣는 쪽(이 모듈)과 읽는 쪽(post-save-destination)이 같은 문자열 하나를 본다.
    expect(parseExpenseEntrySource(params!.from)).toBe(SYNC_FIX_ENTRY_SOURCE);
    expect(resolvePostSaveDestination(params!)).toBe(POST_SAVE_SYNC_STATUS_DESTINATION);
    expect(POST_SAVE_SYNC_STATUS_DESTINATION).toBe("/sync-status");
  });

  it("프리필을 만들 수 없는 행에는 착지 계약도 없다 (버튼 자체가 없는 행이다)", () => {
    // 선물 행 — 이 진입점이 아예 열리지 않으므로 `from`도 실려 가지 않는다.
    expect(buildFailedRowPrefillParams({ localId: "l", payload: { ...fullPayload, expenseType: "gift" } })).toBeNull();
    // 그리고 이 계약을 싣지 않는 진입점(예: "같은 내용으로 또 기록")의 저장은 종전 그대로
    // 기록 탭이다 — `from`이 없으면 목적지도 종전 동작이다.
    expect(resolvePostSaveDestination({})).toBe(POST_SAVE_DEFAULT_DESTINATION);
  });
});

/**
 * 라운드 59 #5 — 다른 아이의 실패 행에서 **버튼 자리가 비어 있지 않다**.
 *
 * 라운드 58 통합리뷰 P1-1이 그 행에서 버튼을 뗀 것은 데이터 손실 때문이었지만(아이 A의 행을 B가
 * 선택된 상태로 고치면 A의 지출이 B로 옮겨 앉고 원본은 폐기된다), 뗀 자리에 아무 말도 없어서
 * 사용자는 같은 실패 행 둘 중 하나에만 버튼이 있는 이유를 알 수 없었다(라운드 40 J-9의 예외).
 */
describe("라운드 59 #5 다른 아이의 실패 행 — 지우지 않고 사실을 말한다", () => {
  it("안내 한 줄이 사실과 다음 행동을 함께 말한다 (책망 없는 해요체 — DNC-018)", () => {
    expect(FAILED_ROW_OTHER_CHILD_NOTICE).toBe("다른 아이의 기록이에요. 그 아이를 선택하면 고쳐서 다시 보낼 수 있어요.");
    // 사용자가 할 수 있는 일을 말한다 — "할 수 없어요"로 끝나지 않는다.
    expect(FAILED_ROW_OTHER_CHILD_NOTICE).toContain("선택하면");
  });

  it("화면이 그 줄을 아이가 어긋난 행에만 세운다 (아이 미선택·프리필 불가 행에는 세우지 않는다)", () => {
    const src = source("app/sync-status.tsx");
    const branchStart = src.indexOf("if (!isRetryableSyncFailureRow(row)) {");
    const branch = src.slice(branchStart, src.indexOf("\n  return (", branchStart));

    // 판정: 행의 아이가 있고, 선택된 아이가 있고, 둘이 다르고, **아이만 바꾸면 실제로 버튼이
    // 서는 행**일 때만이다(라운드 59 통합리뷰 P1-3 — 선물·환불·빈 품목명 행에는 프리필 자체가
    // 없으므로 "그 아이를 선택하면 …할 수 있어요"가 지키지 못할 약속이 된다).
    expect(branch).toContain("const prefillParams = buildFailedRowPrefillParams(row);");
    expect(branch).toContain("const fixParams = isSelectedChildRow ? prefillParams : null;");
    expect(branch).toContain(
      "const showOtherChildNotice =\n      !isSelectedChildRow && rowChildId.length > 0 && Boolean(selectedChildId?.trim()) && prefillParams !== null;"
    );
    expect(branch).toContain("{showOtherChildNotice ? (");
    expect(branch).toContain("{FAILED_ROW_OTHER_CHILD_NOTICE}");
    // 문구를 화면이 다시 적지 않는다(상수로만 들어간다). 판단 근거를 설명하는 주석은 그 문장을
    // 인용해도 되므로 코드만 본다 — recurring-flow.test.ts의 codeOnly와 같은 규율이다.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(codeOnly).not.toContain("다른 아이의 기록이에요");
    // 그 행에서도 "버리기"는 그대로 남는다 — 취할 수 있는 행동을 없애지 않는다.
    expect(branch).toContain(
      "<SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} />"
    );
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

  /**
   * 라운드 68 리뷰 C-1 — **과거 하한도 같은 폴백**을 받는다.
   *
   * 이 함수는 실패 행 전용이 아니다: 기록 탭 달력 칸 탭도 같은 `spentOn` 파라미터로 이 시트를
   * 연다(app/(tabs)/records.tsx의 `handleRecordForCalendarDate`). 하한을 여기서 묻지 않으면
   * 저장 가드가 거절할 날짜가 시트의 초기값으로 앉아 저장 버튼이 막힌 채로 열린다 — 미래 날짜와
   * 똑같은 증상이고, 그래서 갈래도 문구도 하나다.
   *
   * 경계는 폼 가드(entry-form-guards.test.ts)와 **같은 두 값**을 본다: 하한 당일은 통과(픽커가
   * 고를 수 있게 열어 두는 날), 그 전날은 폴백.
   */
  it("하한보다 이른 날짜는 오늘로 폴백한다 (하한 당일은 그대로 쓴다)", () => {
    const today = getSeoulToday();
    const floor = getEntryDateFloor();
    const dayBeforeFloor = new Date(`${floor}T00:00:00Z`);
    dayBeforeFloor.setUTCDate(dayBeforeFloor.getUTCDate() - 1);

    expect(resolveFailedRowPrefillDate(floor, today)).toEqual({ spentOn: floor, fellBackToToday: false });
    expect(resolveFailedRowPrefillDate(dayBeforeFloor.toISOString().slice(0, 10), today)).toEqual({
      spentOn: null,
      fellBackToToday: true
    });
    // 읽기 화면이 열어 줄 수 없는 달의 오타(도메인 주석의 그 사례)도 같은 자리에서 걸린다.
    expect(resolveFailedRowPrefillDate("1970-01-01", today)).toEqual({ spentOn: null, fellBackToToday: true });
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
    // 라운드 69 트랙 A(P3): 안내 문구는 이 모듈이 아니라 동기화 문구 단일 소스에서 온다.
    expect(src).toContain("  FAILED_ROW_OTHER_CHILD_NOTICE,\n");
    expect(source("src/expenses/failed-row-prefill.ts")).not.toContain("export const FAILED_ROW_OTHER_CHILD_NOTICE");
    expect(src).toContain("SYNC_STATUS_FIX_AND_RESEND_LABEL");
    const branchStart = src.indexOf("if (!isRetryableSyncFailureRow(row)) {");
    expect(branchStart).toBeGreaterThan(-1);
    const branch = src.slice(branchStart, src.indexOf("\n  return (", branchStart));
    // 라운드 58 통합리뷰 P1-1: 프리필 조립 자체가 **선택된 아이의 행일 때만** 일어난다.
    // 라운드 59 #5: 그 판정에 이름이 붙었다(같은 값을 안내 한 줄이 함께 본다).
    expect(branch).toContain(
      "const isSelectedChildRow = rowChildId.length > 0 && rowChildId === selectedChildId;"
    );
    // 라운드 59 통합리뷰 P1-3: 프리필 조립은 행 자체의 성질이라 한 번만 묻고, 아이 게이트는
    // 그 위에 얹는다(같은 값을 아래 안내 한 줄이 함께 본다 — 아이만 바꾸면 되는 행인지).
    expect(branch).toContain("const prefillParams = buildFailedRowPrefillParams(row);");
    expect(branch).toContain("const fixParams = isSelectedChildRow ? prefillParams : null;");
    // 아이가 어긋난 행에서는 여전히 버튼이 서지 않는다(데이터 손실 게이트는 그대로다).
    expect(branch).not.toContain("const fixParams = prefillParams;");
    expect(branch).toContain("label={SYNC_STATUS_FIX_AND_RESEND_LABEL}");
    // 라운드 59 #2: **replace**로 연다 — 저장 후 이 화면으로 돌아오는 복귀도 replace라,
    // push로 열면 스택에 같은 화면이 두 장 쌓인다(근거는 그 자리 주석).
    expect(branch).toContain('router.replace({ pathname: "/expenses/new", params: fixParams })');
    expect(branch).not.toContain('router.push({ pathname: "/expenses/new"');
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

  /**
   * 라운드 58 통합리뷰 P1-1 — 아이 게이트의 배선. 트랙 A의 `canRegisterRecurring`
   * (app/expenses/[expenseId].tsx)과 **대칭**이다: 두 진입점 모두 "지금 선택된 아이"의 값을
   * 만드는 화면으로 가므로, 다른 아이의 행에서는 버튼을 내놓지 않는다.
   */
  it("아이가 어긋난 실패 행에는 '고쳐서 다시 보내기'가 서지 않는다 (버리기는 남는다)", () => {
    const src = screen();
    expect(src).toContain('import { useSelectedChildStore } from "../src/stores/selected-child.store";');
    expect(src).toContain("const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);");
    // 판정값이 행까지 실제로 내려간다(prop 배선이 빠지면 게이트가 늘 닫히거나 늘 열린다).
    expect(src).toContain("selectedChildId: string | null;");
    expect(src).toContain("selectedChildId={selectedChildId}");
    // 그리고 renderItem의 의존성 목록에 들어 있어야 아이를 바꾼 순간 목록이 다시 그려진다.
    const deps = src.slice(src.indexOf("    [\n      authToken,"), src.indexOf("  const listHeader"));
    expect(deps).toContain("selectedChildId");

    // 어긋난 행에서도 사용자가 취할 수 있는 행동(버리기)은 그대로 남는다.
    const branchStart = src.indexOf("if (!isRetryableSyncFailureRow(row)) {");
    const branch = src.slice(branchStart, src.indexOf("\n  return (", branchStart));
    expect(branch).toContain("{fixParams ? (");
    expect(branch).toContain("<SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} />");
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

  /**
   * 라운드 58 통합리뷰 P3-9: `await` → `void`. 계약("저장이 확정된 뒤에만 버린다")은 그대로다 —
   * 폐기 호출은 여전히 **onSuccess 안에만** 있고 onError·mutationFn에는 없다(아래 테스트).
   * 바뀐 것은 대기뿐이다: SQLite 쓰기를 기다리는 동안 성공 토스트·무효화·화면 이동이 전부
   * 뒤로 밀렸다. 결과를 읽지 않고 실패해도 무시하는 작업이라 지연을 격리한다(catch는 유지 —
   * 처리되지 않은 거절을 남기지 않는다).
   */
  it("폐기는 onSuccess에서 단 한 번, 저장 확정을 붙잡지 않고(void) 일어난다", () => {
    const src = newExpense();
    expect(src.match(/discardOfflineMutation\(/g) ?? []).toHaveLength(1);
    const onSuccess = src.slice(src.indexOf("onSuccess: async () => {"), src.indexOf("const isPixelLockAmountCapture"));
    expect(onSuccess).toContain("if (failedLocalId) {");
    expect(onSuccess).toContain("void discardOfflineMutation(failedLocalId).catch(() => {");
    // 저장 확정 뒤에만 도는 자리라는 사실 자체가 계약이다 — 다른 콜백에는 없다.
    expect(onSuccess).not.toContain("await discardOfflineMutation");
  });

  /**
   * 라운드 58 통합리뷰 P1-1 — 이중 방어의 **둘째 겹**: 시트 자신이 아이 어긋남을 막는다.
   * 화면 게이트를 통과한 뒤에도 선택된 아이는 바뀔 수 있고(전역 스토어) 딥링크로 이 화면이
   * 직접 열릴 수도 있다.
   */
  it("아이가 어긋나면 저장을 막고 이유를 말한다 (버튼 잠금 + 뮤테이션 가드 두 겹)", () => {
    const src = newExpense();
    const paramsBlock = src.slice(src.indexOf("const params = useLocalSearchParams<{"), src.indexOf("}>();"));
    expect(paramsBlock).toContain("childId?: string;");
    expect(src).toContain(
      "const failedRowChildMismatch = Boolean(authToken) && isFailedRowChildMismatch(params.childId, childId);"
    );
    // ① 저장 버튼 잠금(두 저장 버튼이 같은 판정을 지난다).
    expect(src).toContain(
      "const isSaveBlocked = isAmountInvalid || textOverLimitNotices.length > 0 || failedRowChildMismatch;"
    );
    // ② 뮤테이션 안에서도 한 번 더 — 로컬 쓰기 **전에** 막는다.
    const mutationFn = src.slice(src.indexOf("const saveExpense = useMutation({"), src.indexOf("onMutate: () => {"));
    expect(mutationFn).toContain("isFailedRowChildMismatch(params.childId, childId)");
    // ③ 잠근 이유를 말한다(문구는 src/offline/messages.ts 단일 소스).
    expect(src).toContain("{FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE}");
  });

  /**
   * 라운드 58 통합리뷰 P3-7·P3-8 — 날짜 폴백 안내와 연속 기록의 날짜 승계는 **누가 그 날짜를
   * 정했는가**를 본다(값 비교가 아니라).
   */
  it("날짜 폴백 안내는 사용자가 날짜를 고르면 다시 나타나지 않는다", () => {
    const src = newExpense();
    expect(src).toContain("const [dateFollowsPrefill, setDateFollowsPrefill] = useState(");
    expect(src).toContain("{prefilledSpentOn.fellBackToToday && dateFollowsPrefill ? (");
    // 값 비교로 되돌아가면 어제 → 오늘 칩에서 안내가 되살아난다.
    expect(src).not.toContain("prefilledSpentOn.fellBackToToday && expenseDateIso === initialExpenseDate.iso");
    // 날짜를 정하는 네 자리(빠른 칩 · 달력 · 14일 칩 · 직접 입력)가 모두 표시를 내린다.
    expect(src.match(/setDateFollowsPrefill\(false\)/g) ?? []).toHaveLength(5);
  });

  it("연속 기록은 프리필이 물려준 날짜만 오늘로 되돌린다 (사용자가 고른 날짜는 승계)", () => {
    const src = newExpense();
    const reset = src.slice(
      src.indexOf("const resetFormForNextEntry = () => {"),
      src.indexOf("const saveExpense = useMutation({")
    );
    expect(reset).toContain("if (dateFollowsPrefill) {");
    expect(reset).toContain("setExpenseDateIso(initialExpenseDate.iso);");
    // 조건 없이 되돌리면 마트 연속 기록(사용자가 고른 날짜)의 승계가 깨진다.
    expect(reset.indexOf("setExpenseDateIso(")).toBeGreaterThan(reset.indexOf("if (dateFollowsPrefill) {"));
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
