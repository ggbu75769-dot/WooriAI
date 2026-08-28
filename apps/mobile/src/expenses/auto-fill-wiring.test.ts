import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";

/**
 * UX-C 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어
 * 이 저장소의 관례대로 소스 grep으로 확인한다: src/a11y-contract.test.ts,
 * src/expenses/amount-presets-wiring.test.ts 참고).
 *
 * 지키려는 것:
 * 1) 카테고리 자동 추천과 과거 항목 자동완성이 **순수 모듈**을 통해서만 동작한다 — 화면에
 *    매칭 규칙이 다시 손으로 쓰이면 단위 테스트가 보호하지 못하는 두 번째 구현이 생긴다.
 * 2) 사용자가 카테고리를 직접 고른 뒤에는 추천이 덮어쓰지 않는다(categoryTouchedRef).
 * 3) 두 기능 모두 **캐시만 읽는다** — 이 화면에서 새 요청(useQuery)이 생기지 않는다.
 * 4) 새 UI는 전부 authToken 세션 뒤에 있고, EXP-001 픽셀 락 캡처 계약은 그대로다
 *    (캡처는 app/pixel-lock.tsx가 clearSession 후 /expenses/new로 이동해 세션 없이 찍는다).
 */
const mobileRoot = process.cwd();
const newExpenseSource = readFileSync(join(mobileRoot, "app/expenses/new.tsx"), "utf8");
// GAP-056 #1/#2: 길이 가드와 판매처 자동완성은 **두 입력 화면이 같은 모듈**을 쓴다 — 한쪽만
// 배선되면 같은 값이 화면마다 다른 규칙으로 다뤄지므로 두 소스를 함께 본다.
const editExpenseSource = readFileSync(join(mobileRoot, "app/expenses/[expenseId].tsx"), "utf8");

