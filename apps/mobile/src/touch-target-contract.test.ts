import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A11Y-131 — **48dp 최소 터치 타깃 계약(이번 라운드가 갚은 자리들).**
 *
 * 형식은 `src/a11y-contract.test.ts`의 "GAP-064 #6 터치 타깃 소스 계약"과 같다: 숫자를 화면에서
 * 옮겨 적는 것이 아니라 **소스에 적힌 치수와 hitSlop을 읽어 더한 뒤** 그 합이 48인지를 본다.
 * 다만 기대값 48은 이 파일에 **리터럴로** 적는다 — 검사 대상(`theme.touchTarget`)을 불러와
 * 기대값을 만들면 토큰이 40으로 바뀌는 날 이 계약이 조용히 함께 내려간다. 대신 토큰 자체가
 * 48이라는 사실을 첫 케이스가 따로 못박아, 두 값이 갈리면 여기서 빨개진다.
 *
 * 이 파일이 지키는 것은 **이번 라운드가 실제로 고친 일곱 자리**뿐이다. 픽셀락 화면
 * (scripts/pixel-lock/pixel-lock-screens.json)과 다른 트랙이 들고 있는 파일의 미달 자리는
 * 손대지 않았으므로 여기에도 적지 않는다 — 없는 계약을 적어 두면 다음 사람이 이미 지켜지는
 * 줄로 읽는다.
 *
 * ⚠️ **두 시점(이월 한 자리를 닫는 걸음).** 바로 위 문단은 *그때는 참이었다* — A11Y-131은 일곱을
 * 갚고 픽셀락 화면 파일을 통째로 경계 밖에 두었다. 그런데 그 경계가 남긴 것이 **하나**였다:
 * 지출 입력 하단 고정 요약바의 품목명 버튼(`app/expenses/new.tsx` = EXP-001)이 44dp로 남았고,
 * 그 자리는 하필 **핵심 루프**(지출 기록)에 언제나 고정된 버튼이다. *이제* 아래 **⑧**이 그 자리를
 * 문다. 경계를 통째로 지운 것이 아니라 **경계의 근거를 다시 읽은 것**이다: 사람이 캡처를 다시
 * 찍어야 하는 것은 **렌더가 바뀔 때**이고, `hitSlop`은 레이아웃 속성이 아니라 렌더를 바꾸지
 * 않는다. 그 사실은 저장소가 이미 세 번 못박았다 — `app/expenses/new.tsx` 자신의
 * `SUGGEST_CHIP_HIT_SLOP`(라운드 64 #6, 같은 EXP-001 화면) · `ExpenseDatePicker` 날짜 칸(위 ①,
 * EXP-001에서 열린다) · `app/import/index.tsx` 뒤로가기(IMP-003 —
 * `src/a11y-contract.test.ts`의 GAP-069 #5가 *"렌더는 한 픽셀도 바뀌지 않는다"*를 따로 못박았다).
 * 그래서 ⑧은 히트 영역만 단언하지 않고, **선언 치수가 한 값도 움직이지 않았다**는 것을 같이 문다
 * (아래 ⑧-픽셀). 크기로 갚는 길(③⑤⑥⑦)은 이 자리에서는 **금지**다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 이 저장소가 못박은 최소 터치 타깃. 이 파일 안에서는 **리터럴**이다. */
const MIN_TOUCH_TARGET = 48;

/**
 * `anchor`를 품은 가장 가까운 `<Pressable ...>` 여는 태그. 중괄호 깊이를 세며 닫는 `>`를 찾아,
 * 화살표 함수 스타일(`style={({ pressed }) => ({ ... })}`) 안의 `>`에 걸리지 않는다.
 */
function pressableOpenTagAround(sourceText: string, anchor: string): string {
  const anchorAt = sourceText.indexOf(anchor);
  if (anchorAt < 0) throw new Error(`앵커를 찾지 못했다: ${anchor}`);
  const open = sourceText.lastIndexOf("<Pressable", anchorAt);
  if (open < 0) throw new Error(`${anchor} 앞에서 <Pressable을 찾지 못했다`);
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < sourceText.length; i += 1) {
    const character = sourceText[i];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth === 0) return sourceText.slice(open, i + 1);
  }
  throw new Error(`${anchor}의 <Pressable 여는 태그가 닫히지 않았다`);
}

