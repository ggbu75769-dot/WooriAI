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
// 라운드 68 트랙 B(#6): 잠금 행의 라벨·낭독 문장은 **이미 있는 셋**을 그대로 쓴다(새 문구 0건).
// 내보내기 제목만 주입받는 이유는 그 단일 소스가 화면 컴포넌트 파일이기 때문이고, 앱 잠금 문구는
// 순수 모듈이라 여기서 곧장 읽어도 이 모듈이 vitest에서 그대로 돈다.
import { APP_LOCK_LOCK_NOW_A11Y_LABEL, APP_LOCK_LOCK_NOW_LABEL } from "../security/app-lock";
// 라운드 71 트랙 D(#4): 지원·FAQ 행의 **존재 여부**(주입된 URL)와 라벨은 그 순수 모듈이 정한다.
// 이 파일은 여전히 vitest에서 도는 순수 모듈이다(support-links.ts도 react-native를 모른다).
import { SUPPORT_LINK_LABELS, supportLinkUrls, type SupportLinkKind } from "./support-links";

/** 세션 메뉴 행의 식별자 — 테스트와 화면이 순서/구성을 말할 때 쓰는 안정된 이름이다. */
export type MoreMenuRowId =
  | "children"
  | "family"
  | "budget"
  | "notifications"
  | "settings"
  | "lockNow"
  | "faq"
  | "support"
  | "export"
  | "appInfo";

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
   * 라운드 68 트랙 B(#6): 스크린리더가 읽을 문장이 보이는 제목과 **달라야 할 때만** 채운다.
   * 없으면 화면은 종전대로 제목(과 캡션)을 읽어 준다 — 기존 일곱 행은 이 값이 없어 낭독이
   * 한 글자도 바뀌지 않는다.
   */
  a11yLabel?: string;
  /**
   * 이동할 라우트. 화면 안에서 처리하는 행(내보내기 카드 토글 · 앱 정보 Alert · 지금 잠그기)은
   * `null`이고, 그 행의 동작은 화면이 id로 붙인다 — 라우팅이 아닌 동작을 이 모듈이 알 필요가 없다.
   */
  route: string | null;
  /**
   * 라운드 71 트랙 D(#4): **앱 밖 브라우저**로 여는 주소(지원·FAQ 행). 앱 안 라우트가 아니므로
   * `route`는 null이고, 화면은 이 값이 있으면 `Linking.openURL` 하나로 연다(인앱 웹뷰 0건).
   * 값은 주입된 env에서만 오므로 이 필드를 가진 행은 **그 빌드에만** 존재한다.
   */
  externalUrl?: string;
};

/**
 * 라운드 71 트랙 D(GAP-071 #4) — 도움(지원·FAQ)으로 가는 행의 **단일 소스**.
 *
 * 더보기 탭과 설정 화면이 **같은 표**를 읽는다(EXPORT_MENU_TITLE·RECURRING_MANAGE_LABEL이 세운
 * 그 관례). 더보기는 제목만, 설정 화면은 부제까지 그린다.
 */
export type SupportMenuRowSpec = {
  id: SupportLinkKind;
  section: MoreMenuSection;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** 설정 화면 행의 부제(더보기 행 문법에는 부제 자리가 없다). */
  subtitle: string;
  /** 정규화를 통과한 주소만 온다 — 이 값이 없는 종류는 아래에서 행 자체가 만들어지지 않는다. */
  url: string;
};

/**
 * 표시 순서: 스스로 찾아보는 쪽(FAQ)이 먼저고, 사람에게 묻는 쪽(지원)이 뒤다.
 * 아이콘은 다른 행과 같은 Ionicons outlined 계열이다(D1 후속의 그 규칙).
 */
const SUPPORT_MENU_ROW_ORDER: ReadonlyArray<{ kind: SupportLinkKind; icon: keyof typeof Ionicons.glyphMap }> = [
  { kind: "faq", icon: "help-circle-outline" },
  { kind: "support", icon: "chatbubble-ellipses-outline" }
];

/**
 * 주입된 URL이 있는 종류만 행이 된다. **없으면 빈 배열**이라 두 화면 모두 종전과 한 글자도
 * 다르지 않다(정직한 감춤 — src/settings/support-links.ts의 머리말).
 */