describe("UX-C quick-expense auto-fill wiring", () => {
  it("drives the category suggestion from the shared pure module", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/category-suggestion"');
    // 라운드 33 F3: 추천 적용/되돌리기 판정 전체가 순수 모듈(resolveAutoCategorySelection)에 있다 --
    // 화면에는 규칙이 한 줄도 없어서 단위 테스트가 실제 동작을 그대로 보호한다.
    expect(newExpenseSource).toContain("const nextSelection = resolveAutoCategorySelection({");
    // 라운드 51 C-#5: 근거가 사라졌을 때 돌아갈 자리가 첫 타일에서 **미선택**으로 바뀌었다.
    expect(newExpenseSource).toContain("defaultCategoryId: null");
    expect(newExpenseSource).not.toContain("defaultCategoryId: quickExpenseCategories[0].id");
    expect(newExpenseSource).toContain("AUTO_CATEGORY_CAPTION");
  });

  it("F3: 자동 선택은 근거가 사라지면 되돌아가고, 그 판정에 현재 선택과 직전 자동 선택을 넘긴다", () => {
    // 화면이 넘기지 않으면 순수 모듈이 "지금 눌려 있는 것이 기계가 고른 값인지" 알 수 없다.
    // 라운드 51 C-#5: 미선택이 가능해지면서 id는 `string | null`이다.
    expect(newExpenseSource).toContain("currentCategoryId: selectedCategoryId");
    expect(newExpenseSource).toContain("const selectedCategoryId = selectedCategory?.id ?? null;");
    expect(newExpenseSource).toContain("autoPicked: autoPickedCategory");
    expect(newExpenseSource).toContain("if (!isSameAutoPickedCategory(autoPickedCategory, nextSelection.autoPicked)) {");
    // 자동 선택 상태는 boolean이 아니라 "어떤 이름으로 무엇을 골랐는지"다.
    expect(newExpenseSource).toContain("useState<AutoPickedCategory | null>(null)");
    expect(newExpenseSource).not.toContain("setAutoPickedCategory(true)");
    expect(newExpenseSource).not.toContain("setAutoPickedCategory(false)");
  });

  it("라운드 51 C-#5: 기본 카테고리 고정이 사라졌고, 모듈 주석이 그 사실을 말한다", () => {
    // 예전 사실(F4): 초기값이 무조건 8타일 중 첫 타일 "기저귀"였다 -- 그래서 추천이 안 붙는
    // 품목이 전부 기저귀로 저장됐다. 그 초기값은 이제 소스에 남아 있지 않다.
    expect(newExpenseSource).not.toContain("useState(prefilledCategory ?? quickExpenseCategories[0])");
    expect(newExpenseSource).toContain("resolveInitialCategoryId({");
    // 카탈로그 순서 자체는 그대로다(픽셀 락 캡처가 첫 타일 하이라이트를 포함한다).
    expect(categoryCatalog[0].label).toBe("기저귀");
    expect(categoryCatalog[0].code).not.toBe("etc");
    const suggestionModuleSource = readFileSync(join(mobileRoot, "src/expenses/category-suggestion.ts"), "utf8");
    // 예전 주석의 거짓 전제("기타는 이미 기본값")가 되살아나지 않는다.
    expect(suggestionModuleSource).not.toContain("기타\"는 이미 기본값");
    // 그리고 "첫 타일이 기본값"이라는 (이제는 옛) 사실이 현재형으로 남아 있지도 않다.
    expect(suggestionModuleSource).toContain("미선택");
    expect(suggestionModuleSource).toContain("라운드 51 C-#5");
  });

  it("drives the typing-linked autocomplete chips from the shared pure module", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/item-autocomplete"');
    expect(newExpenseSource).toContain("buildItemAutocompleteSuggestions(itemName, expenseHistory)");
    expect(newExpenseSource).toContain("formatItemAutocompleteChipLabel(chip, categoryNameForChip(chip.categoryId))");
    // 칩 1탭 = 이름·금액·카테고리 일괄 채움.
    expect(newExpenseSource).toContain("const applyItemAutocompleteChip = (chip: ItemAutocompleteSuggestion) => {");
    expect(newExpenseSource).toContain("setAmountText(String(chip.amountKrw));");
    expect(newExpenseSource).toContain("onPress={() => applyItemAutocompleteChip(chip)}");
  });

  it("never overwrites a category the user picked themselves", () => {
    // UX-L(A): 초기값이 false 고정에서 "프리필로 분류가 함께 왔는가"로 바뀌었다. 지키려는 것은
    // 그대로다 -- 사용자가 고른(= 여기서는 '또 기록'으로 그 기록을 골라서 온) 분류를 추천이
    // 덮어쓰지 않는다. 프리필이 없는 일반 진입에서는 predicate가 false라 예전과 같다.
    expect(newExpenseSource).toContain("const categoryTouchedRef = useRef(prefilledCategory !== null);");
    expect(newExpenseSource).toContain("const prefilledCategory =");
    expect(newExpenseSource).toContain("if (categoryTouchedRef.current) return;");
    // 직접 선택으로 치는 네 경로: 카테고리 타일 / 최근 품목 칩 / 자동완성 칩 / 임시 저장 복원.
    expect(newExpenseSource.match(/categoryTouchedRef\.current = true;/g)?.length).toBeGreaterThanOrEqual(4);
    // 추천은 같은 타일이면 상태를 갈아끼우지 않는다(렌더 루프 방지). 라운드 51 C-#5로 양쪽이
    // null일 수 있어 옵셔널 체이닝으로 비교한다(둘 다 미선택이면 그대로 둔다).
    expect(newExpenseSource).toContain(
      "setSelectedCategory((current) => (current?.id === suggestedCategory?.id ? current : suggestedCategory));"
    );
  });

  it("F3: 자동완성 칩이 카테고리를 못 바꾼 경우에는 추천을 끄지 않는다", () => {
    // 칩의 categoryId가 8타일 밖이면 이 화면은 카테고리를 바꾸지 못한다 -- 그때 touched로 쳐 버리면
    // 사용자가 고른 적 없는데 추천만 영구히 꺼진다. 그래서 표시는 matchedCategory 안에서만 세운다.
    const applyStart = newExpenseSource.indexOf(
      "const applyItemAutocompleteChip = (chip: ItemAutocompleteSuggestion) => {"
    );
    expect(applyStart).toBeGreaterThan(0);
    const applyBlock = newExpenseSource.slice(applyStart, newExpenseSource.indexOf("\n  };", applyStart));
    expect(applyBlock).toContain(
      "if (matchedCategory) {\n      categoryTouchedRef.current = true;\n      setAutoPickedCategory(null);\n      setSelectedCategory(matchedCategory);\n    }"
    );
    // 블록 안에서 touched를 세우는 곳은 그 한 군데뿐이다.
    expect(applyBlock.match(/categoryTouchedRef\.current = true;/g)?.length).toBe(1);
  });

  it("reads only the already-cached month expenses and category names — no new request", () => {
    expect(newExpenseSource).toContain(
      'queryClient.getQueryData<MonthExpenses>(["expenses", childId, currentYearMonth])?.expenses'
    );
    // 칩 부제의 카테고리 이름도 이 화면이 이미 가진 8타일 카탈로그에서만 나온다 — 서버
    // 카테고리 목록을 새로 부르지도, ["categories"] 캐시를 해석하지도 않는다
    // (src/analytics/screen-events.test.ts가 이 화면의 카테고리 캐시 배선을 금지한다).
    expect(newExpenseSource).toContain(
      "const categoryNameForChip = (categoryId: string) =>\n    quickExpenseCategories.find((category) => category.id === categoryId)?.label;"
    );
    // 이 화면은 지출을 저장하는 뮤테이션만 가진다 — 조회 쿼리를 새로 붙이면 시트를 여는 것만으로
    // 네트워크가 돌고, "오프라인 캐시만 사용" 규칙이 깨진다.
    expect(newExpenseSource).not.toContain("useQuery(");
    // 캐시가 없을 때 매 렌더 새 배열을 만들면 추천 useEffect가 무한히 재실행된다.
    expect(newExpenseSource).toContain("const noExpenseHistory: MonthExpenses[\"expenses\"] = [];");
  });

  it("labels the autocomplete chips for screen readers", () => {
    expect(newExpenseSource).toContain(
      "accessibilityLabel={itemAutocompleteChipAccessibilityLabel(chip, categoryNameForChip(chip.categoryId))}"
    );
    expect(newExpenseSource).toContain('accessibilityRole="button"');
  });

  it("keeps the autocomplete row under the 품목명 field and the caption under the category grid", () => {
    const itemNameFieldStart = newExpenseSource.indexOf('accessibilityLabel="품목명 입력"');
    const autocompleteStart = newExpenseSource.indexOf("itemAutocompleteChips.map");
    const captionStart = newExpenseSource.indexOf("{AUTO_CATEGORY_CAPTION}");
    const categoryGridStart = newExpenseSource.indexOf("quickExpenseCategoryGridStyle.grid");

    expect(itemNameFieldStart).toBeGreaterThan(0);
    // 타이핑 연동 자동완성은 품목명 입력칸 바로 아래에 붙는다 — 폼 상단의 "최근 품목"
    // 칩(EXP-113, 타이핑과 무관한 최근 N건)과 자리도 트리거도 구분된다.
    expect(autocompleteStart).toBeGreaterThan(itemNameFieldStart);
    expect(newExpenseSource.indexOf("recentItemChips.map")).toBeLessThan(itemNameFieldStart);
    // 캡션은 카테고리 그리드 바로 아래.
    expect(captionStart).toBeGreaterThan(categoryGridStart);
  });

  it("renders every new affordance behind the session gate, keeping the EXP-001 capture unchanged", () => {
    for (const marker of ["itemAutocompleteChips.map", "{AUTO_CATEGORY_CAPTION}"]) {
      const markerStart = newExpenseSource.indexOf(marker);
      expect(markerStart, marker).toBeGreaterThan(0);
      const before = newExpenseSource.slice(0, markerStart);
      // 가장 가까운 조건부 블록이 열려 있는 authToken 게이트여야 한다.
      const gateStart = Math.max(before.lastIndexOf("{authToken ? ("), before.lastIndexOf("{authToken && autoPickedCategory ? ("));
      expect(gateStart, marker).toBeGreaterThan(before.lastIndexOf(") : null}"));
    }
    // 추천 effect 자체도 세션이 없으면 돌지 않는다.
    expect(newExpenseSource).toContain("if (!authToken) return;\n    if (categoryTouchedRef.current) return;");
    // 픽셀 락 계약 불변: 캡처 조건과 캡처 문자열은 그대로.
    expect(newExpenseSource).toContain('const isPixelLockAmountCapture = !authToken && amountText === "38500";');
    expect(newExpenseSource).toContain('const quickExpenseAmountPreview = "38,500원";');
    // UX-L(A): 세션이 있을 때의 초기 금액이 "빈 문자열 고정"에서 "프리필 금액(없으면 빈 칸)"이
    // 됐다. 캡처 조건(세션 없음)에서는 프리필이 올 수 없어 여전히 고정 시드 "38500"이다 --
    // EXP-001 기준 이미지는 그대로이고, 시트를 여는 것만으로 금액이 생기지도 않는다.
    expect(newExpenseSource).toContain(
      'const [amountText, setAmountText] = useState(() => (authToken ? prefill.amountText : "38500"));'
    );
  });
});

