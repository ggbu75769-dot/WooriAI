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
 * (more.tsx의 moreMenuRows·previewMenuRowActions)의 구성·순서·문구·목적지는 이 모듈이 손대지
 * 않고 화면에 그대로 남겨 둔다. 그 불변 계약은 more-menu.test.ts가 소스 그렙으로 지킨다.
 *
 * D1 후속(실기기 APK 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음"): 그 미리보기 행의
 * **아이콘만** 사용자 요청에 따라 Ionicons로 바뀌었다(문구·순서·목적지는 그대로). SET-001
 * 기준 이미지는 그만큼 달라지므로 재캡처 대상이다.
 */

// D1 후속(실기기 피드백 2): 행 글리프가 Ionicons **이름**이 됐다. 타입 전용 import라 런타임에는
// 아무것도 들어오지 않는다(이 모듈은 vitest에서 도는 순수 모듈로 남는다).
import type { Ionicons } from "@expo/vector-icons";

/** 세션 메뉴 행의 식별자 — 테스트와 화면이 순서/구성을 말할 때 쓰는 안정된 이름이다. */
export type MoreMenuRowId = "children" | "family" | "budget" | "notifications" | "settings" | "export" | "appInfo";

/**
 * DSN-053 P2-D — 세션 메뉴의 **4분할 구획**.
 *
 * 승인 캡처(SET-001 = "프로필")의 메뉴는 평평한 한 덩어리가 아니라 제목이 붙은 그룹 박스 넷이다
 * (아이·산모 / 가족 / 예산·데이터 / 설정). 종전 화면은 같은 7행을 테두리 하나에 몰아넣어, "예산
 * 수정" 바로 아래에 "알림함"이 오는 식으로 성격이 다른 행들이 인접했다.
 *
 * 구획은 **행 자체의 성질**이므로 행 목록과 같은 자리에서 정한다 — 화면이 id를 보고 다시
 * 분류하면 행이 하나 늘 때마다 두 곳을 고쳐야 하고, 그 둘이 갈리는 순간 화면에서 조용히
 * 사라지는 행이 생긴다. 문구·순서·목적지는 이 티켓에서 한 글자도 바뀌지 않는다.
 */
export type MoreMenuSection = "child" | "family" | "budgetData" | "settings";

export const MORE_MENU_SECTIONS: ReadonlyArray<{ key: MoreMenuSection; title: string }> = [
  { key: "child", title: "아이 · 산모" },
  { key: "family", title: "가족" },
  { key: "budgetData", title: "예산 · 데이터" },
  { key: "settings", title: "설정" }
];

export type MoreMenuRowSpec = {
  id: MoreMenuRowId;
  /** 이 행이 속한 구획. 화면은 이 값으로만 그룹 박스를 나눈다(MORE_MENU_SECTIONS 순서대로). */
  section: MoreMenuSection;
  /**
   * 행 왼쪽 아이콘 **이름**(Ionicons). 설정 화면(app/settings/index.tsx)의 같은 항목과 같은
   * 아이콘을 쓴다 -- 같은 기능이 화면마다 다른 그림으로 보이지 않게 하는 게 요점이라, 예전
   * "같은 글자를 쓴다" 규칙을 이름 기준으로 그대로 옮긴 것이다.
   */
  icon: keyof typeof Ionicons.glyphMap;
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
    { id: "children", section: "child", icon: "person-circle-outline", title: "아이 관리", route: "/settings/children" },
    { id: "family", section: "family", icon: "people-outline", title: "가족 관리", route: "/family" },
    { id: "budget", section: "budgetData", icon: "wallet-outline", title: "예산 수정", route: "/budget" },
    // "알림 설정"(설정 → 푸시 수신 관리)과 헷갈리지 않도록 **받은 알림을 읽는 곳**임을 이름에 담는다.
    // 아이콘도 같은 구분을 따른다: 받은 알림을 읽는 이 행은 빈 종(notifications-outline),
    // 설정 안의 "알림 설정"은 원 안의 종(notifications-circle-outline)이다.
    { id: "notifications", section: "settings", icon: "notifications-outline", title: "알림함", route: "/notifications" },
    { id: "settings", section: "settings", icon: "settings-outline", title: "설정", route: "/settings" },
    // 라우트가 없는 두 행: 내보내기는 같은 화면의 기간 선택 카드를 접었다 폈다 하고,
    // 앱 정보는 Alert만 띄운다. 그 동작은 화면이 id로 붙인다.
    // 내보내기가 "예산 · 데이터"에 있는 이유: 이 행이 여는 것은 설정 토글이 아니라 **지출
    // 데이터**의 기간 선택 카드다(설정 화면의 같은 항목과 한 벌 -- EXPORT_MENU_TITLE).
    { id: "export", section: "budgetData", icon: "share-outline", title: exportTitle, route: null },
    { id: "appInfo", section: "settings", icon: "information-circle-outline", title: "앱 정보", route: null }
  ];
}
