import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isItemNameMissingForSave,
  resolveDefaultPaymentMethod,
  ITEM_NAME_REQUIRED_NOTICE,
  CATEGORY_REQUIRED_NOTICE
} from "./entry-form-guards";
import { buildSuggestSourceRows } from "./suggest-source";

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

  /**
   * ⚠️ 두 시점(라운드 96 T3) — 힌트는 승인 원본의 10이 아니라 **11**이다. 이 저장소의 최소
   * 본문 활자는 11이고(헤더 부제·안내 줄 전부 11), 이 힌트만 10으로 태어나 앱에서 가장 작은
   * 글자였다. EXP-001 기준 이미지에는 이 힌트가 없다(아코디언을 펼쳐야 그려진다 — 비세션
   * 초기 렌더 밖) — 승인 원본 수치에서 갈라진 유일한 항목이고, 그 사실을 여기 값으로 적는다.
   */
  it("라벨 12/800(minH 34, 2줄)·힌트 11/700이다 (T3: 10 → 11 격상)", () => {
    const start = newExpenseSource.indexOf("const quickExpenseCategoryTileStyle = StyleSheet.create({");
    const block = newExpenseSource.slice(start, newExpenseSource.indexOf("\n});", start));
    expect(block).toContain("fontSize: 12");
    expect(block).toContain('fontWeight: "800"');
    expect(block).toContain("minHeight: 34");
    expect(block).toContain("fontSize: 11");
    // 승인 원본의 10으로 조용히 되돌아가지 않는다(두 시점 위 주석).
    expect(block).not.toContain("fontSize: 10");
    // 두 줄까지 균형 있게 놓이도록 한 줄 자르기(numberOfLines={1})는 쓰지 않는다.
    const tileStart = newExpenseSource.indexOf("function ExpenseCategoryIconButton");
    const tileEnd = newExpenseSource.indexOf("function ExpenseQuickItemButton");
    expect(tileStart, "타일 컴포넌트 선언이 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
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
    // 미래 날짜 거부 자체는 종전 그대로다 — 라운드 68 A로 그 판정이 순수 모듈 한 벌
    // (src/expenses/entry-form-guards.ts)로 걷혔을 뿐, 문장도 조건도 바뀌지 않았다.
    expect(newExpenseSource).toContain("validateExpenseDateInput(cleaned);");
    const guardsSource = readFileSync(join(process.cwd(), "src/expenses/entry-form-guards.ts"), "utf8");
    expect(guardsSource).toContain('if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";');
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

  /**
   * ⚠️ 두 시점(라운드 96 T3) — 숫자는 승인 원본의 22가 아니라 **28/34**다. 금액은 이 화면의
   * 가장 중요한 숫자인데 148px 고정 상자 속 22px로, 같은 요약바의 품목명(15)과 한 급 차이였다.
   * 상자도 고정 폭 대신 flex 배분(148은 minWidth 하한)이다. '원' 14/800 위계·beige/mainCoral
   * 문법·낭독 규칙은 승인 원본 그대로다. 이 변화는 **비세션(EXP-001)에도 렌더된다** — 기준
   * 이미지 재캡처가 이 트랙의 변경 요청 문서와 함께 간다(결제 수단 세그먼트와 한 라운드).
   * 토스 리뷰 M 후속: 그 변경 요청 문서는 스크래치패드에만 있어 저장소가 근거 없이 어긋난
   * 상태였다 — `docs/dev/toss-T3-entry-EXP001-change-request.md`로 승격 커밋됐다(기준 이미지
   * 교체는 여전히 승인 후 Android 재캡처 몫).
   */
  it("숫자 28/800(lineHeight 34) + '원' 14/800으로 위계가 갈리고, 소리에는 단위가 붙은 쪽을 넘긴다", () => {
    expect(newExpenseSource).toContain("const amountInputDisplay = formatAmountDigits(amountText);");
    expect(newExpenseSource).toContain("value={amountInputDisplay}");
    expect(newExpenseSource).toContain("accessibilityValue={{ text: formattedAmount }}");
    expect(newExpenseSource).toContain('<Text style={{ color: theme.colors.gray600, fontSize: 14, fontWeight: "800" }}>원</Text>');
    // '₩'는 코드 어디에도 없다(src/money.ts 규칙 + EXP-001 캡처와 같은 표기).
    expect(newExpenseSource).toContain('const quickExpenseAmountPreview = "38,500원";');
    // T3 격상 pin: 22로 조용히 되돌아가지 않는다.
    expect(newExpenseSource).toContain("fontSize: 28");
    expect(newExpenseSource).toContain("lineHeight: 34");
    expect(newExpenseSource).not.toContain("fontSize: 22,\n                  fontVariant");
  });

  it("T3: 금액 상자는 고정 폭이 아니라 flex 배분이다(148은 하한으로만 남는다)", () => {
    const boxStart = newExpenseSource.indexOf("backgroundColor: theme.colors.beige");
    expect(boxStart).toBeGreaterThan(0);
    const box = newExpenseSource.slice(boxStart, boxStart + 400);
    expect(box).toContain("flex: 1");
    expect(box).toContain("minWidth: 148");
    // 종전의 고정 폭 분기는 남아 있지 않다.
    expect(newExpenseSource).not.toContain("width: width >= 600 ? 220 : 148");
  });

  it("연속 기록 버튼 배치와 저장 가드가 그대로다", () => {
    // GAP-056 #1: 두 버튼이 지나는 가드에 **텍스트 길이 상한**이 합류하면서 판정 이름이
    // isAmountInvalid -> isSaveBlocked로 넓어졌다(금액 가드는 그 안에 그대로 있다). 지키려는
    // 것은 종전과 같다 — 저장 버튼 둘이 **같은 한 줄**을 지난다(규칙이 두 벌이 되지 않는다).
    // 라운드 58 통합리뷰 P1-1: 아이 어긋남 가드가 같은 줄에 합류했다(한 줄이라는 사실이 계약이다).
    expect(newExpenseSource).toContain(
      "const isSaveBlocked = isAmountInvalid || textOverLimitNotices.length > 0 || failedRowChildMismatch;"
    );
    expect(newExpenseSource.match(/disabled=\{saveExpense\.isPending \|\| isSaveBlocked\}/g) ?? []).toHaveLength(2);
    expect(newExpenseSource.match(/expenseGate\.guard\(/g) ?? []).toHaveLength(2);
    expect(newExpenseSource).toContain("{authToken && canContinueRecording({ linkedItemTemplateId }) ? (");
  });
});

/**
 * 라운드 96 T3 — 지출 입력 시트의 마찰 제거 계약.
 *
 * 순수 판정(entry-form-guards.ts의 두 신설 함수·안내 문구)과 그 배선(new.tsx·_layout.tsx)을
 * 함께 붙든다. 화면은 vitest에서 렌더할 수 없으므로 배선은 이 파일의 소스 계약 방식 그대로다.
 */
describe("T3 — 품목명 사전 안내 (isItemNameMissingForSave)", () => {
  it("세션이 있는데 품목명이 비면 막는다(공백만도 빈 것)", () => {
    expect(isItemNameMissingForSave({ hasSession: true, itemName: "" })).toBe(true);
    expect(isItemNameMissingForSave({ hasSession: true, itemName: "   " })).toBe(true);
  });

  it("품목명이 있으면 막지 않는다", () => {
    expect(isItemNameMissingForSave({ hasSession: true, itemName: "기저귀" })).toBe(false);
    expect(isItemNameMissingForSave({ hasSession: true, itemName: "하기스 밴드형 4단계" })).toBe(false);
  });

  it("세션 없는 프리뷰/EXP-001 캡처 경로는 언제나 통과한다(저장 자체가 없다)", () => {
    expect(isItemNameMissingForSave({ hasSession: false, itemName: "" })).toBe(false);
  });

  it("안내 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018 · 분류 안내와 같은 문형)", () => {
    expect(ITEM_NAME_REQUIRED_NOTICE).toBe("품목명을 적어 주시면 바로 저장할게요");
    expect(ITEM_NAME_REQUIRED_NOTICE.endsWith("요")).toBe(true);
    for (const blaming of ["안 적었", "입력하지", "누락", "필수", "오류"]) {
      expect(ITEM_NAME_REQUIRED_NOTICE).not.toContain(blaming);
    }
    // 분류 안내와 같은 꼬리("… 주시면 바로 저장할게요") — 두 안내가 한 목소리로 말한다.
    expect(CATEGORY_REQUIRED_NOTICE.endsWith("주시면 바로 저장할게요")).toBe(true);
    expect(ITEM_NAME_REQUIRED_NOTICE.endsWith("주시면 바로 저장할게요")).toBe(true);
  });
});

describe("T3 — 결제 수단 기본값 (resolveDefaultPaymentMethod)", () => {
  const knownValues = ["card", "cash", "transfer", "mobile_pay"];

  it("가장 앞(최근) 행의 아는 결제 수단을 돌려준다", () => {
    expect(
      resolveDefaultPaymentMethod({
        hasSession: true,
        prefilledPaymentMethod: null,
        rows: [{ paymentMethod: "cash" }, { paymentMethod: "card" }],
        knownValues
      })
    ).toBe("cash");
  });

  it("결제 수단이 없는 행·모르는 값은 건너뛴다 (unknown을 기본값으로 지어내지 않는다)", () => {
    expect(
      resolveDefaultPaymentMethod({
        hasSession: true,
        prefilledPaymentMethod: null,
        rows: [{}, { paymentMethod: null }, { paymentMethod: "unknown" }, { paymentMethod: "transfer" }],
        knownValues
      })
    ).toBe("transfer");
  });

  it("프리필이 결제 수단을 정했으면 최근값 추정이 끼지 않는다(null)", () => {
    expect(
      resolveDefaultPaymentMethod({
        hasSession: true,
        prefilledPaymentMethod: "card",
        rows: [{ paymentMethod: "cash" }],
        knownValues
      })
    ).toBeNull();
  });

  it("비세션(EXP-001 캡처)·빈 이력은 null — 화면은 종전 그대로 0(카드)에서 시작한다", () => {
    expect(
      resolveDefaultPaymentMethod({ hasSession: false, prefilledPaymentMethod: null, rows: [{ paymentMethod: "cash" }], knownValues })
    ).toBeNull();
    expect(resolveDefaultPaymentMethod({ hasSession: true, prefilledPaymentMethod: null, rows: [], knownValues })).toBeNull();
  });

  it("통합 제안 원천이 결제 수단을 그대로 나른다(있으면 그대로, 없으면 키 없음)", () => {
    const rows = buildSuggestSourceRows({
      childId: "child-1",
      localRows: [
        {
          childId: "child-1",
          pendingDelete: false,
          createdAt: "2026-09-04T09:00:00.000Z",
          payload: { itemName: "기저귀", amountKrw: 38_500, categoryId: "c1", paymentMethod: "cash" }
        }
      ],
      currentMonthRows: [
        { id: "s1", itemName: "분유", amountKrw: 32_400, categoryId: "c2", spentOn: "2026-09-01", paymentMethod: "card" },
        { id: "s2", itemName: "물티슈", amountKrw: 8_900, categoryId: "c3", spentOn: "2026-08-30" }
      ]
    });
    expect(rows.map((row) => row.paymentMethod)).toEqual(["cash", "card", undefined]);
    // 로컬(가장 최근 입력)이 앞이므로 기본값 판정도 로컬의 값이 이긴다.
    expect(
      resolveDefaultPaymentMethod({
        hasSession: true,
        prefilledPaymentMethod: null,
        rows,
        knownValues
      })
    ).toBe("cash");
  });
});

describe("T3 — 화면 배선 (지출 입력 시트)", () => {
  const layoutSource = source("app/_layout.tsx");

  it("품목명 블록(필수)이 '바로 기록' 그리드 아래·아코디언 위에 선다", () => {
    const grid = newExpenseSource.indexOf('accessibilityLabel="바로 기록 분류"');
    const itemNameField = newExpenseSource.indexOf('accessibilityLabel="품목명 입력"');
    const accordions = newExpenseSource.indexOf("분류별 빠른 품목</Text>");
    const merchantField = newExpenseSource.indexOf('accessibilityLabel="판매처 입력 (선택)"');
    expect(grid).toBeGreaterThan(0);
    expect(itemNameField).toBeGreaterThan(grid);
    expect(accordions).toBeGreaterThan(itemNameField);
    // 선택 필드(판매처)는 여전히 그 아래다 — 필수가 선택 앞에 선다.
    expect(merchantField).toBeGreaterThan(accordions);
  });

  it("EXP-001 비세션 렌더의 숨은 품목명 입력칸은 원래 자리에 그대로다(노드 순서 불변)", () => {
    expect(newExpenseSource).toContain("{authToken ? null : (");
    const hidden = newExpenseSource.indexOf('<View style={{ display: "none" }}>');
    const paymentCard = newExpenseSource.indexOf('accessibilityLabel="결제 수단 변경"');
    expect(hidden).toBeGreaterThan(paymentCard);
    expect(newExpenseSource.slice(hidden, hidden + 200)).toContain("<TextInput onChangeText={setItemName} value={itemName} />");
  });

  it("결제 수단이 순환 버튼이 아니라 세그먼트다 (어느 값이든 1탭 · 상태는 accessibilityState)", () => {
    // 순환식은 남아 있지 않다.
    expect(newExpenseSource).not.toContain("(value + 1) % quickExpensePaymentMethods.length");
    // 네 값이 전부 보이는 세그먼트. CategoryChip을 **쓰지 않는 이유**가 계약이다: 그 칩의 히트
    // 영역 계약(a11y-contract의 38+hitSlop·칩 줄 수 18 실측 대장)은 이 트랙 밖이라, 세그먼트는
    // 자기 높이(theme.touchTarget)로 최소 터치 타깃을 바로 채운다. 선택 상태는
    // accessibilityState.selected — 라벨에 "선택됨"을 잇지 않는다.
    const segmentStart = newExpenseSource.indexOf('accessibilityLabel="결제 수단 변경"');
    expect(segmentStart).toBeGreaterThan(0);
    const segment = newExpenseSource.slice(segmentStart, segmentStart + 2600);
    expect(segment).toContain("quickExpensePaymentMethods.map((method, index) => {");
    expect(segment).toContain("accessibilityLabel={method.label}");
    expect(segment).toContain("accessibilityState={{ selected: selectedMethod }}");
    expect(segment).toContain("onPress={() => setPaymentMethodIndex(index)}");
    expect(segment).toContain("minHeight: theme.touchTarget");
    expect(segment).not.toContain("<CategoryChip");
    expect(segment).not.toContain("hitSlop");
    expect(segment).not.toContain("선택됨");
  });

  it("결제 수단 기본값 배선: 프리필 초기값 한 줄은 그대로 두고, 최근값은 통합 원천에서 읽는다", () => {
    // recurring-flow.test.ts가 무는 그 한 줄(EXP-001 캡처 불변의 근거)은 그대로다.
    expect(newExpenseSource).toContain("prefilledPaymentMethodIndex >= 0 ? prefilledPaymentMethodIndex : 0");
    // 최근값은 새 요청 없이 suggestRows에서 온다 — 판정은 순수 모듈에 있다.
    expect(newExpenseSource).toContain("const recentPaymentMethod = resolveDefaultPaymentMethod({");
    expect(newExpenseSource).toContain("rows: suggestRows,");
    expect(newExpenseSource).toContain("knownValues: quickExpensePaymentMethods.map((method) => method.value)");
  });

  it("품목명 사전 안내가 분류 안내와 같은 자리·같은 문법으로 배선됐다", () => {
    expect(newExpenseSource).toContain(
      "const isItemNameMissing = isItemNameMissingForSave({ hasSession: Boolean(authToken), itemName });"
    );
    // 한 탭에 두 안내가 함께 선다(두 번 왕복 금지).
    expect(newExpenseSource).toContain("setCategoryNoticeRequested(isCategoryMissing);");
    expect(newExpenseSource).toContain("setItemNameNoticeRequested(isItemNameMissing);");
    expect(newExpenseSource).toContain("if (isCategoryMissing || isItemNameMissing) return false;");
    // 안내 한 줄: 분류 안내 뒤 · 저장 버튼 앞, alert + live region, 한 곳에서만.
    const notice = newExpenseSource.indexOf("{ITEM_NAME_REQUIRED_NOTICE}");
    const categoryNotice = newExpenseSource.indexOf("{CATEGORY_REQUIRED_NOTICE}");
    const saveButton = newExpenseSource.indexOf("label={saveExpense.isPending ?");
    expect(notice).toBeGreaterThan(categoryNotice);
    expect(notice).toBeLessThan(saveButton);
    expect(newExpenseSource.match(/\{ITEM_NAME_REQUIRED_NOTICE\}/g) ?? []).toHaveLength(1);
    const noticeBlock = newExpenseSource.slice(newExpenseSource.lastIndexOf("{showItemNameNotice ? (", notice), notice);
    expect(noticeBlock).toContain('accessibilityRole="alert"');
    expect(noticeBlock).toContain('accessibilityLiveRegion="polite"');
  });

  it("타일이 품목명을 채운 직후에만 커서가 금액으로 옮겨 간다(amountInputRef)", () => {
    expect(newExpenseSource).toContain("const amountInputRef = useRef<TextInput | null>(null);");
    expect(newExpenseSource).toContain("ref={amountInputRef}");
    // 두 자리: 빠른 품목 타일(selectQuickExpenseItem) + 이름을 채운 분류 타일 탭.
    expect(
      newExpenseSource.match(/requestAnimationFrame\(\(\) => amountInputRef\.current\?\.focus\(\)\);/g) ?? []
    ).toHaveLength(2);
    // 이름을 채우지 않은 분기(사용자가 친 이름을 지키는 쪽)에서는 옮기지 않는다 — 포커스 호출이
    // shouldTileFillItemName 분기 **안**에 있다.
    const tilePress = newExpenseSource.indexOf("if (shouldTileFillItemName({ itemName");
    const tileBlockEnd = newExpenseSource.indexOf("\n                  }", tilePress);
    expect(newExpenseSource.slice(tilePress, tileBlockEnd)).toContain("amountInputRef.current?.focus()");
  });

  it("판매처 칩 줄의 펼침/접힘이 reduce-motion을 존중하는 150ms 레이아웃 전환을 탄다", () => {
    expect(newExpenseSource).toContain("const animateSuggestRowLayout = () => {");
    expect(newExpenseSource).toContain("if (reduceMotionEnabled) return;");
    expect(newExpenseSource).toContain("AccessibilityInfo.isReduceMotionEnabled?.()");
    // 펼침은 onPressIn(포커스가 서기 **전**에 다음 레이아웃 전환을 예약한다 — onFocus 한 줄은
    // keyboard-tap-guard가 바이트로 무는 자리라 손대지 않는다), 접힘은 칩 적용에서 탄다.
    expect(newExpenseSource).toContain("onPressIn={animateSuggestRowLayout}");
    expect(newExpenseSource.match(/animateSuggestRowLayout\(\);/g) ?? []).toHaveLength(1);
    // 리뷰 H-2의 복귀 경로 바이트는 그대로다.
    expect(newExpenseSource).toContain("onFocus={() => setMerchantFocused(true)}");
  });

  it("지출 기록 시트는 아래에서 올라온다(slide_from_bottom · reduce-motion이면 none)", () => {
    expect(layoutSource).toContain('name="expenses/new"');
    expect(layoutSource).toContain('animation: reduceMotionEnabled ? "none" : "slide_from_bottom"');
    expect(layoutSource).toContain("AccessibilityInfo.isReduceMotionEnabled?.()");
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
