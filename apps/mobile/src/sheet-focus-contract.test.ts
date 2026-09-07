import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHILD_SWITCH_SHEET_TITLE } from "./children/child-switch";
import { customItemSheetCopy } from "./items/custom-item-form";
import { MONTH_JUMP_SHEET_TITLE } from "./month-jump";

/**
 * 시트 봉인·포커스 계약 (A11Y — 모달 문법).
 *
 * ## 왜 이 파일이 태어났나
 *
 * 저장소에는 **시트 껍데기가 두 벌** 있었다.
 *
 *  ⓐ `src/design-system/components/ModV1Primitives.tsx`의 `BottomSheet` — `<Modal>` · `onShow`
 *    제목 포커스 · `returnFocusRef` 복귀 · `accessibilityViewIsModal`까지 **정확히 옳은 일을**
 *    한다. 그런데 제품 소스의 호출부가 **0건**이다(아래 ⓐ절이 그 0을 소스 전수로 다시 센다).
 *  ⓑ `src/ui.tsx`의 `BottomSheetFrame` — **앱이 실제로 그리는 시트 전부**가 이것이고, 종전
 *    그냥 `<View>`였다: 봉인 0 · 열림 포커스 0 · 닫힘 복귀 0.
 *
 * 사용자에게 그것은 이렇게 보였다: "8월"을 눌러 달 선택 시트를 열면 아무 소리도 나지 않고
 * 포커스는 눌렀던 버튼에 남아, 화면 뒤 목록 전체를 스와이프로 훑고서야 시트에 닿는다.
 *
 * 그래서 **옳은 일을 하는 쪽의 헬퍼를 살아 있는 쪽에 붙였다** — 새로 짓지 않고
 * `focusAccessibilityTarget` 한 벌을 두 파일이 나눠 쓴다.
 *
 * ## 이 계약이 소스 문자열로 서는 이유
 *
 * 두 파일 다 `react-native`를 import하므로 이 repo의 vitest에서는 렌더할 수 없다
 * (`ui-pixel-lock-flow.test.ts` · `design-system-restore.test.ts`와 같은 사정). 값으로 확인할
 * 수 있는 것(시트 제목 셋)은 **런타임으로** 단언하고, 나머지는 소스 문자열로 고정한다.
 */

const mobileRoot = process.cwd();

function source(relativePath: string): string {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

/** 주석 안의 이름은 호출부가 아니다 — 줄 수를 지키며 지운다(`//` 뒤의 `://`는 남긴다). */
function maskComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, prefix: string) => prefix + " ".repeat(match.length - prefix.length));
}

function productSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (relativeDir: string) => {
    for (const entry of readdirSync(join(mobileRoot, relativeDir), { withFileTypes: true })) {
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(relativePath);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.(test|spec)\.tsx?$/.test(entry.name)) continue;
      found.push(relativePath);
    }
  };
  walk("app");
  walk("src");
  return found.sort();
}

/** JSX 마운트 자리 전수 — `<Foo>` · `<Foo ` · `<Foo/>`만 세고 `<FooBar`는 세지 않는다. */
function jsxMountSites(componentName: string): string[] {
  const pattern = new RegExp(`<${componentName}[\\s/>]`, "g");
  const sites: string[] = [];
  for (const file of productSourceFiles()) {
    const matches = maskComments(source(file)).match(pattern);
    if (matches) for (let index = 0; index < matches.length; index += 1) sites.push(file);
  }
  return sites;
}

/** `<Foo … >`의 여는 태그 하나(중첩 `{}`를 지나 자기 짝 `>`까지). */
function openTag(fileSource: string, componentName: string): string {
  const start = fileSource.indexOf(`<${componentName}`);
  expect(start, `${componentName} 여는 태그`).toBeGreaterThan(-1);
  let depth = 0;
  for (let index = start; index < fileSource.length; index += 1) {
    const char = fileSource[index];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return fileSource.slice(start, index + 1);
  }
  throw new Error(`${componentName}의 여는 태그가 닫히지 않았어요`);
}

