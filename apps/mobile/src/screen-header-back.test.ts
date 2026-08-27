import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX-Q(C): 나가는 길 계약.
 *
 * 앱은 전역 `headerShown: false`라 스택 화면에 OS 헤더가 없고, ScreenHeader에도 되돌아가는
 * 슬롯이 없었다. 이 파일은 두 가지를 고정한다.
 *
 *  a) ScreenHeader의 `onBack`은 **옵셔널**이며, 넘기지 않으면 뒤로가기 노드를 아예 만들지 않는다
 *     (픽셀락 HOME/EXP/ITEM/REP/FAM/IMP/SET 캡처가 지나가는 화면들이 예전 트리를 그대로 유지).
 *  b) 스택으로만 도달하는 화면들은 실제로 `onBack`을 배선한다.
 *
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 소스 grep 관례를 따른다
 * (ui-pixel-lock-flow.test.ts 참고).
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const screenHeaderBlock = () => {
  const uiSource = source("src/ui.tsx");
  return uiSource.slice(uiSource.indexOf("export function ScreenHeader"), uiSource.indexOf("export function Card"));
};

// 라운드 39 I-8: 남아 있던 두 곳도 배선했다 -- app/notifications.tsx(UX-O에서 이미 배선됐는데
// 이 목록·주석만 낡아 있었다)와 app/budget.tsx(알림 → 예산 직행이 가장 갇히기 쉬운 경로였다).
// 스택으로만 도달하는 화면 중 나가는 길이 없는 곳은 이제 없다.
const backWiredScreens = [
  "app/settings/index.tsx",
  "app/settings/children.tsx",
  "app/settings/notifications.tsx",
  "app/settings/privacy.tsx",
  "app/expenses/[expenseId].tsx",
  "app/family/invite.tsx",
  "app/import/[importJobId].tsx",
  "app/notifications.tsx",
  "app/budget.tsx"
] as const;

describe("UX-Q(C) ScreenHeader 뒤로가기 슬롯", () => {
  it("onBack은 옵셔널이고, 지정 시 가족 화면의 ‹ · 44dp · \"뒤로가기\" 관례를 재사용한다", () => {
    const block = screenHeaderBlock();
    expect(block).toContain("onBack?: () => void");
    expect(block).toContain('accessibilityLabel="뒤로가기"');
    expect(block).toContain('accessibilityRole="button"');
    expect(block).toContain("onPress={onBack}");
    expect(block).toContain("‹");
  });

  it("미지정 시 Pressable 자체를 렌더하지 않는다 (픽셀락 캡처 불변)", () => {
    const block = screenHeaderBlock();
    // 조건부 렌더여야 한다 -- 비활성/투명 Pressable을 항상 그려 두면 레이아웃이 달라진다.
    expect(block).toContain("{onBack ? (");
    expect(block).toContain(") : null}");
    // 항상 렌더한 뒤 숨기는 우회로(가시성 토글·pointerEvents)를 금지한다.
    expect(block).not.toContain('pointerEvents="none"');
    expect(block).not.toContain("opacity: onBack");
    expect(block).not.toContain("display: onBack");
  });

  it("터치 타깃은 44dp(theme.touchTarget)를 쓴다 — 새 치수를 만들지 않는다", async () => {
    const uiSource = source("src/ui.tsx");
    const { theme } = await import("./theme");
    expect(uiSource).toContain("height: theme.touchTarget");
    expect(uiSource).toContain("width: theme.touchTarget");
    expect(theme.touchTarget).toBe(44);
  });

  it("onBack을 넘기지 않는 화면은 ScreenHeader 호출부가 그대로다", () => {
    // 픽셀락 대상 중 ScreenHeader를 쓰는 화면들. 여기에 onBack이 붙으면 캡처가 깨진다.
    for (const relativePath of ["app/(tabs)/records.tsx", "app/(tabs)/index.tsx"]) {
      const screenSource = source(relativePath);
      const headerIndex = screenSource.indexOf("<ScreenHeader");
      if (headerIndex < 0) continue;
      const headerBlock = screenSource.slice(headerIndex, screenSource.indexOf("/>", headerIndex) + 2);
      expect(headerBlock).not.toContain("onBack");
    }
  });
});

describe("UX-Q(C) 스택 화면 9곳에 나가는 길이 있다 (라운드 39 I-8: 잔여 0곳)", () => {
  for (const relativePath of backWiredScreens) {
    it(`${relativePath}의 ScreenHeader가 router.back()을 배선한다`, () => {
      const screenSource = source(relativePath);
      expect(screenSource).toContain("onBack={() => router.back()}");
      expect(screenSource).toContain('from "expo-router"');
    });
  }
});
