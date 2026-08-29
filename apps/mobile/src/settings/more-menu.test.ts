import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_LOCK_LOCK_NOW_A11Y_LABEL, APP_LOCK_LOCK_NOW_LABEL } from "../security/app-lock";
import {
  buildMoreSessionMenuRows,
  buildSupportMenuRows,
  MORE_MENU_SECTIONS,
  MORE_MENU_SETTINGS_ONLY_ROUTES,
  MORE_PROFILE_CARD_ROUTE,
  type MoreMenuRowSpec
} from "./more-menu";
import { SUPPORT_LINK_LABELS } from "./support-links";

const mobileRoot = join(process.cwd());
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
/**
 * 라운드 71 D(#4): 아이콘 **이름**이 실제 글리프인지 보려고 패키지가 함께 배포하는 글리프맵 JSON만
 * 읽는다(`@expo/vector-icons`를 import하면 react-native가 딸려 와 이 순수 스위트가 돌지 않는다 --
 * design-foundation.test.ts가 세운 그 관례).
 */
const ioniconsGlyphMap: Record<string, number> = createRequire(import.meta.url)(
  "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"
);

const rows = (): MoreMenuRowSpec[] => buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기" });

/**
 * 라운드 71 리뷰 M-3 — **이 스위트의 기본 환경은 "주입 없음"이다.**
 *
 * 도움 두 행(FAQ·지원)은 빌드에 주입된 env로 서고(`buildSupportMenuRows` — 호출 시점에 읽는다),
 * 이 파일의 오래된 단언 다수는 그 값이 **없다는 전제**로 쓰여 있다("더보기는 7행", "행 이름
 * 목록은 이 일곱", "아이콘이 겹치지 않는다"). 그래서 `.env`나 CI가 EXPO_PUBLIC_SUPPORT_URL·
 * EXPO_PUBLIC_FAQ_URL을 실제로 주입한 환경에서는 그 단언들이 **코드가 멀쩡한데도** 빨개졌다
 * (릴리즈 빌드 환경에서 도는 스위트가 바로 그런 환경이다).
 *
 * 그래서 매 테스트 앞에서 두 키를 지우고, 파일이 끝나면 원래 값을 돌려놓는다. 아래 라운드 71 D
 * describe는 자기 저장·복원을 그대로 갖고 있고 매 테스트에서 필요한 값을 **직접 세우므로**
 * 충돌하지 않는다(바깥 beforeEach → 안쪽 테스트의 setEnv 순서, 안쪽 afterEach → 바깥 afterAll).
 */
const originalSupportUrl = process.env.EXPO_PUBLIC_SUPPORT_URL;
const originalFaqUrl = process.env.EXPO_PUBLIC_FAQ_URL;

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_SUPPORT_URL;
  delete process.env.EXPO_PUBLIC_FAQ_URL;
});

afterAll(() => {
  if (originalSupportUrl === undefined) delete process.env.EXPO_PUBLIC_SUPPORT_URL;
  else process.env.EXPO_PUBLIC_SUPPORT_URL = originalSupportUrl;
  if (originalFaqUrl === undefined) delete process.env.EXPO_PUBLIC_FAQ_URL;
  else process.env.EXPO_PUBLIC_FAQ_URL = originalFaqUrl;
});