const uiSource = source("src/ui.tsx");
const modV1Source = source("src/design-system/components/ModV1Primitives.tsx");
/** `BottomSheetFrame` 한 벌 — 다음 export가 시작되기 전까지. */
/**
 * 양끝 존재 가드. 어느 앵커가 사라지면 자르기가 조용히 엉뚱한 구간을 내놓고, 이 구간 위의
 * 부정 단언(`.not.toContain("<Modal")` 등)이 **공짜로 초록**이 된다. 그래서 무엇이 없어졌는지
 * 이름으로 먼저 말한다.
 *
 * ⚠️ 모듈 최상위에서 `const … = <소스>.slice(…)` 꼴로 두지 않는 이유: vitest는 테스트 밖의
 * `expect`를 허락하지 않아 그 자리에는 `toBeGreaterThan` 가드를 세울 수 없고, 그래서
 * `packages/test-utils`의 자르기 가드 대장이 그 모양을 "가드 없는 자리"로 센다(그 대장의
 * 머리말이 그 사정을 값으로 적어 두었다). 함수 안에서 자르고 던지면 실재 확인은 그대로 서고
 * 그 모양도 서지 않는다.
 */
function frameBlockOf(): string {
  const start = uiSource.indexOf("export function BottomSheetFrame");
  const end = uiSource.indexOf("export function SheetMountTransition");
  if (start < 0 || end <= start) {
    throw new Error(`BottomSheetFrame 구간 앵커를 ui.tsx에서 찾지 못했다(start=${start}, end=${end})`);
  }
  return uiSource.slice(start, end);
}
const frameBlock = frameBlockOf();

describe("ⓐ 사실 재확인 — 옳은 시트는 죽어 있고, 살아 있는 시트가 껍데기다", () => {
  it("`BottomSheet`(design-system)의 제품 호출부는 오늘도 0건이다", () => {
    // 손 목록이 아니라 소스 전수에서 센다 — 내일 누가 채택하면 여기가 먼저 빨개진다.
    expect(jsxMountSites("BottomSheet")).toEqual([]);
    // 그런데 그 컴포넌트는 **지우지 않았다**(처분 판단은 아래 ⓔ절).
    expect(modV1Source).toContain("export function BottomSheet({");
    expect(modV1Source).toContain("accessibilityViewIsModal");
  });

  it("`BottomSheetFrame`이 시트 껍데기의 유일한 한 벌이다 — JSX 넷 · 화면 마운트 열넷", () => {
    expect(jsxMountSites("BottomSheetFrame")).toEqual([
      "app/expenses/new.tsx",
      "src/MonthJumpSheet.tsx",
      "src/children/ChildSwitchSheet.tsx",
      "src/items/CustomItemSheet.tsx"
    ]);

    // 그 넷이 화면에 서는 자리 전수. 달 점프 시트는 화면 셋이 직접 열고, 날짜 픽커 넷이 자기
    // 안에서 한 벌씩 더 연다(픽커는 시트를 두 벌로 짓지 않고 그 시트를 그대로 소비한다).
    const childSwitchMounts = jsxMountSites("ChildSwitchSheet");
    const monthJumpMounts = jsxMountSites("MonthJumpSheet");
    const datePickerMounts = jsxMountSites("ExpenseDatePicker");
    const customItemMounts = jsxMountSites("CustomItemSheet");
    const directFrameMounts = jsxMountSites("BottomSheetFrame").filter((file) => file.startsWith("app/"));

    expect(childSwitchMounts.length, "아이 전환").toBe(4);
    expect(monthJumpMounts.filter((file) => file !== "src/expenses/ExpenseDatePicker.tsx").length, "달 점프 직접").toBe(3);
    expect(datePickerMounts.length, "날짜 픽커(각자 달 점프 시트 한 벌)").toBe(4);
    expect(customItemMounts.length, "커스텀 품목").toBe(2);
    expect(directFrameMounts, "화면이 직접 여는 프레임").toEqual(["app/expenses/new.tsx"]);

    expect(
      childSwitchMounts.length +
        monthJumpMounts.filter((file) => file !== "src/expenses/ExpenseDatePicker.tsx").length +
        datePickerMounts.length +
        customItemMounts.length +
        directFrameMounts.length,
      "이 한 곳을 고치면 함께 닫히는 자리 수"
    ).toBe(14);
  });

  it("구매 확인 카드는 시트가 아니다 — 이 계약의 모집단 밖이다", () => {
    // 정찰 메모가 시트 열넷 중 하나로 세었던 자리인데, 소스는 전역 오버레이 위의 `<Card>`다:
    // 시트 껍데기를 지나가지 않으므로 봉인·포커스의 대상이 아니고, 열넷은 그것 없이 채워진다.
    const followup = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(followup).not.toContain("BottomSheetFrame");
    expect(followup).toContain("<Card ");
  });
});