/**
 * GAP-056 #2 (라운드 56 E 잔여) — 판매처 자동완성 배선 계약.
 *
 * 지키려는 것:
 * 1) 후보 계산은 **순수 모듈 하나**(src/expenses/merchant-suggest.ts)에서만 나온다 — 두 화면이
 *    각자 매칭·정렬을 쓰면 같은 글자에 다른 후보가 나오고, 단위 테스트가 그것을 못 잡는다.
 * 2) 원천은 이미 받아 둔 이번 달 캐시뿐이다(새 요청 0건).
 * 3) 빠른 기록 시트의 칩 줄은 **포커스 게이트 + authToken 게이트** 뒤에 있다 — 휴지 상태
 *    픽셀과 EXP-001 캡처가 그대로다.
 * 4) 지출 상세는 **자기 행을 후보에서 뺀다** — 방금 지운 자기 값을 되돌려 주는 칩을 만들지 않는다.
 */
describe("GAP-056 #2 판매처 자동완성 배선", () => {
  it("두 화면 모두 후보를 공용 순수 모듈에서 받는다", () => {
    for (const source of [newExpenseSource, editExpenseSource]) {
      expect(source).toContain('from "../../src/expenses/merchant-suggest"');
      expect(source).toContain("buildMerchantSuggestions(");
      // 라벨·스크린리더 문장도 모듈이 만든다(화면에 문구를 다시 쓰면 두 문장으로 갈린다).
      expect(source).toContain("formatMerchantSuggestionChipLabel(suggestion)");
      expect(source).toContain("accessibilityLabel={merchantSuggestionChipAccessibilityLabel(suggestion)}");
      expect(source).toContain('accessibilityRole="button"');
    }
  });

  it("빠른 기록 시트: 포커스 게이트로만 열리고, 캐시(expenseHistory)만 읽는다", () => {
    expect(newExpenseSource).toContain("const [merchantFocused, setMerchantFocused] = useState(false);");
    expect(newExpenseSource).toContain(
      "authToken && merchantFocused ? buildMerchantSuggestions(merchant, expenseHistory) : []"
    );
    expect(newExpenseSource).toContain("onFocus={() => setMerchantFocused(true)}");
    // 새 요청이 생기지 않는다(이 화면의 useQuery 금지 계약은 위 describe가 이미 고정한다).
    expect(newExpenseSource).not.toContain("useQuery(");
  });

  it("빠른 기록 시트: 칩 탭은 판매처 한 칸만 채우고 줄을 접는다", () => {
    expect(newExpenseSource).toContain("const applyMerchantSuggestion = (merchantName: string) => {");
    expect(newExpenseSource).toContain("setMerchant(merchantName);");
    expect(newExpenseSource).toContain("onPress={() => applyMerchantSuggestion(suggestion.merchant)}");
    // 금액·분류는 이 후보가 아는 사실이 아니다 — 품목 자동완성 칩과 달리 함께 바꾸지 않는다.
    const applyStart = newExpenseSource.indexOf("const applyMerchantSuggestion = (merchantName: string) => {");
    const applyBlock = newExpenseSource.slice(applyStart, newExpenseSource.indexOf("\n  };", applyStart));
    expect(applyBlock).not.toContain("setAmountText(");
    expect(applyBlock).not.toContain("setSelectedCategory(");
    // "저장하고 계속 기록"의 폼 초기화도 칩 줄을 접는다(다음 항목의 휴지 상태 = 첫 진입).
    expect(newExpenseSource).toContain("setMerchantFocused(false);");
  });

  it("빠른 기록 시트: 칩 줄이 authToken 게이트 안에 있다 (EXP-001 캡처 불변)", () => {
    const markerStart = newExpenseSource.indexOf("merchantSuggestions.map");
    expect(markerStart).toBeGreaterThan(0);
    const before = newExpenseSource.slice(0, markerStart);
    const gateStart = before.lastIndexOf("{authToken ? (");
    expect(gateStart).toBeGreaterThan(before.lastIndexOf(") : null}"));
  });

  it("지출 상세: 같은 캐시를 useMemo로 읽고 자기 행을 뺀다", () => {
    expect(editExpenseSource).toContain(
      "buildMerchantSuggestions(merchant, (cachedMonthExpenses ?? []).filter((row) => row.id !== expenseId))"
    );
    expect(editExpenseSource).toContain("const merchantSuggestions = useMemo(");
    expect(editExpenseSource).toContain("[merchant, cachedMonthExpenses, expenseId]");
    expect(editExpenseSource).toContain("onPress={() => setMerchant(suggestion.merchant)}");
  });
});