describe("라운드 41 UX-U(A) 더보기 세션 메뉴 구성", () => {
  it("아이 이름을 보여 주는 프로필 카드는 아이 관리 화면으로 보낸다", () => {
    expect(MORE_PROFILE_CARD_ROUTE).toBe("/settings/children");
  });

  it("가구 화면(/family)으로 가는 입구는 '가족 관리' 한 행뿐이다", () => {
    const familyRows = rows().filter((row) => row.route === "/family");
    expect(familyRows).toHaveLength(1);
    expect(familyRows[0].title).toBe("가족 관리");
    // 카드와 행이 같은 곳으로 가던 중복이 사라졌다: 카드 목적지는 /family가 아니다.
    expect(MORE_PROFILE_CARD_ROUTE).not.toBe("/family");
    // 예전 이름("프로필 관리")은 카드가 이미 쓰고 있어 행 이름으로 남기면 다시 헷갈린다.
    expect(rows().some((row) => row.title === "프로필 관리")).toBe(false);
  });

  it("받은 알림을 읽는 행은 '알림함'이라 설정 안의 '알림 설정'과 구분된다", () => {
    const notifications = rows().find((row) => row.id === "notifications");
    expect(notifications).toMatchObject({ title: "알림함", route: "/notifications" });
    expect(rows().some((row) => row.title === "알림")).toBe(false);
    expect(rows().some((row) => row.title === "알림 설정")).toBe(false);
  });

  it("자주 쓰는 아이 관리 · 예산 수정을 한 탭 깊이로 끌어올린다", () => {
    expect(rows().find((row) => row.id === "children")).toMatchObject({
      title: "아이 관리",
      route: "/settings/children"
    });
    expect(rows().find((row) => row.id === "budget")).toMatchObject({ title: "예산 수정", route: "/budget" });
  });

  it("설정과 중복되던 가져오기 · 약관 행은 세션 메뉴에서 빠진다(설정 화면에만 남는다)", () => {
    const routes = rows().map((row) => row.route);
    for (const removed of MORE_MENU_SETTINGS_ONLY_ROUTES) {
      expect(routes).not.toContain(removed);
    }
    // 두 행은 설정 화면(다른 트랙 소유)에 그대로 있어야 도달 가능성이 유지된다.
    const settingsSource = source("app/settings/index.tsx");
    for (const removed of MORE_MENU_SETTINGS_ONLY_ROUTES) {
      expect(settingsSource).toContain(`router.push("${removed}")`);
    }
  });

  it("행 수 총량은 그대로 7행이라 compact 기준(SET-001)이 흔들리지 않는다", () => {
    expect(rows()).toHaveLength(7);
    // /settings 진입점은 그대로 유지된다(NAV-121).
    expect(rows().some((row) => row.route === "/settings")).toBe(true);
  });

  it("라우트가 없는 행은 화면 안에서 처리하는 두 개(내보내기 · 앱 정보)뿐이다", () => {
    const routeless = rows().filter((row) => row.route === null);
    expect(routeless.map((row) => row.id)).toEqual(["export", "appInfo"]);
  });

  it("내보내기 행 제목은 공용 상수를 주입받아 설정 화면과 한 벌로 유지된다", () => {
    expect(buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기" }).find((row) => row.id === "export")?.title).toBe(
      "데이터 내보내기"
    );
    // 라운드 68 B(#6): 두 번째 인자(appLockEnabled)가 붙었다 -- 제목이 공용 상수에서 온다는
    // 이 계약 자체는 그대로다(그 게이트의 계약은 아래 "지금 잠그기 행" 묶음이 따로 진다).
    expect(source("app/(tabs)/more.tsx")).toContain(
      "buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE, appLockEnabled })"
    );
  });

  /**
   * DSN-053 P2-D: 승인 캡처("프로필")의 메뉴는 제목 붙은 그룹 박스 넷이다. 어떤 행이 어느
   * 구획인지는 **행 목록과 같은 자리**에서 정해진다 -- 화면이 id를 보고 다시 분류하면 행이
   * 하나 늘 때 두 곳이 갈리고, 그 순간 어느 구획에도 속하지 못한 행이 화면에서 사라진다.
   */
  describe("DSN-053 P2-D 4분할 구획", () => {
    it("구획은 캡처 순서대로 넷이다", () => {
      expect(MORE_MENU_SECTIONS.map((section) => section.key)).toEqual(["child", "family", "budgetData", "settings"]);
      expect(MORE_MENU_SECTIONS.map((section) => section.title)).toEqual(["아이 · 산모", "가족", "예산 · 데이터", "설정"]);
    });

    it("모든 행이 정확히 한 구획에 속하고, 빈 구획이 없다", () => {
      const sectionKeys = MORE_MENU_SECTIONS.map((section) => section.key);
      for (const row of rows()) {
        expect(sectionKeys, `${row.title}의 구획`).toContain(row.section);
      }
      for (const key of sectionKeys) {
        expect(rows().filter((row) => row.section === key).length, `${key} 구획`).toBeGreaterThan(0);
      }
    });

    it("행의 구획 배치가 목적지의 성격과 어긋나지 않는다", () => {
      const sectionOf = (id: MoreMenuRowSpec["id"]) => rows().find((row) => row.id === id)?.section;
      expect(sectionOf("children")).toBe("child");
      expect(sectionOf("family")).toBe("family");
      // 예산 수정과 지출 데이터 내보내기가 같은 구획이다(둘 다 가계 데이터).
      expect(sectionOf("budget")).toBe("budgetData");
      expect(sectionOf("export")).toBe("budgetData");
      // 알림함 · 설정 · 앱 정보는 앱 자체를 다루는 구획.
      expect(sectionOf("notifications")).toBe("settings");
      expect(sectionOf("settings")).toBe("settings");
      expect(sectionOf("appInfo")).toBe("settings");
    });

    it("구획을 넣어도 행 구성·순서·목적지는 그대로다(P2-D는 배치만 바꾼다)", () => {
      expect(rows().map((row) => row.title)).toEqual([
        "아이 관리",
        "가족 관리",
        "예산 수정",
        "알림함",
        "설정",
        "데이터 내보내기",
        "앱 정보"
      ]);
      expect(rows().map((row) => row.route)).toEqual([
        "/settings/children",
        "/family",
        "/budget",
        "/notifications",
        "/settings",
        null,
        null
      ]);
    });
  });

  it("모든 행에 제목과 아이콘이 있고 id가 겹치지 않는다", () => {
    const ids = rows().map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of rows()) {
      expect(row.title.trim().length).toBeGreaterThan(0);
      expect(row.icon.trim().length).toBeGreaterThan(0);
    }
  });
});

