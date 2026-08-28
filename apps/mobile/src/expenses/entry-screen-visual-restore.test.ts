import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DSN-053 P2-C — 지출 기록 시트·기록 탭의 시각 정합 계약.
 *
 * 승인 원본(`git show c20deeb:apps/mobile/app/expenses/new.tsx`)의 수치를 화면이 실제로 들고
 * 있는지 고정한다. 화면은 vitest에서 렌더할 수 없으므로(RN 컴포넌트) 다른 화면 계약과 같은
 * 소스 계약 방식이다 -- 수치가 조용히 흘러가면 여기서 먼저 갈라진다.
 *
 * 기능 계약(저장 가드·자동 추천·프리필·오프라인·초안)은 각자의 테스트가 이미 갖고 있고, 이
 * 파일은 **모양만** 본다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const newExpenseSource = source("app/expenses/new.tsx");
const recordsSource = source("app/(tabs)/records.tsx");

describe('"바로 기록" 타일 (승인 원본 c20deeb:app/expenses/new.tsx:82-129)', () => {
  it("타일 상자가 144h · radius 16이고, 선택은 coral[50] + mainCoral 2px 테두리다", () => {
    const start = newExpenseSource.indexOf("const quickExpenseCategoryTileStyle = StyleSheet.create({");
    expect(start).toBeGreaterThan(0);
    const block = newExpenseSource.slice(start, newExpenseSource.indexOf("\n});", start));
    expect(block).toContain("borderRadius: 16");
    expect(block).toContain("height: 144");
    expect(block).toContain("backgroundColor: theme.colors.coral[50]");
    expect(block).toContain("borderColor: theme.colors.mainCoral");
    expect(block).toContain("borderWidth: 2");
  });

  it("아이콘이 44 원형 pill이고 미선택 peach/mainCoral · 선택 mainCoral/white로 반전된다", () => {
    const start = newExpenseSource.indexOf("const quickExpenseCategoryTileStyle = StyleSheet.create({");
    const block = newExpenseSource.slice(start, newExpenseSource.indexOf("\n});", start));
    expect(block).toContain("borderRadius: theme.radii.pill");
    expect(block).toContain("height: 44");
    expect(block).toContain("width: 44");
    // 미선택 원: peach 바탕 + mainCoral 글리프.
    expect(block).toContain("backgroundColor: theme.colors.peach");
    expect(block).toContain("color: theme.colors.mainCoral");
    // 선택 원: mainCoral 바탕 + 흰 글리프.
    expect(block).toContain("iconBoxSelected: {\n    backgroundColor: theme.colors.mainCoral\n  }");
    expect(block).toContain("iconTextSelected: {\n    color: theme.colors.white\n  }");
  });

  it("라벨 12/800(minH 34, 2줄)·힌트 10/700이다", () => {
    const start = newExpenseSource.indexOf("const quickExpenseCategoryTileStyle = StyleSheet.create({");
    const block = newExpenseSource.slice(start, newExpenseSource.indexOf("\n});", start));
    expect(block).toContain("fontSize: 12");
    expect(block).toContain('fontWeight: "800"');
    expect(block).toContain("minHeight: 34");
    expect(block).toContain("fontSize: 10");
    // 두 줄까지 균형 있게 놓이도록 한 줄 자르기(numberOfLines={1})는 쓰지 않는다.
    const tileStart = newExpenseSource.indexOf("function ExpenseCategoryIconButton");
    const tileEnd = newExpenseSource.indexOf("function ExpenseQuickItemButton");
    expect(tileEnd).toBeGreaterThan(tileStart);
    expect(newExpenseSource.slice(tileStart, tileEnd)).not.toContain("numberOfLines={1}");
  });

  it("열 수는 화면 폭·글자 배율을 따르는 공용 규칙에서 온다(화면이 직접 세지 않는다)", () => {
    expect(newExpenseSource).toContain("compactGridColumnCount(width, fontScale)");
    expect(newExpenseSource).toContain("compactGridItemWidth(expenseGridColumns)");
    expect(newExpenseSource).toContain("width: expenseGridItemWidth");
  });
});

describe("날짜 pill 행", () => {
  it("3칸 flex1 + 달력 버튼 48(radius 14·calendar-blank-outline)이다", () => {
    expect(newExpenseSource).toContain("quickDateChips.map");
    expect(newExpenseSource).toContain('name="calendar-blank-outline"');
    const start = newExpenseSource.indexOf('accessibilityLabel="지출 날짜 변경"');
    expect(start).toBeGreaterThan(0);
    const block = newExpenseSource.slice(start, start + 700);
    expect(block).toContain("borderRadius: 14");
    expect(block).toContain("height: 48");
    expect(block).toContain("width: 48");
  });

  /**
   * 승인 원본의 세 칸은 어제/오늘/**내일**이지만 이 앱은 미래 날짜를 저장하지 않는다.
   * 눌러도 저장이 막히는 칸을 내놓지 않는다는 것이 이 계약이다 -- 목록은 종전 14일 칩
   * 로직에서 그대로 잘라 오므로 라벨·iso 규칙이 두 벌이 되지 않는다.
   */
  it("미래 날짜 칩을 만들지 않고, 기존 14일 칩 로직에서 잘라 쓴다", () => {
    expect(newExpenseSource).toContain("const quickDateChips = recentDateChips.slice(0, 3).reverse();");
    expect(newExpenseSource).not.toContain('"내일"');
    // 미래 날짜 거부 자체는 종전 그대로다.
    expect(newExpenseSource).toContain('if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";');
  });

  it("고른 날짜를 그대로 적는 줄이 남아 있다(칩만으로는 알 수 없다)", () => {
    expect(newExpenseSource).toContain("{expenseDate.label}");
  });
});