describe("ⓑ 봉인 — 제목이 있는 프레임만 a11y 모달이 된다", () => {
  it("프레임의 뿌리 View가 `accessibilityViewIsModal`을 진다", () => {
    expect(frameBlock).toContain("accessibilityViewIsModal={sealsBackground}");
    expect(frameBlock).toContain("const sealsBackground = Boolean(title);");
  });

  it("살아 있는 시트 셋은 비어 있지 않은 제목을 넘긴다 — 그래서 봉인이 선다", () => {
    // 문자열 자체는 순수 모듈에서 **값으로** 읽는다(테스트에 제목을 다시 적지 않는다).
    expect(CHILD_SWITCH_SHEET_TITLE.length).toBeGreaterThan(0);
    expect(MONTH_JUMP_SHEET_TITLE.length).toBeGreaterThan(0);
    expect(customItemSheetCopy("create").title.length).toBeGreaterThan(0);
    expect(customItemSheetCopy("edit").title.length).toBeGreaterThan(0);

    expect(openTag(source("src/children/ChildSwitchSheet.tsx"), "BottomSheetFrame")).toContain(
      "title={CHILD_SWITCH_SHEET_TITLE}"
    );
    expect(openTag(source("src/MonthJumpSheet.tsx"), "BottomSheetFrame")).toContain("title={MONTH_JUMP_SHEET_TITLE}");
    expect(openTag(source("src/items/CustomItemSheet.tsx"), "BottomSheetFrame")).toContain("title={copy.title}");
  });

  it("⚠️ EXP-001의 제목 없는 프레임은 봉인되지 않는다 — 저장 버튼이 그 프레임 **밖**에 있다", () => {
    const entrySource = source("app/expenses/new.tsx");
    // 이 자리는 시트가 아니라 빠른 지출 기록 화면의 본문 껍데기다(제목을 빈 문자열로 넘긴다).
    expect(openTag(entrySource, "BottomSheetFrame")).toContain('title=""');
    // 그리고 하단 고정 요약바(금액·저장)는 그 프레임을 닫은 **뒤에** 선다 — 본문을 a11y 모달로
    // 선언하면 저장이 낭독에서 사라질 수 있고, 그것은 핵심 루프를 끊는다.
    const frameClose = entrySource.indexOf("</BottomSheetFrame>");
    expect(frameClose).toBeGreaterThan(-1);
    expect(entrySource.slice(frameClose), "요약바가 프레임 밖에 있다").toContain("지출 금액 입력");
    expect(entrySource.slice(0, frameClose), "요약바가 프레임 안에 있으면 안 된다").not.toContain("지출 금액 입력");
  });
});