/**
 * SET-001 픽셀 락 캡처는 **비로그인 경로**로 찍힌다(app/pixel-lock.tsx가 세션을 지우고 이동).
 * 그래서 라운드 41 UX-U(A)는 세션 메뉴와 프로필 카드의 목적지만 바꾸고, 비로그인 렌더는 한
 * 글자도 건드리지 않았다. 그 불변 계약을 소스 그렙으로 못 박는다(react-native 화면은 vitest에서
 * 렌더할 수 없다 -- import-flow/export-flow 테스트와 같은 관례).
 *
 * D1 후속(실기기 APK 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음"): 사용자가 직접 요구한
 * 변경이라 **아이콘만** 탭바와 같은 Ionicons 이름으로 옮겼다. 지키는 요지는 그대로다 -- 행
 * **구성·순서·문구·목적지**와 비활성 내보내기 행 패턴(캡션 + onPress 없음)은 한 글자도 바뀌지
 * 않는다. (SET-001 기준 이미지는 아이콘 모양이 달라졌으므로 재캡처 대상이다.)
 */
describe("라운드 41 UX-U(A) 비로그인 미리보기 메뉴 불변 계약", () => {
  const moreSource = () => source("app/(tabs)/more.tsx");

  // 라운드 49 QA(P3-5): 첫 행의 아이콘만 people-outline으로 바뀌었다 -- 목적지가 가구
  // 화면(/family)이라 설정·세션 메뉴의 "가족 관리"와 같은 그림이어야 한다(같은 목적지 = 같은
  // 아이콘). 행 구성·순서·문구·목적지는 여전히 한 글자도 바뀌지 않는다.
  it("미리보기 행 목록(moreMenuRows)이 같은 세 행이고 아이콘만 Ionicons 이름이다", () => {
    expect(moreSource()).toContain(
      [
        "const moreMenuRows = [",
        '  { icon: "people-outline", title: "프로필 관리", route: "/family" },',
        '  { icon: "download-outline", title: "엑셀로 가져오기", route: "/import" },',
        '  { icon: "shield-checkmark-outline", title: "약관 및 개인정보", route: "/settings/privacy" }',
        "] as const satisfies readonly { icon: keyof typeof Ionicons.glyphMap; title: string; route: string }[];"
      ].join("\n")
    );
  });

  it("previewMenuRowActions의 구성(비활성 내보내기 행 + 앱 정보)이 그대로다", () => {
    const previewBlock = moreSource().slice(moreSource().indexOf("const previewMenuRowActions"));
    expect(previewBlock).toContain("...moreMenuRows.map((row) => ({");
    expect(previewBlock).toContain("      onPress: () => router.push(row.route)");
    expect(previewBlock).toContain(
      '{ icon: "share-outline", title: EXPORT_MENU_TITLE, caption: EXPORT_SIGNED_OUT_CAPTION, onPress: undefined },'
    );
    expect(previewBlock).toContain(
      '{ icon: "information-circle-outline", title: "앱 정보", onPress: () => Alert.alert("앱 정보", appInfoText) }'
    );
  });

  it("미리보기 행에 텍스트 글리프가 남아 있지 않다(탭바와 같은 Ionicons 계열)", () => {
    const src = moreSource();
    expect(src).toContain('import { Ionicons } from "@expo/vector-icons";');
    for (const glyph of ["♙", "⌁", "⇪", "ⓘ", "⌕"]) {
      expect(src, `more.tsx should not render ${glyph} as an icon`).not.toContain(`icon: "${glyph}"`);
      expect(src, `more.tsx should not render ${glyph} as an icon`).not.toContain(`>${glyph}<`);
    }
    // 셰브런(›)은 전역 관례라 그대로 두고, 장식이므로 접근성 트리에서 감춘 상태도 유지한다.
    expect(src).toContain("<Text accessible={false} style={moreMenuChevronStyle}>›</Text>");
  });

  it("미리보기 프로필 값과 카드 라벨 · 헤더 동작이 그대로다", () => {
    const src = moreSource();
    expect(src).toContain('const previewProfile = { nickname: "다온이", stageLabel: "24개월" };');
    expect(src).toContain("accessibilityLabel={`${visibleProfile.nickname} 프로필 관리`}");
    expect(src).toContain('router.push(hasSession ? "/(tabs)/records" : "/settings")');
    // 라운드 49 QA(P2-3): 미리보기(픽스처 프로필·비로그인 메뉴)에 닿는 조건이 `hasSession`의
    // 반대에서 **`!authToken`**으로 좁혀졌다. 비로그인 렌더는 그대로이고(토큰이 없으면 두 식의
    // 값이 같다), 토큰은 있는데 아이만 없는 창에서 "다온이 · 24개월"이 그려지던 것만 사라진다.
    expect(src).toContain("const visibleMenuRows = authToken ? sessionMenuRows : previewMenuRowActions;");
  });
});

