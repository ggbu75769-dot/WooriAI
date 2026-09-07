import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  budgetWarningHapticClaimKey,
  sanitizeBudgetWarningHapticClaims,
  useBudgetWarningHapticStore
} from "./budget-warning-haptic.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 102 리뷰 M-1 — 홈 예산 100% 경고 햅틱의 (아이, 월, 경계) 클레임 스토어.
 *
 * 무는 것: at-most-once(같은 경계는 다시 울리지 않는다) · 월/아이가 바뀌면 다시 한 번 울린다 ·
 * persist 왕복과 복원 양끝 sanitize · 하이드레이션 보호(touched) · 계정 경계(teardown 합류).
 * quick-record-pins.store.test.ts와 같은 형식이다(같은 persist 한 벌이기 때문이다).
 */
describe("useBudgetWarningHapticStore", () => {
  beforeEach(() => {
    useBudgetWarningHapticStore.setState({ claimedKeys: [], touched: false });
  });

  it("클레임 키는 (아이, 월, 경계) 셋을 전부 알 때만 만들어진다", () => {
    expect(budgetWarningHapticClaimKey("child-1", "2026-09-01", "exceeded")).toBe("child-1:2026-09-01:exceeded");
    for (const missing of [null, undefined, ""]) {
      expect(budgetWarningHapticClaimKey(missing, "2026-09-01", "exceeded")).toBeNull();
      expect(budgetWarningHapticClaimKey("child-1", missing, "exceeded")).toBeNull();
      expect(budgetWarningHapticClaimKey("child-1", "2026-09-01", missing)).toBeNull();
    }
  });

  it("같은 경계는 한 번만 클레임된다 — 두 번째부터는 false다(앱을 다시 열어도 같다)", () => {
    const state = () => useBudgetWarningHapticStore.getState();
    const key = budgetWarningHapticClaimKey("child-1", "2026-09-01", "exceeded")!;
    expect(state().claimBoundary(key)).toBe(true);
    expect(state().claimBoundary(key)).toBe(false);
    expect(state().claimedKeys).toEqual([key]);
    // 키가 없으면(축을 모른다) 아무것도 적지 않고 울리지도 않는다.
    expect(state().claimBoundary(null)).toBe(false);
    expect(state().claimedKeys).toEqual([key]);
  });

  it("월이 바뀌면 다시 한 번, 아이가 달라도 다시 한 번 울린다 (푸시 클레임과 같은 축)", () => {
    const state = () => useBudgetWarningHapticStore.getState();
    expect(state().claimBoundary("child-1:2026-09-01:exceeded")).toBe(true);
    // 새 달의 초과는 새 사실이다.
    expect(state().claimBoundary("child-1:2026-10-01:exceeded")).toBe(true);
    // 형제자매는 서로의 클레임을 쓰지 않는다.
    expect(state().claimBoundary("child-2:2026-09-01:exceeded")).toBe(true);
    // 경계 축이 다르면 별개다(80% 접근이 촉각을 갖게 되는 날의 자리).
    expect(state().claimBoundary("child-1:2026-09-01:approaching")).toBe(true);
    expect(state().claimedKeys).toHaveLength(4);
  });

  it("상한을 넘으면 **오래된** 클레임부터 버린다 — 방금 울린 경계가 살아남는다", () => {
    const state = () => useBudgetWarningHapticStore.getState();
    for (let index = 0; index < 9; index += 1) state().claimBoundary(`child-${index}:2026-09-01:exceeded`);
    expect(state().claimedKeys).toHaveLength(8);
    expect(state().claimedKeys.at(-1)).toBe("child-8:2026-09-01:exceeded");
    // 밀려난 것은 가장 오래된 하나뿐이다.
    expect(state().claimedKeys).not.toContain("child-0:2026-09-01:exceeded");
    expect(state().claimBoundary("child-8:2026-09-01:exceeded")).toBe(false);
  });

  it("resetAll이 전부 비운다 — 그 뒤에는 같은 경계가 다시 한 번 울린다(계정 경계)", () => {
    const state = () => useBudgetWarningHapticStore.getState();
    const key = "child-1:2026-09-01:exceeded";
    expect(state().claimBoundary(key)).toBe(true);
    state().resetAll();
    expect(state().claimedKeys).toEqual([]);
    expect(state().claimBoundary(key)).toBe(true);
  });

  it("런타임 플래그(touched)는 저장하지 않고, persist 왕복이 클레임을 되살린다", () => {
    const options = useBudgetWarningHapticStore.persist.getOptions();
    useBudgetWarningHapticStore.getState().claimBoundary("child-1:2026-09-01:exceeded");
    const saved = options.partialize!({ ...useBudgetWarningHapticStore.getState() });
    expect(saved).toEqual({ claimedKeys: ["child-1:2026-09-01:exceeded"] });
    const restored = options.merge!(saved, {
      ...useBudgetWarningHapticStore.getState(),
      claimedKeys: [],
      touched: false
    }) as { claimedKeys: string[] };
    expect(restored.claimedKeys).toEqual(["child-1:2026-09-01:exceeded"]);
  });

  it("옛/손상 저장본은 복원 양끝(migrate·merge)에서 살릴 수 있는 것만 남는다", () => {
    const options = useBudgetWarningHapticStore.persist.getOptions();
    for (const broken of [undefined, null, "", "child-1", 3, {}, { claimedKeys: "child-1" }]) {
      expect(options.migrate!(broken, 1), String(broken)).toEqual({ claimedKeys: [] });
      const merged = options.merge!(broken, { ...useBudgetWarningHapticStore.getState(), touched: false }) as {
        claimedKeys: string[];
      };
      expect(merged.claimedKeys, String(broken)).toEqual([]);
    }
    expect(sanitizeBudgetWarningHapticClaims(["a", 3, "  ", "a", "b"])).toEqual(["a", "b"]);
  });

  /**
   * 하이드레이션이 이 실행의 클레임을 되감으면, 되감긴 경계가 **다시 한 번 울린다** — 즉
   * 종전 ref와 같은 결함으로 되돌아간다. (화면은 그래서 하이드레이션 뒤에만 클레임한다;
   * 그 배선 계약은 src/ui/haptics.test.ts가 진다.)
   */
  it("하이드레이션이 이 실행의 클레임을 되감지 않는다", () => {
    const merge = useBudgetWarningHapticStore.persist.getOptions().merge!;
    const fresh = merge({ claimedKeys: ["child-1:2026-09-01:exceeded"] }, {
      ...useBudgetWarningHapticStore.getState(),
      touched: false
    }) as { claimedKeys: string[] };
    expect(fresh.claimedKeys).toEqual(["child-1:2026-09-01:exceeded"]);

    const claimedThisRun = merge({ claimedKeys: [] }, {
      ...useBudgetWarningHapticStore.getState(),
      claimedKeys: ["child-2:2026-09-01:exceeded"],
      touched: true
    }) as { claimedKeys: string[] };
    expect(claimedThisRun.claimedKeys).toEqual(["child-2:2026-09-01:exceeded"]);
  });

  it("persist 관례가 저장소의 다른 스토어와 같다(이름·버전·값만 저장·복원 양끝 sanitize)", () => {
    const storeSource = source("src/stores/budget-warning-haptic.store.ts");
    expect(storeSource).toContain('name: "wooriai-budget-warning-haptic"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    expect(storeSource).toContain("partialize: (state) => ({ claimedKeys: state.claimedKeys })");
  });

  it("계정 경계: teardown 목록에 사용자 단위로 합류해 있다 (session-teardown.ts)", () => {
    const teardownSource = source("src/offline/session-teardown.ts");
    expect(teardownSource).toContain("useBudgetWarningHapticStore.getState().resetAll();");
    // 판단 근거(아이 id가 담긴다 — B가 받아야 할 경고를 A의 클레임이 삼키면 안 된다)가 함께 적혀 있다.
    expect(teardownSource).toContain("예산 경고 햅틱의 (아이, 월, 경계) 클레임도 사용자 단위다");
  });
});
