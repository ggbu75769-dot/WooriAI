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
 * ## 라운드 102 F6b — 칩 핀 (사용자가 고른 품목을 최근 이력보다 앞세운다)
 *
 * 최근 품목은 "마지막에 적은 것"이라, 매일 적는 품목(분유)이 어쩌다 적은 품목(돌잔치 답례품)에
 * 밀려 칩에서 사라진다. 그래서 사용자가 칩을 **길게 눌러** 품목을 고정(핀)할 수 있다 — 병합
 * 규칙은 이 모듈 하나가 진다: **핀 우선 → 최근 → 고정 폴백**, 중복 제거, 상한(품목 3칸)은
 * 종전 그대로다. 핀 상한도 3이다(칸이 3이라 그 이상은 설 자리가 없다). 핀이 3이면 화면의 모든
 * 품목 칩이 핀이므로, UI의 길게 누르기로는 "상한에서 새 핀 추가" 갈래에 닿을 수 없다 —
 * 그 갈래는 손상 저장본 방어일 뿐이다.
 *
 * persist는 기기 단위다(src/stores/quick-record-pins.store.ts — records-view 관례의 persist
 * 한 벌). 계정 경계는 최근 검색어(라운드 101 W2 F7)와 같은 사용자 단위 판단으로 session-teardown이
 * 지운다: 핀에 담기는 것은 품목명(개인 텍스트)이다.
 *
 * 순수 모듈 — 저장소·네트워크·React에 의존하지 않는다.
 */

/** 캡처의 고정 3칸. 이력이 모자랄 때만 뒤에서 채운다. */
export const HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES = ["기저귀", "병원비", "분유"] as const;

/** 품목 칸 수(캡처 기준 3). 네 번째 칸은 언제나 "직접 입력"이다. */
export const HOME_QUICK_RECORD_ITEM_SLOTS = 3;

export const HOME_QUICK_RECORD_MANUAL_LABEL = "+ 직접 입력";

/**
 * 구획 제목. 캡처에는 "자주 기록해요"였지만, 이 칩 목록은 이력이 모자라면 고정 3종(기저귀·
 * 병원비·분유)으로 채워진다 -- 기록이 하나도 없는 사용자에게 "자주 기록해요"라고 붙이면
 * 화면이 그 사람의 습관을 아는 척하는 거짓말이 된다. 제목을 이 목록이 실제로 하는 일
 * ("한 번에 기록을 시작하는 단축키")로 바꾼다. 칩 자체의 뜻·동작·개수는 그대로다.
 */
export const HOME_QUICK_RECORD_SECTION_TITLE = "빠른 기록";

/** 핀 상한 = 품목 칸 수. 칸보다 많은 핀은 어차피 설 자리가 없다(위 헤더). export하지 않는다 —
 * 값 계약은 sanitize/toggle의 동작으로 문는다(korean-particles의 "export const 0건" 관례). */
const HOME_QUICK_RECORD_PIN_LIMIT = HOME_QUICK_RECORD_ITEM_SLOTS;

/** TalkBack/VoiceOver 액션 메뉴에 서는 핀 토글 액션의 이름(내부 식별자 — 화면은
 * isQuickRecordPinToggleAction으로만 비교한다). */
const QUICK_RECORD_PIN_TOGGLE_ACTION_NAME = "toggle-pin";

export type HomeQuickRecordChip = {
  /** 칩에 보이는 문구. */
  label: string;
  /**
   * 지출 기록 화면에 프리필할 품목명. "직접 입력" 칩은 null이라 아무것도 채우지 않는다
   * (금액·분류는 넘기지 않는다 -- 칩에 보이지 않는 값을 몰래 채우면 사용자가 확인하지 않은
   * 숫자가 저장 직전까지 남는다).
   */
  itemName: string | null;
  /** 라운드 102 F6b: 핀 여부. 라벨 옆 고정 글리프·낭독 문장·핀 액션 라벨이 이 값 하나를 읽는다. */
  pinned: boolean;
  testID: string;
};

export type HomeQuickRecordSourceChip = { itemName: string };

/**
 * 저장본(또는 임의의 unknown)에서 살릴 수 있는 핀 목록만 남긴다: 문자열이 아닌 항목 제외,
 * 트림 후 빈 이름 제외, 중복 제외, 상한 3. 추가 경로(toggleQuickRecordPin)도 이 함수를 그대로
 * 지나므로 쓰는 쪽과 읽는 쪽 어느 끝으로도 규칙이 한 벌이다(recent-searches.ts의 관례).
 *
 * 중복·동일성은 트림 후 **원문 그대로** 비교한다 — 칩 병합(buildHomeQuickRecordChips)의 중복
 * 제거와 같은 규칙이다(규칙이 두 벌이면 같은 이름이 칩 두 개로 선다).
 */
export function sanitizeQuickRecordPins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const name = entry.trim();
    if (!name || result.includes(name)) continue;
    result.push(name);
    if (result.length >= HOME_QUICK_RECORD_PIN_LIMIT) break;
  }
  return result;
}

/**
 * 핀 하나를 켜거나 끈다(길게 누르기 한 번 = 토글 한 번).
 *
 *  - 이미 핀이면 해제(목록에서 제거), 아니면 목록 **끝**에 추가한다 — 먼저 고정한 것이 앞칸을
 *    지킨다(새 핀이 기존 핀의 자리를 흔들지 않는다).
 *  - 변화가 없으면(빈 이름 · 상한에서의 추가 시도) **원본 배열을 그대로** 돌려준다 — 스토어가
 *    같은 값 setState를 눕힐 수 있게(records-view.store의 setter 관례). 상한 갈래는 UI로는
 *    닿지 않는다(위 헤더) — 손상 저장본 방어다.
 */