/**
 * 라운드 68 트랙 B(GAP-068 #6) — **"지금 잠그기"가 홈에서 다섯 번째 탭**이었다.
 *
 * 그 버튼의 위협 모델은 "폰을 잠깐 건네주기 전에"(APP_LOCK_LOCK_NOW_HINT)인데, 닿는 길은
 * 홈 [더보기] → [설정] → [앱 잠금] → 잠금 설정 화면 → [지금 잠그기] 하나뿐이었다. 여기에 행
 * 하나를 두면 두 번이다. 잃는 것("7행 compact")을 잠금을 켜지 않은 계정에서 잃지 않는 것이
 * 이 계약의 요점이다.
 */
describe("라운드 68 B(#6) 더보기의 '지금 잠그기' 행", () => {
  const lockedRows = () => buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기", appLockEnabled: true });

  it("잠금이 꺼진 계정(기본값)의 더보기는 종전 7행 그대로다", () => {
    expect(rows()).toHaveLength(7);
    expect(rows().some((row) => row.id === "lockNow")).toBe(false);
    expect(buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기", appLockEnabled: false })).toEqual(rows());
  });

  it("잠금을 켠 계정에서만 8행이 되고, 늘어나는 것은 그 한 행뿐이다", () => {
    expect(lockedRows()).toHaveLength(8);
    const added = lockedRows().filter((row) => !rows().some((existing) => existing.id === row.id));
    expect(added.map((row) => row.id)).toEqual(["lockNow"]);
    // 종전 7행의 구성·순서·목적지는 한 글자도 바뀌지 않는다.
    expect(lockedRows().filter((row) => row.id !== "lockNow")).toEqual(rows());
  });

  it("라벨·낭독 문장은 이미 있는 상수 그대로다 (새 문구 0건)", () => {
    const lockRow = lockedRows().find((row) => row.id === "lockNow");
    expect(lockRow).toMatchObject({
      section: "settings",
      title: APP_LOCK_LOCK_NOW_LABEL,
      a11yLabel: APP_LOCK_LOCK_NOW_A11Y_LABEL,
      // 화면 안에서 처리하는 동작이라 라우트가 없다(새 화면 0건 — 오버레이가 전역이다).
      route: null
    });
    expect(APP_LOCK_LOCK_NOW_LABEL).toBe("지금 잠그기");
    // 기존 일곱 행은 낭독 문장을 따로 갖지 않는다(제목 낭독이 종전 그대로다).
    for (const row of rows()) expect(row.a11yLabel).toBeUndefined();
  });

  it("잠금 설정 화면과 **같은 액션 하나**에 이어져 있고, 게이트는 켜짐 여부다", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE, appLockEnabled })");
    expect(moreSource).toContain("const appLockEnabled = Boolean(appLockRecord?.enabled);");
    expect(moreSource).toContain("() => useAppLockStore.getState().lockNow()");
    // 낭독 문장이 실제로 그 행에 걸린다(a11y 계약은 문구를 다시 단언하지 않고 자리만 본다).
    expect(moreSource).toContain("accessibilityLabel={a11yLabel ?? (caption ? `${title}, ${caption}` : title)}");
    expect(moreSource).toContain("a11yLabel={row.a11yLabel}");
    // 앱 잠금의 판정·저장소 코드는 한 줄도 바뀌지 않는다 -- 이 화면은 읽고 부르기만 한다.
    expect(moreSource).not.toContain("writeAppLockRecord");
    expect(moreSource).not.toContain("verifyPin");
  });

  it("SET-001 비로그인 미리보기 행은 이 행을 모른다(캡처 불변)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    const previewBlock = moreSource.slice(
      moreSource.indexOf("const previewMenuRowActions"),
      moreSource.indexOf("const visibleMenuRows")
    );
    expect(previewBlock).not.toContain("lockNow");
    expect(previewBlock).not.toContain("a11yLabel:");
    // 미리보기 행은 세션 메뉴가 아니라 화면의 상수 목록에서 온다(이 모듈은 세션 메뉴만 만든다).
    expect(previewBlock).toContain("...moreMenuRows.map((row) => ({");
  });
});

