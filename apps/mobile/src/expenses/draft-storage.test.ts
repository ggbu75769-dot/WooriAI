import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Re-imports draft-storage and its persist-storage dependency together after a vi.resetModules()
 * call, so both references come from the same fresh module graph (mirrors the pattern used in
 * src/stores/secure-session-storage.test.ts to avoid a stale persist-storage instance with its
 * own, unrelated in-memory map).
 */
async function loadModules() {
  const [{ persistStorage }, draftStorage] = await Promise.all([
    import("../stores/persist-storage"),
    import("./draft-storage")
  ]);
  return { persistStorage, ...draftStorage };
}

describe("quick expense draft storage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("round-trips a written draft through read", async () => {
    const { writeQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();

    const draft = {
      itemName: "기저귀",
      amountText: "12000",
      memo: "대용량",
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      spentOnIso: "2026-07-10",
      isGift: false
    };

    await writeQuickExpenseDraft(draft);
    const result = await readQuickExpenseDraft();

    expect(result).toEqual(draft);
  });

  it("returns null after clearing the draft", async () => {
    const { writeQuickExpenseDraft, clearQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();

    await writeQuickExpenseDraft({
      itemName: "분유",
      amountText: "35000",
      memo: "",
      categoryId: "c0a7e901-0000-4c02-8c02-c47e900ec002",
      spentOnIso: "2026-07-11",
      isGift: true
    });
    await clearQuickExpenseDraft();

    expect(await readQuickExpenseDraft()).toBeNull();
  });

  it("returns null when no draft has ever been written", async () => {
    const { readQuickExpenseDraft } = await loadModules();

    expect(await readQuickExpenseDraft()).toBeNull();
  });

  /**
   * 라운드 63 C(#4) — 초안은 전역 키 한 벌인데 저장 대상은 그때그때의 **전역 선택 아이**다.
   * 그래서 첫째 앞에서 치다 닫은 값이 둘째의 시트에 프리필처럼 복원될 수 있었고, 그대로
   * 저장하면 둘째의 지출이 됐다. 여기서 고정하는 것은 세 가지다: 가산 필드가 왕복하는가,
   * 구 blob이 종전대로 복원되는가, 폐기가 남의 초안을 건드리지 않는가.
   */
  it("아이 id를 가산 필드로 왕복시킨다 (구 계약의 나머지는 한 글자도 바뀌지 않는다)", async () => {
    const { writeQuickExpenseDraft, readQuickExpenseDraft } = await loadModules();

    const draft = {
      itemName: "기저귀",
      amountText: "38500",
      memo: "",
      spentOnIso: "2026-08-27",
      isGift: false,
      childId: "child-a"
    };

    await writeQuickExpenseDraft(draft);
    expect(await readQuickExpenseDraft()).toEqual(draft);
  });

  it("다른 아이의 초안만 복원을 막는다 — 모르는 쪽이 하나라도 있으면 종전 그대로다", async () => {
    const { isQuickExpenseDraftFromOtherChild } = await loadModules();

    const base = { itemName: "기저귀", amountText: "38500", memo: "", spentOnIso: "2026-08-27", isGift: false };

    // 둘 다 알고 다르다 = 유일하게 막는 경우.
    expect(isQuickExpenseDraftFromOtherChild({ ...base, childId: "child-a" }, "child-b")).toBe(true);
    // 같은 아이.
    expect(isQuickExpenseDraftFromOtherChild({ ...base, childId: "child-a" }, "child-a")).toBe(false);
    // 구 blob(childId 없음) = 마이그레이션 없이 종전 그대로 복원된다.
    expect(isQuickExpenseDraftFromOtherChild(base, "child-b")).toBe(false);
    // 지금 아이를 아직 모른다(persist 하이드레이션 전) = 자기 초안을 잃지 않는다.
    for (const selected of [null, undefined, "   "]) {
      expect(isQuickExpenseDraftFromOtherChild({ ...base, childId: "child-a" }, selected)).toBe(false);
    }
    // 초안이 빈 문자열로 아이를 말하는 손상 데이터도 "모른다"로 다룬다.
    expect(isQuickExpenseDraftFromOtherChild({ ...base, childId: "  " }, "child-b")).toBe(false);
    expect(isQuickExpenseDraftFromOtherChild(null, "child-b")).toBe(false);
  });

  it("폐기 API는 그 아이의 초안(과 주인 없는 초안)만 지운다", async () => {
    const { writeQuickExpenseDraft, readQuickExpenseDraft, clearQuickExpenseDraftForChild } = await loadModules();

    const base = { itemName: "분유", amountText: "35000", memo: "", spentOnIso: "2026-08-27", isGift: false };

    // 다른 아이의 초안은 살아남는다 -- 아이 하나를 지웠다고 남은 아이 앞에서 치던 입력까지
    // 버릴 근거가 없다.
    await writeQuickExpenseDraft({ ...base, childId: "child-a" });
    await clearQuickExpenseDraftForChild("child-b");
    expect(await readQuickExpenseDraft()).toEqual({ ...base, childId: "child-a" });

    // 그 아이의 초안은 지운다.
    await clearQuickExpenseDraftForChild("child-a");
    expect(await readQuickExpenseDraft()).toBeNull();

    // 주인을 말하지 않는 초안(구 blob)은 지운다 -- 다른 아이의 것이라고 증명할 수 없다.
    await writeQuickExpenseDraft(base);
    await clearQuickExpenseDraftForChild("child-a");
    expect(await readQuickExpenseDraft()).toBeNull();

    // 아이를 모르면 아무것도 하지 않는다(빈 문자열로 남의 초안을 지우지 않는다).
    await writeQuickExpenseDraft({ ...base, childId: "child-a" });
    await clearQuickExpenseDraftForChild("   ");
    expect(await readQuickExpenseDraft()).toEqual({ ...base, childId: "child-a" });
  });
});

/**
 * 라운드 63 C(#4) 배선 계약 — 판정이 순수 모듈에 있어도 화면이 지나지 않으면 아무 일도 하지
 * 않는다(이 저장소의 관례인 소스 grep 계약: vitest에서 react-native를 렌더할 수 없다).
 */
describe("아이 스코프 초안 배선 (app/expenses/new.tsx)", () => {
  const newExpenseSource = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

  it("복원이 다른 아이의 초안을 걸러내고, 자동 저장이 주인을 적어 둔다", () => {
    expect(newExpenseSource).toContain("if (isQuickExpenseDraftFromOtherChild(draft, childId)) return;");
    expect(newExpenseSource).toContain("...(childId ? { childId } : {}),");
  });

  it("초안 정리 경로 셋이 전부 아이 스코프 폐기를 지난다", () => {
    // 남는 무조건 폐기는 "아이를 모를 때"의 폴백 한 곳뿐이다.
    expect(newExpenseSource).toContain(
      "childId ? clearQuickExpenseDraftForChild(childId) : clearQuickExpenseDraft();"
    );
    expect(newExpenseSource.match(/clearDraftForCurrentChild\(\);/g) ?? []).toHaveLength(3);
    expect(newExpenseSource.match(/clearQuickExpenseDraft\(\);/g) ?? []).toHaveLength(1);
  });

  it("프리필이 정한 날짜를 초안이 덮지 않는다 (달력 빈 칸 → 그날로 기록)", () => {
    expect(newExpenseSource).toContain("if (draft.spentOnIso && !prefilledSpentOn.spentOn) setExpenseDateIso(draft.spentOnIso);");
  });
});
