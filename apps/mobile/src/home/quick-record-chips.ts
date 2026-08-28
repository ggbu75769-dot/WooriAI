/**
 * DSN-053 P2-A — 홈 "자주 기록해요" 칩 4개.
 *
 * 승인 캡처(c20deeb 픽셀 홈 155-163)는 고정 문자열 3개(기저귀 · 병원비 · 분유) + "+ 직접 입력"
 * 이었다. 그건 **비세션 미리보기**라 이 기기의 이력이 없었기 때문이고, 세션 홈에는 이미 같은
 * 목적의 값이 있다 -- 지출 기록 화면의 "최근 품목" 칩(EXP-113, src/expenses/recent-items.ts)이
 * 이 기기의 로컬 이력과 서버 월 캐시에서 만들어 둔 목록이다. 새 규칙을 만들지 않고 그 결과를
 * 받아, 캡처와 같은 **3칸 + 직접 입력**으로 줄인다.
 *
 * 모자란 칸만 캡처의 고정값으로 채운다. 이 셋은 "당신이 이걸 샀다"는 주장이 아니라 **입력 폼을
 * 미리 채워 주는 단축키**라(눌러도 저장은 지출 기록 화면에서만 일어난다) 이력이 없는 사용자에게
 * 보여도 허위 표시가 아니다. 이미 최근 품목으로 올라온 이름은 중복으로 채우지 않는다.
 *
 * 순수 모듈 — 저장소·네트워크·React에 의존하지 않는다.
 */

/** 캡처의 고정 3칸. 이력이 모자랄 때만 뒤에서 채운다. */
export const HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES = ["기저귀", "병원비", "분유"] as const;

/** 품목 칸 수(캡처 기준 3). 네 번째 칸은 언제나 "직접 입력"이다. */
export const HOME_QUICK_RECORD_ITEM_SLOTS = 3;

export const HOME_QUICK_RECORD_MANUAL_LABEL = "+ 직접 입력";

export const HOME_QUICK_RECORD_SECTION_TITLE = "자주 기록해요";

export type HomeQuickRecordChip = {
  /** 칩에 보이는 문구. */
  label: string;
  /**
   * 지출 기록 화면에 프리필할 품목명. "직접 입력" 칩은 null이라 아무것도 채우지 않는다
   * (금액·분류는 넘기지 않는다 -- 칩에 보이지 않는 값을 몰래 채우면 사용자가 확인하지 않은
   * 숫자가 저장 직전까지 남는다).
   */
  itemName: string | null;
  testID: string;
};

export type HomeQuickRecordSourceChip = { itemName: string };

/**
 * 최근 품목(있으면) → 고정값(모자란 만큼) 순으로 3칸을 채우고 "+ 직접 입력"을 붙인다.
 * 결과는 언제나 4개다.
 */
export function buildHomeQuickRecordChips(
  recentChips: readonly HomeQuickRecordSourceChip[] | null | undefined
): HomeQuickRecordChip[] {
  const names: string[] = [];
  const push = (candidate: string) => {
    const name = candidate.trim();
    if (!name || names.includes(name) || names.length >= HOME_QUICK_RECORD_ITEM_SLOTS) return;
    names.push(name);
  };

  for (const chip of recentChips ?? []) push(chip.itemName);
  for (const fallback of HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES) push(fallback);

  const chips: HomeQuickRecordChip[] = names.map((itemName, index) => ({
    label: itemName,
    itemName,
    testID: `home-quick-record-chip-${index}`
  }));
  chips.push({ label: HOME_QUICK_RECORD_MANUAL_LABEL, itemName: null, testID: "home-quick-record-chip-manual" });
  return chips;
}
