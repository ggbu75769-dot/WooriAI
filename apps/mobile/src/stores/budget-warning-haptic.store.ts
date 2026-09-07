import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 102 리뷰 M-1 — 홈 예산 100% 경고 **햅틱의 경계 클레임**(at-most-once).
 *
 * ## 왜 persist인가 (두 시점)
 * 라운드 102 F6b가 이 발화를 배선할 때 중복 방지는 화면의 `useRef` 하나였다. ref는 마운트마다
 * 새로 서므로 **앱을 열 때마다** 진동이 났다 — 예산을 초과한 달에는 그 달 내내, 홈에 들어올
 * 때마다. 설계 §4.4가 인용하는 규율은 그 반대다: 경고 3표면 중 푸시는 `push_boundary_marks`의
 * **(아이, 월, 경계) 유니크 클레임**으로 at-most-once를 지키고, `src/ui/haptics.ts` 머리말이
 * 경고에만 Vibration 폴백을 허용한 근거도 "경고는 드물다"였다. 잦은 진동은 확인이 아니라
 * 소음이므로, 기억을 기기에 남겨 **그 경계당 한 번**으로 만든다.
 *
 * ## 클레임 키 = (아이, 월, 경계)
 * 서버 클레임 표와 **같은 축**이다. 월이 키에 있으므로 달이 바뀌면 다시 한 번 울리고(새 달의
 * 초과는 새 사실이다), 아이가 키에 있으므로 형제자매의 예산은 서로의 클레임을 쓰지 않는다.
 * 경계 축("exceeded")은 오늘 한 값뿐이지만 키에 남긴다 — 80% 접근 배너가 언젠가 촉각 신호를
 * 갖게 되는 날 두 경계가 같은 칸을 다투지 않도록(그 축이 서버 표에 있는 이유와 같다).
 *
 * ## 상한 · 저장 규약
 * 저장은 기기 단위이고 담기는 것은 **id와 월 문자열뿐**(금액도 품목명도 없다). 최신 것부터
 * 남기고 {@link BUDGET_WARNING_HAPTIC_CLAIM_LIMIT}을 넘으면 오래된 것을 버린다 — 지난 달
 * 클레임은 그 달의 배너가 다시 설 수 없으므로 버려도 재발화가 없고, 같은 달 안에서 상한에
 * 닿으려면 아이가 그 수만큼 있어야 한다. persist 관례는 quick-record-pins.store와 한 벌이다:
 * 값만 저장(partialize), 복원 양끝 sanitize(migrate + merge), 하이드레이션 보호(touched).
 *
 * ## 계정 경계
 * 담기는 것이 아이 id·월이라 **사용자 단위** 판단이다 — 계정 정체성이 바뀌면 `resetAll`이
 * 지운다(src/offline/session-teardown.ts). A의 아이에 대한 클레임이 B의 홈에 남아 B가 받아야
 * 할 경고를 삼키면 안 된다.
 */

/** 저장하는 클레임 수의 상한(위 헤더). export하지 않는다 — 값 계약은 sanitize의 동작이 문다. */
const BUDGET_WARNING_HAPTIC_CLAIM_LIMIT = 8;

/**
 * (아이, 월, 경계) 클레임 키. 셋 중 하나라도 비면 null이다 — 모르는 축으로 만든 키는 다른
 * 상태와 충돌하는 가짜 클레임이 되므로, 그때는 클레임하지 않는다(= 울리지도 않는다).
 */
export function budgetWarningHapticClaimKey(
  childId: string | null | undefined,
  yearMonth: string | null | undefined,
  level: string | null | undefined
): string | null {
  if (!childId || !yearMonth || !level) return null;
  return `${childId}:${yearMonth}:${level}`;
}

/**
 * 저장본(또는 임의의 unknown)에서 살릴 수 있는 클레임만 남긴다: 배열이 아니면 빈 목록,
 * 문자열 아닌 항목·빈 문자열·중복 제외, 상한 초과는 **오래된 것부터** 버린다(최신이 살아
 * 남아야 방금 울린 경계가 다시 울리지 않는다 — 이 목록의 목적이 그것이다).
 */
export function sanitizeBudgetWarningHapticClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const key = entry.trim();
    if (!key || result.includes(key)) continue;
    result.push(key);
  }
  return result.slice(-BUDGET_WARNING_HAPTIC_CLAIM_LIMIT);
}

export type BudgetWarningHapticState = {
  /** 이미 촉각 신호를 낸 (아이, 월, 경계) 키 목록(오래된 것이 앞). */
  claimedKeys: string[];
  /** 이 실행에서 클레임이 한 번이라도 시도됐는가(저장하지 않는다 — 하이드레이션 보호). */
  touched: boolean;
  /**
   * 경계를 클레임한다. **처음 클레임한 경우에만 true** — 호출자는 그때만 발화한다.
   * 키가 null이면(축을 모른다) 아무것도 적지 않고 false다.
   */
  claimBoundary: (key: string | null) => boolean;
  /** 전체 삭제 — 세션 teardown(계정 경계)이 쓰는 문이다. */
  resetAll: () => void;
};

export const useBudgetWarningHapticStore = create<BudgetWarningHapticState>()(
  persist(
    (set, get) => ({
      claimedKeys: [],
      touched: false,
      claimBoundary: (key) => {
        if (!key) return false;
        const alreadyClaimed = get().claimedKeys.includes(key);
        set((state) =>
          alreadyClaimed
            ? // 변화 없음: 재렌더를 만들지 않는다. 다만 "변이 시도가 있었다"는 사실은
              // 하이드레이션 보호가 지켜야 하므로 플래그만 아직 안 섰다면 세운다
              // (quick-record-pins.store와 같은 관례).
              state.touched
              ? state
              : { ...state, touched: true }
            : { claimedKeys: sanitizeBudgetWarningHapticClaims([...state.claimedKeys, key]), touched: true }
        );
        return !alreadyClaimed;
      },
      resetAll: () =>
        set((state) => (state.claimedKeys.length === 0 && state.touched ? state : { claimedKeys: [], touched: true }))
    }),
    {
      name: "wooriai-budget-warning-haptic",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ claimedKeys: state.claimedKeys }),
      migrate: (persisted) => {
        const blob = persisted as { claimedKeys?: unknown } | null;
        return { claimedKeys: sanitizeBudgetWarningHapticClaims(blob?.claimedKeys) };
      },
      merge: (persisted, current) => {
        const blob = persisted as { claimedKeys?: unknown } | null;
        return {
          ...current,
          claimedKeys: current.touched
            ? current.claimedKeys
            : sanitizeBudgetWarningHapticClaims(blob?.claimedKeys)
        };
      }
    }
  )
);
