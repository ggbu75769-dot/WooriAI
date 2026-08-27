/**
 * 라운드 41 UX-U(A) — 더보기 탭 **세션 메뉴 구성**의 단일 소스.
 *
 * 왜 순수 모듈인가: 이 화면(app/(tabs)/more.tsx)은 react-native 화면이라 vitest에서 렌더할 수
 * 없다(이 저장소의 제약 — src/expenses/month-expenses.test.ts 관례). 그래서 "어떤 행이, 어떤
 * 이름으로, 어디로 가는가"라는 정보 구조 판정만 여기로 떼어 내 단위 테스트 대상으로 둔다.
 * 화면은 이 스펙을 라우팅/핸들러에 잇기만 한다.
 *
 * 이 티켓이 고치는 네 가지 어긋남:
 *  1. 프로필 카드가 **아이 이름 + 개월수**를 보여 주면서 목적지는 /family(가구 화면)였다.
 *     카드가 말하는 정보와 목적지를 맞춰 /settings/children(아이 관리)으로 보낸다
 *     (MORE_PROFILE_CARD_ROUTE). 가구 화면으로 가는 입구는 아래 "가족 관리" 행 **하나**다.
 *  2. 그 카드 바로 아래 "프로필 관리" 행도 /family였다 — 같은 목적지 입구가 둘. 행 이름을
 *     설정 화면(app/settings/index.tsx)과 같은 "가족 관리"로 맞추고 /family는 이 행만 갖는다.
 *  3. "알림"(알림함, /notifications)과 설정 안의 "알림 설정"(/settings/notifications)이 인접한
 *     계층에서 이름만으로 구분되지 않았다. 받은 알림을 보는 쪽을 "알림함"으로 명시한다.
 *  4. 자주 쓰는 "아이 관리"·"예산 수정"은 더보기 → 설정 → 각 화면으로 3탭 깊이인데, 반대로
 *     "엑셀 가져오기"·"약관 및 개인정보"는 더보기와 설정 양쪽에 중복으로 있었다. 앞의 둘을
 *     더보기로 끌어올리고 뒤의 둘은 설정 쪽에만 남긴다 — **행 수 총량은 그대로 7행**이라
 *     더보기 화면이 한 화면에 들어오는 compact 기준(SET-001)이 흔들리지 않는다.
 *
 * ⚠️ 픽셀 락(SET-001): 더보기 화면의 캡처는 **비로그인 경로**로 찍는다(app/pixel-lock.tsx가
 * 세션을 지우고 이동). 그래서 이 모듈은 **세션 메뉴만** 만든다 — 비로그인 미리보기 행
 * (more.tsx의 moreMenuRows·previewMenuRowActions)은 한 글자도 건드리지 않고 화면에 그대로
 * 남겨 둔다. 그 불변 계약은 more-menu.test.ts가 소스 그렙으로 지킨다.
 */

/** 세션 메뉴 행의 식별자 — 테스트와 화면이 순서/구성을 말할 때 쓰는 안정된 이름이다. */
export type MoreMenuRowId = "children" | "family" | "budget" | "notifications" | "settings" | "export" | "appInfo";

export type MoreMenuRowSpec = {
  id: MoreMenuRowId;
  /** 행 왼쪽 글리프. 설정 화면(app/settings/index.tsx)의 같은 항목과 같은 글자를 쓴다. */
  icon: string;
  title: string;
  /**
   * 이동할 라우트. 화면 안에서 처리하는 행(내보내기 카드 토글 · 앱 정보 Alert)은 `null`이고,
   * 그 행의 동작은 화면이 id로 붙인다 — 라우팅이 아닌 동작을 이 모듈이 알 필요가 없다.
   */
  route: string | null;
};

/**
 * 프로필 카드(아이 이름 + 개월수)를 눌렀을 때의 목적지. 카드가 보여 주는 정보와 같은 화면이다.
 * 화면의 카드 라벨("○○ 프로필 관리")과 렌더는 픽셀 락 때문에 그대로 두고 목적지만 바꾼다.
 */
export const MORE_PROFILE_CARD_ROUTE = "/settings/children";

/** 더보기 세션 메뉴에서 **제거된** 중복 행의 목적지 — 설정 화면에만 남긴다(테스트용 계약). */
export const MORE_MENU_SETTINGS_ONLY_ROUTES = ["/import", "/settings/privacy"] as const;

/**
 * 로그인 상태의 더보기 메뉴 행을 순서대로 만든다.
 *
 * 순서는 "얼마나 자주 쓰는가"다: 아이 · 가족 · 예산은 매달 손대는 것, 알림함은 확인하러 오는
 * 것, 설정은 어쩌다 한 번, 내보내기 · 앱 정보는 맨 아래. 설정 안에 다시 있는 항목(아이 관리 ·
 * 가족 관리 · 예산 수정)이 여기에도 있는 것은 중복이 아니라 **얕은 지름길**이다 — 반대로
 * 가져오기/약관은 지름길로 둘 이유가 없어 설정 한 곳으로 모았다.
 *
 * @param exportTitle CSV 내보내기 행의 제목. 문구 단일 소스는 src/export/ExpenseCsvExport.tsx의
 *   `EXPORT_MENU_TITLE`이라 여기서 다시 적지 않고 주입받는다(설정 화면도 같은 상수를 쓴다).
 */
export function buildMoreSessionMenuRows({ exportTitle }: { exportTitle: string }): MoreMenuRowSpec[] {
  return [
    { id: "children", icon: "✎", title: "아이 관리", route: "/settings/children" },
    { id: "family", icon: "♥", title: "가족 관리", route: "/family" },
    { id: "budget", icon: "₩", title: "예산 수정", route: "/budget" },
    // "알림 설정"(설정 → 푸시 수신 관리)과 헷갈리지 않도록 **받은 알림을 읽는 곳**임을 이름에 담는다.
    { id: "notifications", icon: "♧", title: "알림함", route: "/notifications" },
    { id: "settings", icon: "◐", title: "설정", route: "/settings" },
    // 라우트가 없는 두 행: 내보내기는 같은 화면의 기간 선택 카드를 접었다 폈다 하고,
    // 앱 정보는 Alert만 띄운다. 그 동작은 화면이 id로 붙인다.
    { id: "export", icon: "⇪", title: exportTitle, route: null },
    { id: "appInfo", icon: "ⓘ", title: "앱 정보", route: null }
  ];
}
