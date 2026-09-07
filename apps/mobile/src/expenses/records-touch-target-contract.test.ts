import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **기록 탭의 48dp 최소 터치 타깃 계약** — 직전 라운드가 파일 소유가 겹쳐 손대지 못하고
 * 이월한 두 자리를 오늘 다시 재고, 그 결과를 값으로 못박는다.
 *
 * 형식은 `src/touch-target-contract.test.ts`(A11Y-131)·`src/a11y-contract.test.ts`의
 * "GAP-064 #6 터치 타깃 소스 계약"과 같다: 숫자를 화면에서 옮겨 적는 것이 아니라 **소스에
 * 적힌 치수와 hitSlop을 읽어 더한 뒤** 그 합이 48인지를 본다. 기대값 48은 이 파일에
 * **리터럴로** 적는다 — 검사 대상(`theme.touchTarget`)에서 기대값을 만들면 토큰이 40으로
 * 바뀌는 날 이 계약이 조용히 함께 내려간다. 대신 토큰 자체가 48이라는 사실을 첫 케이스가
 * 따로 못박아, 두 값이 갈리면 여기서 빨개진다.
 *
 * 새 파일인 이유: 위 A11Y-131 파일은 이 트랙의 소유가 아니다(그 파일의 머리말이 "이번 라운드가
 * 실제로 고친 일곱 자리뿐"이라고 자기 경계를 이미 적어 두었다). 같은 형식으로 여기 쓴다.
 *
 * ## 오늘의 실측 (줄 번호는 라운드마다 바뀌므로 앵커로 찾는다)
 *
 *  ① **동기화 상태 칩**(→ `/sync-status`) — 이월 시점 그대로 미달이었다. 높이 선언도 hitSlop도
 *    없어 눌리는 상자가 곧 `StatusBadge` 하나였다(`paddingVertical: 5` ×2 + 11px 한 줄 ≈ 25dp).
 *    **이번에 minHeight 48로 채웠다.**
 *  ② **아이 전환 트리거** — 이월 메모의 "한 줄 + 2×8 ≈ 34"는 **오늘 기준으로는 이미 틀렸다.**
 *    그 사이 라운드 66 적대 리뷰(M-2)의 선례가 이 자리에 `minHeight: theme.touchTarget`을
 *    세웠고(그 계약이 a11y-contract.test.ts에 "같은 파일의 아이 전환 트리거 선례"로 인용돼
 *    있다), 오늘 다시 재면 48 + 2×8 = 64다. 고칠 것이 없으므로 **고치지 않고 실측만 못박는다** —
 *    이미 갚은 자리를 다시 손대면 그 인용 원본의 바이트가 흔들린다.
 *
 * ## 이 화면은 픽셀락 대상이 아니다
 *
 * 그래서 ①에서 **크기**를 고를 수 있었다(승인 캡처를 다시 찍어야 하는 자리가 아니다). 그
 * 사실을 손 목록이 아니라 픽셀락 런처의 라우트 표에서 직접 확인한다(마지막 케이스).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const recordsSource = () => source("app/(tabs)/records.tsx");

/** 이 저장소가 못박은 최소 터치 타깃. 이 파일 안에서는 **리터럴**이다. */
const MIN_TOUCH_TARGET = 48;

/**
 * `anchor`를 품은 가장 가까운 `<Pressable ...>` 여는 태그. 중괄호 깊이를 세며 닫는 `>`를 찾아,
 * 화살표 함수 스타일(`style={({ pressed }) => ([ ... ])}`) 안의 `>`에 걸리지 않는다.
 * (A11Y-131 파일의 같은 헬퍼와 같은 셈 — 그 파일은 이 트랙의 소유가 아니라 가져오지 않는다.)
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

/** 여는 태그의 `hitSlop={n}`에 적힌 맨 숫자. prop 자체가 없으면 0(= 슬롭 없음)이다. */
function readNumericHitSlop(tag: string): number {
  const match = /hitSlop=\{(\d+)\}/.exec(tag);
  return match ? Number(match[1]) : 0;
}

describe("기록 탭 최소 터치 타깃 계약 (선언 치수 + 2×세로 hitSlop ≥ 48)", () => {
  it("`theme.touchTarget` 토큰 자체가 48이다 (아래 케이스들이 그 이름으로 48을 채운다)", () => {
    expect(source("src/theme.ts")).toContain("touchTarget: 48");
  });

  /**
   * ① 동기화 상태 칩. 종전 ≈25dp(높이 선언 없음 · hitSlop 없음 — 그때는 참이었다: 이 줄은
   * 배지를 **보여 주는** 자리로 태어났고 누를 수 있게 된 것은 나중이다) → 이제 minHeight 48.
   *
   * **크기를 골랐지 hitSlop을 고르지 않은 근거**(자리마다 부모의 gap과 형제 배치를 읽는다):
   * 이 Pressable은 부모 `View`(`gap: theme.spacing.section` = 20)의 flex 자식이라 가로로 화면
   * 전체를 덮는다. 48을 슬롭으로 벌면 세로 12가 필요한데, 바로 아래 블록의 첫 컨트롤들이 이미
   * 자기 슬롭을 위로 내민다(아이 전환 트리거 8 · 달 이동 화살표 12). 12 + 12 = 24 > 20이라 두
   * 슬롭이 4dp 띠에서 겹치고, 겹치는 띠에서는 **뒤에 그려진 달 이동 줄이 이겨** 칩을 누르려던
   * 손가락이 이전/다음 달로 넘어간다 — 계약의 셈만 48이고 실제 히트는 45가 된다.
   */
  it("동기화 상태 칩: minHeight 48로 몸을 채운다 (hitSlop으로 벌지 않는다)", () => {
    const chipTag = pressableOpenTagAround(recordsSource(), 'onPress={() => router.push("/sync-status")}');

    expect(chipTag, "칩의 최소 높이").toContain("minHeight: theme.touchTarget");
    // 크기로 채웠으므로 hitSlop으로 다시 벌지 않는다(아래 달 이동 줄의 슬롭과 겹치는 그 실수).
    expect(chipTag, "칩에 남은 hitSlop").not.toContain("hitSlop=");
    expect(48 + 2 * readNumericHitSlop(chipTag), "칩의 히트 높이").toBe(MIN_TOUCH_TARGET);

    // 세로 여백으로 벌지 않았다 — 그건 배지 안쪽 간격이 함께 바뀌는 길이다.
    expect(chipTag, "칩의 세로 여백").not.toContain("paddingVertical");
    // 종전 레이아웃 속성은 그대로다: 배지는 여전히 왼쪽에서 시작하고 세로로만 가운데 선다.
    expect(chipTag, "칩의 방향").toContain('flexDirection: "row"');
    expect(chipTag, "칩의 세로 정렬").toContain('alignItems: "center"');
    // ⚠️ justifyContent를 더하지 않는다 — row 방향에서 그것은 가로 정렬이라 배지가 가운데로 밀린다
    // (세로 가운데 정렬은 위 alignItems가 이미 한다. 다른 자리들이 쓰는 관용구를 그대로 베끼면
    // 여기서만 렌더가 바뀐다).
    expect(chipTag, "칩의 가로 정렬").not.toContain("justifyContent");
  });

  /**
   * ② 아이 전환 트리거. **오늘 실측: 48 + 2×8 = 64로 이미 채워져 있다** — 이월 메모의 "≈34"는
   * 그 사이 라운드 66/98이 갚아 더는 참이 아니다. 그래서 이 라운드는 여기를 **고치지 않았고**,
   * 이 케이스는 그 실측을 못박기만 한다(회귀하면 여기서 빨개진다).
   *
   * 참고 실측(단언하지 않는다 — 이 라운드가 만든 값이 아니다): 이 트리거의 아래 슬롭 8은 부모
   * `gap: 8`을 정확히 메우고, 그 아래 달 이동 화살표의 슬롭 12가 그 8을 넘어 트리거의 몸 4dp를
   * 덮는다. 그래도 위 슬롭 8 + 몸 48 − 4 = 52로 48을 넘으므로 미달 자리는 아니다.
   */
  it("아이 전환 트리거: 이미 minHeight 48 + 세로 hitSlop 2×8 = 64다 (이번 라운드 무변경)", () => {
    const triggerTag = pressableOpenTagAround(recordsSource(), 'testID="records-child-switch-trigger"');

    expect(triggerTag, "트리거의 최소 높이").toContain("minHeight: theme.touchTarget");
    expect(triggerTag, "트리거의 세로 정렬").toContain('justifyContent: "center"');
    const slop = readNumericHitSlop(triggerTag);
    expect(slop, "트리거의 hitSlop").toBe(8);
    expect(48 + 2 * slop, "트리거의 히트 높이").toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

    // 이 자리의 기준 객체는 a11y-contract.test.ts가 "아이 전환 트리거 선례"로 **인용**한다.
    // 그 인용이 살아 있는 동안 이 자리를 다시 손대면 두 계약이 갈린다.
    expect(recordsSource(), "인용 원본의 기준 객체").toContain(
      '{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }'
    );
  });

  /**
   * 이 화면 안에 **높이도 슬롭도 없는 누름 자리**가 더 없다는 확인. 남은 두 자리(오프라인 대기
   * 행 · 서버 지출 행)는 자기 안쪽 `recordsFlatRowStyle`이 이미 48을 잡고 있어 미달이 아니다 —
   * 그 사실을 이름으로 못박아, 그 줄이 걷히면 여기서 빨개지게 한다.
   */
  it("높이 선언이 없는 나머지 누름 자리는 안쪽 행 스타일이 48을 잡는다", () => {
    const flatRowStyle = /const recordsFlatRowStyle = \{([^}]*)\}/.exec(recordsSource());
    expect(flatRowStyle, "recordsFlatRowStyle을 찾지 못했다").not.toBeNull();
    expect(flatRowStyle?.[1] ?? "", "행의 최소 높이").toContain("minHeight: theme.touchTarget");

    for (const anchor of ["onPress={pushSyncStatus}", "onPress={openExpenseDetail}"]) {
      const rowTag = pressableOpenTagAround(recordsSource(), anchor);
      // 이 둘은 스스로 높이를 말하지 않는다 — 그래서 위 행 스타일이 곧 그 몸이다.
      expect(rowTag, `${anchor}의 자체 높이`).not.toContain("minHeight");
      expect(recordsSource(), `${anchor}가 감싸는 행`).toContain("<View style={recordsFlatRowStyle}>");
    }
  });

  /**
   * 크기(=레이아웃)를 고를 수 있었던 근거: **기록 탭은 픽셀락 아홉 화면에 없다.** 손 목록이
   * 아니라 픽셀락 런처의 라우트 표와 스크린 목록 JSON에서 직접 읽는다(둘 중 하나만 바뀌어도
   * 이 케이스가 잡는다).
   */
  it("기록 탭은 픽셀락 대상이 아니다 (그래서 크기를 바꿔도 재대조 캡처가 없다)", () => {
    const launcherSource = source("app/pixel-lock.tsx");
    const table = /const pixelLockRoutes = \{([^}]*)\}/.exec(launcherSource);
    expect(table, "pixelLockRoutes 표를 찾지 못했다").not.toBeNull();
    const routes = [...(table?.[1] ?? "").matchAll(/"([A-Z]+-\d+)":\s*"([^"]+)"/g)].map(([, id, href]) => ({ id, href }));
    expect(routes.length, "픽셀락 라우트 수").toBe(9);
    for (const route of routes) {
      expect(route.href, `${route.id}이 기록 탭을 열지 않는다`).not.toContain("(tabs)/records");
    }

    // 스크린 목록 JSON의 아홉 키가 런처의 아홉 키와 같다(한쪽만 늘면 위 검사가 헐거워진다).
    const screens = JSON.parse(source("../../scripts/pixel-lock/pixel-lock-screens.json")) as Record<string, unknown>;
    expect(Object.keys(screens).sort()).toEqual(routes.map((route) => route.id).sort());
  });
});
