import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMoreSessionMenuRows,
  MORE_MENU_SETTINGS_ONLY_ROUTES,
  MORE_PROFILE_CARD_ROUTE,
  type MoreMenuRowSpec
} from "./more-menu";

const mobileRoot = join(process.cwd());
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const rows = (): MoreMenuRowSpec[] => buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기" });

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
    expect(source("app/(tabs)/more.tsx")).toContain("buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE })");
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

  it("미리보기 행 목록(moreMenuRows)이 같은 세 행이고 아이콘만 Ionicons 이름이다", () => {
    expect(moreSource()).toContain(
      [
        "const moreMenuRows = [",
        '  { icon: "person-circle-outline", title: "프로필 관리", route: "/family" },',
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
    expect(src).toContain("const visibleMenuRows = hasSession ? sessionMenuRows : previewMenuRowActions;");
  });
});