export function buildSupportMenuRows(): SupportMenuRowSpec[] {
  const urls = supportLinkUrls();
  return SUPPORT_MENU_ROW_ORDER.flatMap(({ kind, icon }) => {
    const url = urls[kind];
    if (!url) return [];
    return [
      {
        id: kind,
        // 앱 자체를 다루는 구획이다(알림함 · 설정 · 앱 정보와 같은 자리).
        section: "settings" as const,
        icon,
        title: SUPPORT_LINK_LABELS[kind].title,
        subtitle: SUPPORT_LINK_LABELS[kind].subtitle,
        url
      }
    ];
  });
}

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
 * @param appLockEnabled 이 계정에서 앱 잠금이 **켜져 있는가**(GAP-068 #6). 켜지 않은 절대다수
 *   계정은 종전 7행 그대로다 — 아래 조건부 행 주석 참고.
 *
 * 라운드 71 트랙 D(#4)의 지원·FAQ 행은 파라미터가 아니라 **빌드에 주입된 URL**에서 온다
 * (`buildSupportMenuRows` — 호출 시점에 env를 읽는다). 주입 전에는 빈 배열이라 이 목록이
 * 종전과 완전히 같다.
 */
export function buildMoreSessionMenuRows({
  exportTitle,
  appLockEnabled = false
}: {
  exportTitle: string;
  appLockEnabled?: boolean;
}): MoreMenuRowSpec[] {
  return [
    { id: "children", section: "child", icon: "person-circle-outline", title: "아이 관리", route: "/settings/children" },
    { id: "family", section: "family", icon: "people-outline", title: "가족 관리", route: "/family" },
    { id: "budget", section: "budgetData", icon: "wallet-outline", title: "예산 수정", route: "/budget" },
    // "알림 설정"(설정 → 푸시 수신 관리)과 헷갈리지 않도록 **받은 알림을 읽는 곳**임을 이름에 담는다.
    // 아이콘도 같은 구분을 따른다: 받은 알림을 읽는 이 행은 빈 종(notifications-outline),
    // 설정 안의 "알림 설정"은 원 안의 종(notifications-circle-outline)이다.
    { id: "notifications", section: "settings", icon: "notifications-outline", title: "알림함", route: "/notifications" },
    { id: "settings", section: "settings", icon: "settings-outline", title: "설정", route: "/settings" },
    /**
     * 라운드 68 트랙 B(GAP-068 #6) — **"지금 잠그기"가 홈에서 다섯 번째 탭**이었다.
     *
     * 그 버튼의 위협 모델은 문장으로 못박혀 있다(`APP_LOCK_LOCK_NOW_HINT`: "폰을 잠깐 건네주기
     * 전에 눌러요."). 그런데 닿는 길은 하나뿐이었다 — 홈 [더보기] → [설정] → [앱 잠금] → 잠금
     * 설정 화면 → [지금 잠그기]. 폰을 건네는 그 3초에 다섯 번을 누를 사람은 없고, 그러면 이
     * 잠금이 막기로 한 **유일한 상황**이 그대로 일어난다. 여기에 행을 하나 두면 두 번이다.
     *
     * **조건부 행인 이유**: 더보기의 "7행 고정"은 픽셀락이 아니라 레이아웃 근거다(SET-001 캡처는
     * 비로그인 경로이고 이 모듈은 세션 메뉴만 만든다 — 이 파일 머리말). 잃는 것은 "한 화면에
     * 들어오는 compact" 근거뿐이므로, 잠금을 켜지 않은 절대다수 계정은 **종전 7행 그대로** 두고
     * 켠 계정에서만 8행이 된다. 홈 퀵액션(HOME-001 캡처)에는 세우지 않는다 — 그쪽은 승인 디자인
     * 변경이라 변경 요청이 선행이다.
     *
     * 새 화면 0건·새 문구 0건이고, 동작은 스토어 액션 하나다(`lockNow()` — 오버레이가 전역이라
     * 화면을 옮기지 않는다). 이 행이 늘어난다고 잠금이 더 많은 것을 막게 되는 것은 아니므로
     * 문구는 커지지 않는다(수용 기준 11).
     */
    ...(appLockEnabled
      ? [
          {
            id: "lockNow" as const,
            section: "settings" as const,
            icon: "lock-closed-outline" as const,
            title: APP_LOCK_LOCK_NOW_LABEL,
            a11yLabel: APP_LOCK_LOCK_NOW_A11Y_LABEL,
            route: null
          }
        ]
      : []),
    /**
     * 라운드 71 트랙 D(GAP-071 #4) — **도움으로 가는 길**. 위 "지금 잠그기"와 같은 조건부 행
     * 형식이고, 게이트는 계정 상태가 아니라 **빌드에 주입된 URL**이다: 값이 없으면 행이 서지
     * 않으므로 더보기는 종전 7행 그대로다(죽은 링크도, 지어낸 이메일도 생기지 않는다).
     *
     * ⚠️ SET-001 픽셀락 캡처는 **비로그인 미리보기 행 목록**을 그린다(app/(tabs)/more.tsx의
     * `previewMenuRowActions` — 이 모듈이 손대지 않는 그 목록). 새 행은 여기 **세션 메뉴에만**
     * 더한다.
     */
    ...buildSupportMenuRows().map((row) => ({
      id: row.id,
      section: row.section,
      icon: row.icon,
      title: row.title,
      // 앱 안 라우트가 아니라 브라우저다 — 화면은 externalUrl을 Linking.openURL 하나로 연다.
      route: null,
      externalUrl: row.url
    })),
    // 라우트가 없는 두 행: 내보내기는 같은 화면의 기간 선택 카드를 접었다 폈다 하고,
    // 앱 정보는 Alert만 띄운다. 그 동작은 화면이 id로 붙인다.
    // 내보내기가 "예산 · 데이터"에 있는 이유: 이 행이 여는 것은 설정 토글이 아니라 **지출
    // 데이터**의 기간 선택 카드다(설정 화면의 같은 항목과 한 벌 -- EXPORT_MENU_TITLE).
    { id: "export", section: "budgetData", icon: "share-outline", title: exportTitle, route: null },
    { id: "appInfo", section: "settings", icon: "information-circle-outline", title: "앱 정보", route: null }
  ];
}