describe("하단 고정 요약바", () => {
  it("스크롤과 함께 움직이지 않는다 (본문 스크롤 밖 · 키보드 회피 안)", () => {
    expect(newExpenseSource).toContain("<KeyboardAvoidingView");
    // 요약바는 </AppScreen> 뒤, 즉 스크롤 컨테이너 밖에 있다.
    const scrollEnd = newExpenseSource.indexOf("</AppScreen>");
    expect(scrollEnd).toBeGreaterThan(0);
    expect(newExpenseSource.indexOf('accessibilityLabel="지출 금액 입력"')).toBeGreaterThan(scrollEnd);
    expect(newExpenseSource.indexOf("label={CONTINUE_RECORDING_LABEL}")).toBeGreaterThan(scrollEnd);
  });

  it("분류 라벨 11/700 -> 품목명 15/800 + 연필 18 순서다", () => {
    expect(newExpenseSource).toContain('{selectedCategory ? selectedCategory.label : "분류 선택"}');
    expect(newExpenseSource).toContain('color: theme.colors.brown, flex: 1, fontSize: 15, fontWeight: "800"');
    expect(newExpenseSource).toContain('name="pencil-outline" size={18}');
    // 연필은 본문 품목명 칸으로 커서를 옮길 뿐이다 -- 같은 값을 고치는 칸을 둘로 만들지 않는다.
    expect(newExpenseSource).toContain("onPress={() => itemNameInputRef.current?.focus()}");
    expect(newExpenseSource).toContain("ref={itemNameInputRef}");
  });

  it("금액 박스가 beige·radius 14이고 값이 있으면 mainCoral 테두리가 선다", () => {
    expect(newExpenseSource).toContain("backgroundColor: theme.colors.beige");
    expect(newExpenseSource).toContain('borderColor: amountText ? theme.colors.mainCoral : "transparent"');
  });

  it("숫자 22/800 + '원' 14/800으로 위계가 갈리고, 소리에는 단위가 붙은 쪽을 넘긴다", () => {
    expect(newExpenseSource).toContain("const amountInputDisplay = formatAmountDigits(amountText);");
    expect(newExpenseSource).toContain("value={amountInputDisplay}");
    expect(newExpenseSource).toContain("accessibilityValue={{ text: formattedAmount }}");
    expect(newExpenseSource).toContain('<Text style={{ color: theme.colors.gray600, fontSize: 14, fontWeight: "800" }}>원</Text>');
    // '₩'는 코드 어디에도 없다(src/money.ts 규칙 + EXP-001 캡처와 같은 표기).
    expect(newExpenseSource).toContain('const quickExpenseAmountPreview = "38,500원";');
  });

  it("연속 기록 버튼 배치와 저장 가드가 그대로다", () => {
    expect(newExpenseSource.match(/disabled=\{saveExpense\.isPending \|\| isAmountInvalid\}/g) ?? []).toHaveLength(2);
    expect(newExpenseSource.match(/expenseGate\.guard\(/g) ?? []).toHaveLength(2);
    expect(newExpenseSource).toContain("{authToken && canContinueRecording({ linkedItemTemplateId }) ? (");
  });
});

describe("기록 탭 (구조 변경 없이 문법 정돈)", () => {
  it("달 내비 화살표가 chevron 아이콘 26 + 48dp 터치 타깃이다", () => {
    expect(recordsSource).toContain('<AppIcon color={theme.colors.gray900} name="chevron-left" size={26} />');
    expect(recordsSource).toContain('<AppIcon color={theme.colors.gray900} name="chevron-right" size={26} />');
    expect(recordsSource).toContain("minHeight: theme.touchTarget, minWidth: theme.touchTarget");
    // 텍스트 글리프 화살표는 이 화면에 남아 있지 않다.
    expect(recordsSource).not.toContain('fontSize: 22, fontWeight: "900" }}>‹</Text>');
    expect(recordsSource).not.toContain('fontSize: 22, fontWeight: "900" }}>›</Text>');
  });

  it("달력 뷰·검색·필터 칩·오프라인 배지는 그대로다", () => {
    expect(recordsSource).toContain("<RecordsCalendarGrid");
    // GAP-054 D#8: 검색이 판매처까지 훑게 되면서 문구가 사실에 맞게 늘었다(픽셀·구조는 그대로).
    // 라운드 54 P2-10: 문구는 records-list-view의 RECORDS_SEARCH_PLACEHOLDER 하나에서 나온다
    // (고지 줄과 구분자가 갈리던 자리를 없앴다) -- 검색창 자체는 그대로 남아 있다.
    expect(recordsSource).toContain("accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}");
    expect(recordsSource).toContain("categoryChips.map");
    expect(recordsSource).toContain("function offlineStatusIconName(syncState: string): keyof typeof Ionicons.glyphMap");
  });
});