describe("ⓒ 열림 포커스와 닫힘 복귀 — 헬퍼는 새로 짓지 않고 나눠 쓴다", () => {
  it("열림: 제목 노드로 낭독 포커스를 옮긴다", () => {
    expect(frameBlock).toContain("const titleRef = useRef<Text>(null);");
    expect(frameBlock).toContain("focusAccessibilityTarget(titleRef)");
    expect(frameBlock).toContain("<Text ref={titleRef}");
  });

  it("닫힘: `returnFocusRef`가 있으면 그 자리로 돌아간다", () => {
    expect(frameBlock).toContain("if (returnFocusRef) focusAccessibilityTarget(returnFocusRef);");
    // 정리 함수가 실제로 effect의 반환값이다(마운트 때 도는 코드가 아니다).
    expect(frameBlock).toContain("return () => {");
  });

  it("헬퍼는 한 벌이다 — ui.tsx는 사본을 짓지 않고 design-system의 그것을 부른다", () => {
    expect(uiSource).toContain(
      'import { focusAccessibilityTarget } from "./design-system/components/ModV1Primitives";'
    );
    // 사본 금지: 포커스 이동의 두 원재료가 ui.tsx에는 없다.
    expect(uiSource).not.toContain("findNodeHandle");
    expect(uiSource).not.toContain("setAccessibilityFocus");
    // 원본은 여전히 한 자리에서만 선언된다(정의 하나 + 재수출 한 줄).
    expect(modV1Source.match(/function focusAccessibilityTarget\(/g)).toHaveLength(1);
    expect(modV1Source).toContain("export { focusAccessibilityTarget };");
  });

  it("훅은 조기 반환보다 위에 선다(FIX-A) — 프레임에는 조기 반환 자체가 없다", () => {
    const bodyStart = frameBlock.indexOf("}) {");
    expect(bodyStart, "프레임 본문 시작").toBeGreaterThan(-1);
    const firstReturn = frameBlock.indexOf("return (", bodyStart);
    expect(firstReturn, "프레임의 첫 return").toBeGreaterThan(bodyStart);
    expect(frameBlock.indexOf("const titleRef", bodyStart)).toBeLessThan(firstReturn);
    expect(frameBlock.indexOf("useEffect(", bodyStart)).toBeLessThan(firstReturn);
    // 조기 반환(`if (…) return`)이 생기면 이 계약이 먼저 빨개진다.
    expect(frameBlock.slice(bodyStart, firstReturn)).not.toMatch(/\breturn\b/);
  });
});

describe("ⓓ ref 없는 호출부의 갈래 — 오늘 넷 다 그 갈래다", () => {
  it("`returnFocusRef`는 선택 프롭이고, 넘기는 호출부는 오늘 0건이다", () => {
    expect(frameBlock).toContain("returnFocusRef?: RefObject<View | null>;");
    for (const file of jsxMountSites("BottomSheetFrame")) {
      expect(openTag(source(file), "BottomSheetFrame"), `${file}의 returnFocusRef`).not.toContain("returnFocusRef");
    }
    // ⚠️ 그래도 봉인과 열림 포커스는 선다 — 그 둘은 호출부 배선을 요구하지 않는다.
    // (복귀만 조용히 없다: 헬퍼가 handle 없는 ref에는 아무 일도 하지 않는다.)
    expect(modV1Source).toContain("if (handle) AccessibilityInfo.setAccessibilityFocus(handle);");
  });
});

describe("ⓔ EXP-001 렌더 불변 — 재캡처를 부르지 않는다", () => {
  it("프레임을 `<Modal>`로 감싸지 않았다", () => {
    expect(frameBlock).not.toContain("<Modal");
    expect(uiSource).not.toContain('from "react-native"\nimport { Modal');
  });

  it("프레임의 레이아웃 리터럴이 한 글자도 바뀌지 않았다", () => {
    // 배율 1.0 렌더를 정하는 것은 이 여섯 줄이고, 이번 라운드가 더한 셋은 전부 레이아웃 밖이다
    // (a11y 속성 하나 · Text의 ref 하나 · effect 하나).
    for (const literal of [
      "backgroundColor: theme.colors.white,",
      "borderTopLeftRadius: theme.radii.sheet,",
      "borderTopRightRadius: theme.radii.sheet,",
      "gap: 16,",
      "padding: 22,",
      "...theme.shadows.card"
    ]) {
      expect(frameBlock, literal).toContain(literal);
    }
    expect(frameBlock).toContain(
      '<View style={{ alignSelf: "center", backgroundColor: theme.colors.gray300, borderRadius: theme.radii.pill, height: 4, width: 42 }} />'
    );
    // 제목 Text의 스타일도 그대로다 — ref만 앞에 붙었다.
    expect(frameBlock).toContain('<Text ref={titleRef} style={[textStyles.h3, { color: theme.colors.brown }]}>{title}</Text>');
  });

  it("EXP-001이 어느 화면 파일인지 대장에서 읽는다(손으로 적지 않는다)", () => {
    const screens = JSON.parse(readFileSync(join(mobileRoot, "..", "..", "scripts/pixel-lock/pixel-lock-screens.json"), "utf8"));
    expect(screens["EXP-001"].route).toBe("wooriai:///pixel-lock?screen=EXP-001");
    // 그 screen 값을 실제 경로로 푸는 것은 런처다.
    expect(source("app/pixel-lock.tsx")).toContain('"EXP-001": "/expenses/new"');
    // 그 경로의 화면이 이 프레임을 쓴다 — 그래서 이 파일이 픽셀락 근거를 함께 진다.
    expect(source("app/expenses/new.tsx")).toContain("<BottomSheetFrame");
  });
});