export function toggleQuickRecordPin(pins: string[], itemName: string | null | undefined): string[] {
  const name = (itemName ?? "").trim();
  if (!name) return pins;
  if (pins.includes(name)) return pins.filter((entry) => entry !== name);
  if (pins.length >= HOME_QUICK_RECORD_PIN_LIMIT) return pins;
  return sanitizeQuickRecordPins([...pins, name]);
}

/**
 * 핀(있으면) → 최근 품목(있으면) → 고정값(모자란 만큼) 순으로 3칸을 채우고 "+ 직접 입력"을
 * 붙인다. 결과는 언제나 4개다. 핀이 최근 이력과 겹치면 핀 칸 하나로 합쳐진다(중복 제거).
 */
export function buildHomeQuickRecordChips(
  recentChips: readonly HomeQuickRecordSourceChip[] | null | undefined,
  pinnedItemNames?: readonly string[] | null
): HomeQuickRecordChip[] {
  // 스토어 밖(테스트·손상 저장본)에서 온 값도 같은 문으로 거른다 — 규칙 한 벌.
  const pins = sanitizeQuickRecordPins(pinnedItemNames ?? []);
  const names: string[] = [];
  const push = (candidate: string) => {
    const name = candidate.trim();
    if (!name || names.includes(name) || names.length >= HOME_QUICK_RECORD_ITEM_SLOTS) return;
    names.push(name);
  };

  for (const pin of pins) push(pin);
  for (const chip of recentChips ?? []) push(chip.itemName);
  for (const fallback of HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES) push(fallback);

  const chips: HomeQuickRecordChip[] = names.map((itemName, index) => ({
    label: itemName,
    itemName,
    pinned: pins.includes(itemName),
    testID: `home-quick-record-chip-${index}`
  }));
  chips.push({
    label: HOME_QUICK_RECORD_MANUAL_LABEL,
    itemName: null,
    pinned: false,
    testID: "home-quick-record-chip-manual"
  });
  return chips;
}

/**
 * 칩 본체의 스크린리더 라벨 — 핀 상태가 소리로도 구분된다(화면의 고정 글리프와 같은 사실을
 * 말한다: 색·글리프 단독 전달 금지). 핀이 아니면 종전 그대로 품목명 하나다.
 */
export function quickRecordChipAccessibilityLabel(chip: HomeQuickRecordChip): string {
  return chip.pinned ? `${chip.label}, 홈에 고정됨` : chip.label;
}

/**
 * 길게 누르기를 못 듣는 보조기술 사용자를 위한 힌트 문장 — role이 button이라 "두 번 탭"은
 * 스크린리더가 스스로 붙이므로, 여기서는 길게 누르기(=아래 접근성 액션과 같은 일)만 말한다.
 * "직접 입력" 칩에는 핀이 없으므로 화면이 이 힌트를 달지 않는다.
 */
export function quickRecordPinToggleHint(): string {
  return "길게 누르면 이 품목을 홈에 고정하거나 해제할 수 있어요";
}

/**
 * TalkBack/VoiceOver 액션 메뉴에 핀 토글을 노출한다 — 길게 누르기는 보조기술에서 발견도
 * 실행도 어려우므로, 기록 행 롱프레스(record-row-actions)와 같은 관례로 커스텀 액션을 함께
 * 단다. react-native `accessibilityActions`에 그대로 넘어가는 순수 데이터다(child-switch의
 * CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS와 같은 자리).
 */
export function quickRecordChipAccessibilityActions(
  chip: HomeQuickRecordChip
): ReadonlyArray<{ name: string; label: string }> {
  return [{ name: QUICK_RECORD_PIN_TOGGLE_ACTION_NAME, label: chip.pinned ? "고정 해제" : "홈에 고정" }];
}

/** 화면의 onAccessibilityAction이 액션 이름을 이 판정 하나로 비교한다(문자열 이중 기재 방지). */
export function isQuickRecordPinToggleAction(actionName: string): boolean {
  return actionName === QUICK_RECORD_PIN_TOGGLE_ACTION_NAME;
}

/**
 * 라운드 102 리뷰 L-핀 — 토글이 **성사된 뒤** 낭독할 확인 문장.
 *
 * 길게 누르기·커스텀 액션 어느 쪽으로 토글해도 화면에서 바뀌는 것은 칩 앞의 작은 글리프와
 * 칩 순서뿐이라(둘 다 시각 신호다), 스크린리더 사용자는 자기가 방금 한 일이 됐는지 알 방법이
 * 없었다. 목록이 다시 그려져도 포커스가 옮겨 가지 않아 새 라벨("…, 홈에 고정됨")이 자동으로
 * 읽히지도 않는다 — 그래서 확인은 **낭독 한 줄**이 진다(기록 행 롱프레스 액션과 같은 관례).
 *
 * 인자는 토글 **직후**의 목록이다(스토어가 돌려준 그 값). 목록에 이름이 있으면 방금 고정된
 * 것이고, 없으면 방금 해제된 것이다 — 화면이 "무엇을 했는지"를 따로 기억하지 않아도 되도록
 * 사실 하나로 판정한다. 이름 뒤에는 조사가 오지 않는다(korean-particle 설계 — 뒤에 체언이 온다).
 */
export function quickRecordPinToggleAnnouncement(
  itemName: string | null | undefined,
  pinsAfterToggle: readonly string[]
): string | null {
  const name = (itemName ?? "").trim();
  if (!name) return null;
  return pinsAfterToggle.includes(name) ? `${name} 홈에 고정했어요` : `${name} 고정을 해제했어요`;
}
