import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 102 T3 — 예산 화면(app/budget.tsx) "카테고리별 예산" 카드의 배선 계약
 * (docs/5차/round102-category-budget-design.md §4.1·§4.2·§4.4).
 * (readFileSync 계약 테스트 관례는 src/reports/monthly-insight-flow.test.ts와 같다.)
 */
describe("라운드 102 예산 화면 카테고리 카드 배선", () => {
  const budgetScreen = () => source("app/budget.tsx");

  it('["categories"] 캐시를 이 화면이 직접, includeAll 전량 규약으로 채운다 (§4.1 · 키 기본 staleTime)', () => {
    const src = budgetScreen();
    expect(src).toContain('queryKey: ["categories"]');
    expect(src).toContain("listCategories(authToken!, { includeAll: true })");
    // 공유 키의 staleTime은 키 기본과 같은 값 하나다(shared-cache-policy — 리포트 화면과 같은 형식).
    expect(src).toContain("staleTime: 5 * 60 * 1000");
    // 비세션에서는 요청 자체가 켜지지 않는다(§6.6 — 비세션은 캐시를 읽지도 않는 기존 구조).
    expect(src).toContain("enabled: Boolean(authToken),");
  });

  it("카드는 세션 + 목록 성공 갈래에서만 조립되고, 폼이 없으면 렌더 자체가 없다 (§4.1 카드 미렌더)", () => {
    const src = budgetScreen();
    expect(src).toContain("authToken && categories.isSuccess");
    expect(src).toContain("{categoryForm ? (");
    // 행 조립·검증·문구·이월 칩 판정은 전부 순수 모듈이 소유한다 — 화면은 그린다.
    expect(src).toContain('from "../src/expenses/category-budget-form"');
    expect(src).toContain("buildCategoryBudgetForm({");
    expect(src).toContain("buildCategoryCarryOverChip({");
  });

  it("저장은 기존 [저장]·기존 mutation 하나 그대로다 — dirty일 때만 화면 전체 집합을 싣는다 (§2.2·§6.7 R1)", () => {
    const src = budgetScreen();
    // 신규 useMutation 0건 — mutation-press-guard 대장 무접촉(§6.3).
    expect(src.match(/useMutation\(/g) ?? []).toHaveLength(1);
    // dirty가 아니면 undefined = 필드 미탑재(서버 무접촉) — 총액만 고친 저장이 남의 카테고리
    // 편집을 낡은 프리필로 덮지 않는다.
    expect(src).toContain("const categoryBudgets = categoryForm && categoryDirty ? categoryForm.entries : undefined;");
    expect(src).toContain("upsertBudget(authToken, childId, amountKrw, undefined, categoryBudgets)");
    expect(src).toContain("isCategoryBudgetDirty(categoryInitialDigits, categoryDraft)");
    // 성공 무효화는 종전 세 키 그대로다(§4.1 — 추가 키 0건).
    expect(src).toContain('[["budget"], ["home"], ["report"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))');
  });

  it("서버가 거절할 집합은 요청으로 나가지 않는다 — 버튼 잠금 + mutationFn 이중 가드 (GAP-054 #2 형식)", () => {
    const src = budgetScreen();
    expect(src).toContain("!(categoryForm && categoryDirty && !categoryForm.isValid) &&");
    expect(src).toContain("if (categoryForm && categoryDirty && !categoryForm.isValid) {");
  });

  it("이월 칩은 채워 넣기만 한다 — 자동 저장 금지 (§4.2 · B1(b))", () => {
    const src = budgetScreen();
    expect(src).toContain("onPress={() => setCategoryEdits(categoryCarryOverChip.prefillDigits)}");
    // 기존 총액 4계열 칩은 0접촉이다 — 조립 호출이 종전 형태 그대로 남아 있다.
    expect(src).toContain("buildBudgetAdjustChips({");
  });

  it("행 입력의 접근성 라벨·금액 정규화는 단일 소스에서 온다", () => {
    const src = budgetScreen();
    expect(src).toContain("accessibilityLabel={row.inputAccessibilityLabel}");
    // 금액 표기·정규화는 총액 입력과 같은 money 모듈 한 벌이다(FMT-127).
    expect(src).toContain("setCategoryEdits((edits) => ({ ...edits, [row.categoryId]: amountDigitsOnly(value) }))");
    expect(src).toContain('value={formatAmountDigits(categoryDraft[row.categoryId] ?? "")}');
  });

  it("카테고리 카드: 관측 줄만 회색, **저장을 잠그는 오류**는 danger + 라이브 리전 (DNC-018 · 리뷰 L-a11y)", () => {
    // ⚠️ 두 시점: 종전 계약은 "카드 구간에 경고색이 **없다**"였다(`not.toContain("theme.colors.
    // danger")`). 그 한 벌은 성격이 다른 두 종류를 한 색으로 접었다 — 합 관측은 저장을 막지
    // 않는 사실 서술이고(§1.3(a)), 행 상한·30개 상한은 `isValid`를 false로 만들어 [저장]을
    // 잠근다. 잠긴 이유를 회색 캡션으로만 말하면 버튼이 왜 안 눌리는지 화면이 끝내 답하지
    // 않는다. 오늘의 계약은 **갈래별**이다: 관측 줄은 여전히 회색, 잠금 오류만 danger이고
    // 포커스가 입력칸에 남는 자리라 라이브 리전을 함께 단다.
    const src = budgetScreen();
    const cardStart = src.indexOf("{categoryForm ? (");
    const cardEnd = src.indexOf("{save.isError ?");
    expect(cardStart).toBeGreaterThan(-1);
    expect(cardEnd).toBeGreaterThan(cardStart);
    const cardSlice = src.slice(cardStart, cardEnd);

    // ① 관측 줄(합 · 캡션 · 해제 안내)은 회색 그대로다 — 경고색을 늘리지 않는다.
    expect(cardSlice).toContain('testID="budget-category-sum-notice" style={budgetContextLineStyle}');
    expect(cardSlice).toContain("원하는 카테고리에만 정해도 돼요.");
    // ② 저장 잠금 오류 둘은 danger 스타일 한 벌 + 라이브 리전을 지난다(색 리터럴 신규 0 —
    //    스타일은 화면 상단의 상수 하나이고 그 상수만 danger 토큰을 읽는다).
    expect(cardSlice).not.toContain("theme.colors.danger");
    expect(src).toContain("const budgetCategoryLockedErrorStyle = {\n  color: theme.colors.danger,");
    expect(cardSlice).toContain("style={budgetCategoryLockedErrorStyle}\n                      >\n                        {row.errorText}");
    expect(cardSlice).toContain('testID="budget-category-form-error"');
    expect(cardSlice.match(/accessibilityLiveRegion="polite"/g) ?? []).toHaveLength(2);
    expect(cardSlice.match(/style=\{budgetCategoryLockedErrorStyle\}/g) ?? []).toHaveLength(2);
    // ③ 그 둘이 실제로 저장을 잠그는 갈래라는 사실(모듈의 isValid) — 갈래를 가르는 술어가
    //    "저장을 잠그는가" 하나임을 여기서 못 박는다.
    expect(source("src/expenses/category-budget-form.ts")).toContain(
      "isValid: !hasRowError && formError === null"
    );
  });

  it("이 화면에 중첩 스크롤러를 세우지 않았다 — 키보드 탭 가드 모집단 무접촉", () => {
    expect(budgetScreen()).not.toContain("<ScrollView");
  });

  it("아이가 바뀌면 화면의 초안을 버린다 — A의 숫자가 B의 저장에 실리지 않는다 (리뷰 L-11 예방)", () => {
    const src = budgetScreen();
    // 훅이므로 렌더(단일 return)보다 위에 선다 — 조기 반환이 생기는 날에도 그 규율이 남는다.
    const effect = src.indexOf('  useEffect(() => {\n    setAmountDigits("");\n    setCategoryEdits({});\n  }, [childId]);');
    expect(effect).toBeGreaterThan(-1);
    expect(effect).toBeLessThan(src.indexOf("\n  return (\n"));
    // 오늘 이 화면에는 아이 전환 입구가 없다 — 값은 전역 스토어에서만 온다(그래서 예방이다).
    expect(src).toContain("const childId = useSelectedChildStore((state) => state.selectedChildId);");
  });

  it("standalone: 클라이언트가 다섯째 인자를 로컬 미러의 같은 replace-set으로 라우팅한다 (§3.1)", () => {
    const client = source("src/api/client.ts");
    expect(client).toContain("localBackend.upsertBudget(childId, amountKrw, effectiveYearMonth, categoryBudgets)");
    // 필드 부재 = 무접촉: undefined일 때 본문에 키 자체가 실리지 않는다(§2.2).
    expect(client).toContain("categoryBudgets === undefined");
    expect(client).toContain("? { yearMonth: effectiveYearMonth, amountKrw }");
  });

  it("홈 경고는 총액 유지 — 홈·경고 판정 표면은 카테고리 예산을 모른다 (§4.4 0바이트)", () => {
    for (const path of ["app/(tabs)/index.tsx", "src/home/budget-warning.ts", "src/notifications/generators.ts"]) {
      expect(source(path), `${path} 는 카테고리 예산 0접촉이어야 한다`).not.toContain("categoryBudget");
    }
  });
});