/**
 * 라운드 71 트랙 D(GAP-071 #4) — **도움(지원·FAQ)으로 가는 두 행.**
 *
 * 형식은 라운드 68 B의 "지금 잠그기"와 같은 조건부 행이고, 게이트만 다르다: 계정 상태가 아니라
 * **빌드에 주입된 URL**이다. 지키는 것은 하나다 — 값이 없으면 행 자체가 없어야 하고(정직한
 * 감춤), 그때 더보기는 종전 7행과 **한 글자도 다르지 않아야** 한다.
 */
describe("라운드 71 D(#4) 도움으로 가는 두 행", () => {
  const originalSupport = process.env.EXPO_PUBLIC_SUPPORT_URL;
  const originalFaq = process.env.EXPO_PUBLIC_FAQ_URL;

  function setEnv(key: "EXPO_PUBLIC_SUPPORT_URL" | "EXPO_PUBLIC_FAQ_URL", value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  function injectBoth() {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", "https://wooriai.example.com/support.html");
    setEnv("EXPO_PUBLIC_FAQ_URL", "https://wooriai.example.com/faq.html");
  }

  afterEach(() => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", originalSupport);
    setEnv("EXPO_PUBLIC_FAQ_URL", originalFaq);
  });

  it("주입된 값이 없으면 행이 서지 않는다 — 더보기는 종전 7행 그대로다", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", undefined);
    setEnv("EXPO_PUBLIC_FAQ_URL", undefined);
    expect(buildSupportMenuRows()).toEqual([]);
    expect(rows()).toHaveLength(7);
    expect(rows().some((row) => row.id === "support" || row.id === "faq")).toBe(false);
    // 행이 아예 없으므로 화면이 여는 주소도 없다(죽은 링크 0건).
    expect(rows().some((row) => row.externalUrl !== undefined)).toBe(false);
  });

  it("한 키만 주입되면 그 행 하나만 선다", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", undefined);
    setEnv("EXPO_PUBLIC_FAQ_URL", "https://wooriai.example.com/faq.html");
    expect(buildSupportMenuRows().map((row) => row.id)).toEqual(["faq"]);
    setEnv("EXPO_PUBLIC_SUPPORT_URL", "https://wooriai.example.com/support.html");
    setEnv("EXPO_PUBLIC_FAQ_URL", undefined);
    expect(buildSupportMenuRows().map((row) => row.id)).toEqual(["support"]);
  });

  it("둘 다 주입되면 두 행이 늘고, 종전 행은 한 글자도 바뀌지 않는다", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", undefined);
    setEnv("EXPO_PUBLIC_FAQ_URL", undefined);
    const before = rows();
    injectBoth();
    const after = rows();
    expect(after).toHaveLength(before.length + 2);
    // 스스로 찾아보는 쪽(FAQ)이 먼저고, 사람에게 묻는 쪽(지원)이 뒤다.
    const added = after.filter((row) => !before.some((existing) => existing.id === row.id));
    expect(added.map((row) => row.id)).toEqual(["faq", "support"]);
    expect(after.filter((row) => !added.some((row2) => row2.id === row.id))).toEqual(before);
  });

  it("행 이름은 단일 소스(SUPPORT_LINK_LABELS)에서 오고, 앱 안 라우트가 아니라 주소를 갖는다", () => {
    injectBoth();
    for (const kind of ["faq", "support"] as const) {
      const row = buildSupportMenuRows().find((candidate) => candidate.id === kind);
      expect(row).toMatchObject({
        section: "settings",
        title: SUPPORT_LINK_LABELS[kind].title,
        subtitle: SUPPORT_LINK_LABELS[kind].subtitle
      });
      expect(row?.url.startsWith("https://")).toBe(true);
      // 세션 메뉴 쪽에서도 라우트가 아니라 externalUrl이다(인앱 라우팅 0건).
      const menuRow = rows().find((candidate) => candidate.id === kind);
      expect(menuRow?.route).toBeNull();
      expect(menuRow?.externalUrl).toBe(row?.url);
    }
  });

  it("아이콘은 실제 Ionicons outlined 이름이고 다른 행과 겹치지 않는다", () => {
    injectBoth();
    for (const row of buildSupportMenuRows()) {
      expect(row.icon in ioniconsGlyphMap, `${row.title}: ${row.icon}`).toBe(true);
      expect(row.icon.endsWith("-outline"), `${row.title}: ${row.icon}`).toBe(true);
    }
    const icons = rows().map((row) => row.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("⚠️ SET-001 비로그인 미리보기 행은 이 두 행을 모른다(캡처 불변)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    const previewBlock = moreSource.slice(
      moreSource.indexOf("const previewMenuRowActions"),
      moreSource.indexOf("const visibleMenuRows")
    );
    expect(previewBlock).not.toContain("support");
    expect(previewBlock).not.toContain("faq");
    expect(previewBlock).not.toContain("externalUrl");
    // 미리보기 행 목록 자체도 종전 세 행 그대로다(위 불변 계약과 같은 자리를 다시 본다).
    expect(moreSource).toContain('{ icon: "download-outline", title: "엑셀로 가져오기", route: "/import" },');
  });

  it("앱 정보 Alert의 버전 문자열은 무변경이다(UX-5B-7)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain(
      'const appInfoText = `버전 ${Constants.expoConfig?.version ?? "알 수 없음"}`;'
    );
    expect(moreSource).toContain('() => Alert.alert("앱 정보", appInfoText)');
  });
});