/**
 * GAP-056 #1 (라운드 56 A 잔여) — 빠른 기록 시트의 텍스트 길이 가드 배선 계약.
 *
 * 지키려는 것: 상한 숫자·문구가 **화면에 다시 적히지 않고**(단일 소스는 text-limits.ts, 서버
 * `@MaxLength`와 같은 값), 저장이 **로컬 쓰기 전에** 막힌다. 여기서 통과시키면 오프라인
 * 아웃박스가 로컬 저장을 먼저 성공시키고 flush에서 400을 만나 영구 실패 행이 된다.
 */
describe("GAP-056 #1 텍스트 길이 가드 배선 (빠른 기록 시트)", () => {
  it("세 입력칸의 maxLength가 공용 상수에서 온다", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/text-limits"');
    expect(newExpenseSource).toContain("maxLength={ITEM_NAME_MAX_LENGTH}");
    expect(newExpenseSource).toContain("maxLength={MERCHANT_MAX_LENGTH}");
    expect(newExpenseSource).toContain("maxLength={MEMO_MAX_LENGTH}");
    // 숫자를 화면에 다시 적지 않는다.
    expect(newExpenseSource).not.toContain("maxLength={100}");
    expect(newExpenseSource).not.toContain("maxLength={500}");
  });

  it("안내 문구도 같은 모듈에서 오고, 저장 버튼을 함께 잠근다", () => {
    expect(newExpenseSource).toContain("itemNameOverLimitMessage()");
    expect(newExpenseSource).toContain("merchantOverLimitMessage()");
    expect(newExpenseSource).toContain("memoOverLimitMessage()");
    expect(newExpenseSource).toContain("const isSaveBlocked = isAmountInvalid || textOverLimitNotices.length > 0;");
    expect(newExpenseSource).toContain("{textOverLimitNotices.map((notice) => (");
    // 문구를 화면에 다시 쓰지 않는다(지출 상세와 두 문장으로 갈리지 않게).
    expect(newExpenseSource).not.toContain("자까지 입력할 수 있어요");
  });

  it("저장 직전 가드가 **보낼 값 그대로**를 한 번 더 본다 (지출 상세와 같은 이중 가드)", () => {
    expect(newExpenseSource).toContain(
      "hasExpenseTextOverLimit({ itemName, merchant: merchant.trim(), memo })"
    );
    // 지출 상세도 같은 모듈의 판정을 로컬 저장 전에 통과한다.
    expect(editExpenseSource).toContain('from "../../src/expenses/text-limits"');
    expect(editExpenseSource).toContain("isMerchantOverLimit(trimmedMerchant)");
  });
});