/** `{ bottom: n, left: n, right: n, top: n }` 꼴 hitSlop 상수의 네 변을 소스에서 읽는다. */
function readHitSlopBox(sourceText: string, constantName: string) {
  const declaration = new RegExp(`const ${constantName} = \\{([^}]*)\\}`).exec(sourceText);
  if (!declaration) throw new Error(`${constantName} 선언을 찾지 못했다`);
  const box: Record<string, number> = {};
  for (const [, side, value] of declaration[1].matchAll(/(bottom|left|right|top):\s*(-?\d+)/g)) {
    box[side] = Number(value);
  }
  return box;
}

/** 스타일 객체 텍스트(또는 여는 태그)에서 숫자 스타일 값 하나를 읽는다. */
function readNumericStyle(blockText: string, property: string): number {
  const match = new RegExp(`${property}:\\s*(\\d+)`).exec(blockText);
  if (!match) throw new Error(`${property} 숫자 값을 찾지 못했다`);
  return Number(match[1]);
}

describe("A11Y-131 최소 터치 타깃 계약 (선언 치수 + 2×세로 hitSlop ≥ 48)", () => {
  it("`theme.touchTarget` 토큰 자체가 48이다 (아래 케이스들이 그 이름으로 48을 채운다)", () => {
    expect(source("src/theme.ts")).toContain("touchTarget: 48");
  });

  /**
   * ① 지출 날짜 픽커의 **날짜 칸**. 종전 44dp(minHeight 44 · hitSlop 없음) → 이제 44 + 2×2 = 48.
   * 크기가 아니라 hitSlop을 쓴 이유는 컴포넌트 주석에 있다(격자가 24dp 자라면 이 픽커를 여는
   * 세 화면의 배치가 함께 밀린다 — EXP-001 픽셀락 포함).
   */
  it("ExpenseDatePicker 날짜 칸: minHeight 44 + 세로 hitSlop 2×2 = 48", () => {
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    const box = readHitSlopBox(pickerSource, "EXPENSE_DATE_PICKER_CELL_HIT_SLOP");
    expect(box, "날짜 칸 hitSlop").toEqual({ bottom: 2, left: 0, right: 0, top: 2 });

    const cellBlock = /cell: \{([^}]*)\}/.exec(pickerSource);
    expect(cellBlock, "expenseDatePickerStyle.cell을 찾지 못했다").not.toBeNull();
    const cellHeight = readNumericStyle(cellBlock?.[1] ?? "", "minHeight");
    expect(cellHeight, "날짜 칸의 선언 높이").toBe(44);
    expect(cellHeight + box.top + box.bottom, "날짜 칸의 히트 높이").toBe(MIN_TOUCH_TARGET);

    // 그 슬롭이 **칸 Pressable에 실제로 걸려 있는가**(상수만 남고 prop이 사라지면 여기서 빨개진다).
    const cellTag = pressableOpenTagAround(pickerSource, "onPress={() => onSelectDate(cell.date as string)}");
    expect(cellTag).toContain("hitSlop={EXPENSE_DATE_PICKER_CELL_HIT_SLOP}");

    // 가로는 0이다 — 한 주의 칸 일곱은 gap 2로 맞붙어 있어, 넓히면 다른 날짜가 눌린다.
    expect(box.left + box.right, "날짜 칸의 가로 슬롭").toBe(0);
  });

  /**
   * ② 카테고리 비중 카드의 **범례 줄**(리포트 → 기록 드릴다운). 종전 44dp → 44 + 2×2 = 48.
   * REP-001 픽셀락 캡처 안이라 크기는 건드리지 않았다.
   */
  it("DonutChartCard 범례 줄: minHeight 44 + 세로 hitSlop 2×2 = 48", () => {
    const uiSource = source("src/ui.tsx");
    const box = readHitSlopBox(uiSource, "DONUT_LEGEND_ROW_HIT_SLOP");
    expect(box, "범례 줄 hitSlop").toEqual({ bottom: 2, left: 0, right: 0, top: 2 });

    const legendTag = pressableOpenTagAround(uiSource, "onPress={() => onSelect(slice, index)}");
    expect(legendTag).toContain("hitSlop={DONUT_LEGEND_ROW_HIT_SLOP}");
    const legendHeight = readNumericStyle(legendTag, "minHeight");
    expect(legendHeight, "범례 줄의 선언 높이").toBe(44);
    expect(legendHeight + box.top + box.bottom, "범례 줄의 히트 높이").toBe(MIN_TOUCH_TARGET);

    // 세로 2의 근거는 줄 사이 gap 10이다 — 2+2=4가 그 10보다 작아야 이웃 줄의 몸에 닿지 않는다.
    expect(uiSource, "범례 줄을 감싸는 카드의 gap").toContain('<Card style={{ gap: 10 }}>');
    expect(box.top + box.bottom).toBeLessThan(10);
  });

  /**
   * ③④ 동기화 충돌 화면의 **값 고르기 pill 둘**. 종전 paddingVertical 8 + 12px 한 줄(≈34dp) →
   * 이제 minHeight 48. 여기서만 크기를 키운 이유: 48을 슬롭으로 채우면 세로 16dp가 필요한데
   * 위 라벨과는 gap 6, 아래 항목과는 gap 10뿐이라 이웃의 몸을 덮는다(잘못된 필드가 눌린다).
   */
  it("sync-status 충돌 pill 둘: minHeight를 theme.touchTarget으로 채운다", () => {
    const syncSource = source("app/sync-status.tsx");
    const localTag = pressableOpenTagAround(syncSource, "next.delete(entry.field);");
    const serverTag = pressableOpenTagAround(syncSource, "next.add(entry.field);");
    for (const [name, tag] of [
      ["내 값", localTag],
      ["서버 값", serverTag]
    ] as const) {
      expect(tag, `${name} pill의 최소 높이`).toContain("minHeight: theme.touchTarget");
      expect(tag, `${name} pill의 세로 정렬`).toContain('justifyContent: "center"');
      // 종전 여백은 그대로 남는다 — 글자와 테두리 사이 간격까지 바꾸는 변경이 아니다.
      expect(tag, `${name} pill의 세로 여백`).toContain("paddingVertical: 8");
      // 크기로 채웠으므로 hitSlop으로 다시 벌지 않는다(이웃 필드를 덮는 그 실수의 재발 방지).
      expect(tag, `${name} pill의 hitSlop`).not.toContain("hitSlop={");
    }
    // 이 화면의 pill은 정확히 둘이다(셋째가 생기면 이 계약을 지나지 않고 태어난다).
    expect(syncSource.match(/minHeight: theme\.touchTarget/g)?.length, "48을 채운 자리 수").toBe(2);
  });

  /**
   * ⑤ 정기 지출 목록의 **삭제 텍스트 버튼**. 종전 hitSlop 8 + 13px 한 줄(≈34dp) → minHeight 48.
   * 형제 TextButton 둘이 이미 48이고 행이 `alignItems: "center"`라 **렌더는 불변**이다.
   */
  it("정기 지출 삭제 버튼: minHeight 48 + 가로를 버는 hitSlop 8", () => {
    const recurringSource = source("app/expenses/recurring.tsx");
    const deleteTag = pressableOpenTagAround(recurringSource, "정기 지출 삭제`}");
    expect(deleteTag).toContain("minHeight: theme.touchTarget");
    expect(deleteTag).toContain('justifyContent: "center"');
    // 세로는 minHeight가 채우고, 남은 hitSlop 8은 "삭제" 두 글자의 가로를 번다.
    expect(deleteTag).toContain("hitSlop={8}");
    // 그 8은 형제 사이 gap 16보다 작아야 옆 버튼의 몸에 닿지 않는다.
    expect(recurringSource, "actionRowStyle의 gap").toContain("gap: 16");
  });

  /**
   * ⑥ 지출 상세의 **"직접 입력 / 최근 날짜에서 선택" 토글**. 종전 hitSlop 14 + 12px 한 줄(≈44dp)
   * → minHeight 48, hitSlop 제거. 슬롭으로 채우면 위 날짜 칩 줄(gap 8)의 몸을 덮는다.
   */
  it("지출 상세 날짜 토글: minHeight 48 · 칩 줄을 덮던 hitSlop 14는 사라졌다", () => {
    const detailSource = source("app/expenses/[expenseId].tsx");
    const toggleTag = pressableOpenTagAround(detailSource, "onPress={() => setCustomDateMode((value) => !value)}");
    expect(toggleTag).toContain("minHeight: theme.touchTarget");
    expect(toggleTag).toContain('justifyContent: "center"');
    expect(toggleTag, "토글에 남은 hitSlop").not.toContain("hitSlop={");
    // 맨 숫자 14가 이 파일 어디에도 hitSlop으로 남아 있지 않다(다음 토글이 다시 14로 태어나지 않게).
    expect(detailSource, "파일에 남은 hitSlop 14").not.toContain("hitSlop={14}");
  });

  /**
   * ⑦ 엑셀 가져오기 상세의 **행 분류 수정 토글**. 종전 hitSlop 8 + 12px 한 줄(≈32dp) →
   * minHeight 48, hitSlop 제거. 이 화면은 IMP-003 픽셀락 경로(app/import/index.tsx)가 아니다.
   */
  it("가져오기 행 분류 수정 토글: minHeight 48 · hitSlop 없음", () => {
    const importSource = source("app/import/[importJobId].tsx");
    const editTag = pressableOpenTagAround(importSource, "onPress={handleExpand}");
    expect(editTag).toContain("minHeight: theme.touchTarget");
    expect(editTag).toContain('justifyContent: "center"');
    expect(editTag, "토글에 남은 hitSlop").not.toContain("hitSlop={");
  });

  /**
   * ⑧ 지출 입력 **하단 고정 요약바의 품목명 버튼**(`app/expenses/new.tsx`). 종전 44dp
   * (minHeight 44 · hitSlop 없음) → 이제 44 + 2×2 = 48. 위 ①과 **같은 4dp를 같은 방식으로**
   * 갚는다(선언 치수는 0 변경). 이 자리가 위 일곱에 끼지 못했던 이유와 이제 닫는 이유는 이
   * 파일 머리말의 두 시점 문단에 있다.
   */
  it("지출 요약바 품목명 버튼: minHeight 44 + 세로 hitSlop 2×2 = 48", () => {
    const entrySource = source("app/expenses/new.tsx");
    const box = readHitSlopBox(entrySource, "SUMMARY_BAR_ITEM_NAME_HIT_SLOP");
    expect(box, "품목명 버튼 hitSlop").toEqual({ bottom: 2, left: 0, right: 0, top: 2 });

    // 그 슬롭이 **요약바의 그 버튼에 실제로 걸려 있는가**(상수만 남고 prop이 사라지면 빨개진다).
    const tag = pressableOpenTagAround(entrySource, "onPress={focusItemNameFromSummaryBar}");
    expect(tag, "품목명 버튼의 hitSlop 배선").toContain("hitSlop={SUMMARY_BAR_ITEM_NAME_HIT_SLOP}");
    const height = readNumericStyle(tag, "minHeight");
    expect(height, "품목명 버튼의 선언 높이").toBe(44);
    expect(height + box.top + box.bottom, "품목명 버튼의 히트 높이").toBe(MIN_TOUCH_TARGET);

    // 가로는 0이다 — 버튼은 요약바 왼쪽 열(flex: 1)을 가득 채워 360dp 기기에서도 약 155dp이니
    // 이미 48을 크게 넘고, 오른쪽으로 벌면 gap 10 너머 금액 입력칸의 몸에 다가간다.
    expect(box.left + box.right, "품목명 버튼의 가로 슬롭").toBe(0);

    // 세로 2의 근거인 두 간격이 소스에 그대로 있다: 위로는 분류 라벨과 gap 4(2 < 4),
    // 아래로는 요약바 안쪽 열의 gap 10(2 < 10)이라 어느 이웃의 몸에도 닿지 않는다.
    expect(entrySource, "품목명 버튼이 선 왼쪽 열의 gap").toContain("<View style={{ flex: 1, gap: 4 }}>");
    expect(entrySource, "요약바 안쪽 열의 gap").toContain('alignSelf: "center", gap: 10');
    expect(box.top, "위쪽 슬롭은 라벨과의 gap 4보다 작다").toBeLessThan(4);
    expect(box.bottom, "아래쪽 슬롭은 저장 줄과의 gap 10보다 작다").toBeLessThan(10);
  });

  /**
   * ⑧-픽셀 — 이 한 자리만 픽셀락 화면 파일(EXP-001) 안에 있으므로, **렌더가 안 바뀌었다**를
   * 값으로 따로 못박는다. 형식은 `src/a11y-contract.test.ts`의 GAP-069 #5(IMP-003 뒤로가기)가
   * 세운 그대로다 — 다음 사람이 "이왕 고치는 김에" 높이나 여백으로 갚으면 여기서 빨개지고,
   * 그건 승인 캡처를 다시 찍어야 하는 변경이다.
   */
  it("⑧ 렌더는 한 픽셀도 바뀌지 않는다 — EXP-001 픽셀락 캡처가 그대로다", () => {
    const entrySource = source("app/expenses/new.tsx");
    const tag = pressableOpenTagAround(entrySource, "onPress={focusItemNameFromSummaryBar}");
    // 44는 승인 캡처(EXP-001)의 값이다. 높이로 벌지 않았다는 사실을 값으로 못박는다.
    expect(readNumericStyle(tag, "minHeight"), "버튼 높이").toBe(44);
    // 여백으로 벌지도 않았다 — 그건 렌더가 바뀌는 길이다.
    expect(tag, "버튼 여백").not.toContain("padding");
    expect(tag, "버튼 여백").not.toContain("margin");
    // hitSlop이 이 화면에서 렌더 중립이라는 근거는 **같은 파일의 선례**다(라운드 64 #6 입력 보조 칩).
    expect(entrySource, "같은 파일의 hitSlop 선례 선언").toContain(
      "const SUGGEST_CHIP_HIT_SLOP = { bottom: 5, left: 3, right: 3, top: 5 } as const;"
    );
    expect(entrySource, "같은 파일의 hitSlop 선례 배선").toContain("hitSlop={SUGGEST_CHIP_HIT_SLOP}");
  });

  /**
   * 이 라운드가 **손대지 않기로 한 경계**를 계약으로 남긴다: 픽셀락 화면 목록은 사람이 캡처를
   * 다시 찍어야 움직이는 자리이므로, 위 일곱 자리 중 어느 것도 그 아홉 화면 파일에 있지 않다.
   *
   * ⚠️ **두 시점**: 위 문장은 **일곱에 대해서는 지금도 참**이고, 그래서 아래 단언은 한 줄도
   * 바뀌지 않았다. 다만 그 경계가 *"픽셀락 화면은 영원히 못 고친다"*로 읽히면 안 된다 — ⑧이
   * 바로 그 파일(`app/expenses/new.tsx`) 안의 자리를 **렌더를 바꾸지 않는 방법으로** 갚았다.
   * 아래 `touchedFiles`에 그 파일을 더하지 않는 이유도 그것이다: 이 목록이 세는 것은 *"크기로
   * 갚아 캡처가 흔들릴 수 있는 자리"*이고, ⑧은 그 범주가 아니다(⑧-픽셀이 값으로 지킨다).
   */
  it("고친 일곱 자리는 픽셀락 화면 아홉 개의 파일 밖에 있다", () => {
    const pixelLockScreenFiles = [
      "app/launch-animation.tsx",
      "app/(tabs)/index.tsx",
      "app/expenses/new.tsx",
      "app/(tabs)/items.tsx",
      "app/items/[itemTemplateId].tsx",
      "app/(tabs)/reports.tsx",
      "app/family/index.tsx",
      "app/import/index.tsx",
      "app/(tabs)/more.tsx"
    ];
    const touchedFiles = [
      "src/expenses/ExpenseDatePicker.tsx",
      "src/ui.tsx",
      "app/sync-status.tsx",
      "app/expenses/recurring.tsx",
      "app/expenses/[expenseId].tsx",
      "app/import/[importJobId].tsx"
    ];
    for (const touched of touchedFiles) {
      expect(pixelLockScreenFiles, `${touched}는 픽셀락 화면 파일이 아니어야 한다`).not.toContain(touched);
    }
    // 목록의 아홉은 pixel-lock 런처가 실제로 여는 경로다(손 목록이 아니라 그 파일에서 온다).
    const launcherSource = source("app/pixel-lock.tsx");
    for (const screenId of ["SPL-001", "HOME-001", "EXP-001", "ITEM-001", "ITEM-002", "REP-001", "FAM-001", "IMP-003", "SET-001"]) {
      expect(launcherSource, `${screenId} 경로 선언`).toContain(`"${screenId}":`);
    }
  });
});
