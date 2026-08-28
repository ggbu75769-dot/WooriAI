import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");
const detailSource = () => source("app/items/[itemTemplateId].tsx");

/**
 * 라운드 49 트랙 A(커머스 왕복 개통)의 **화면 배선** 회귀 가드.
 *
 * 판정과 문구는 전부 순수 모듈(src/items/*.ts)에 있고 각자의 단위 테스트가 지킨다. 여기서
 * 보는 것은 그 모듈이 실제로 화면에 **연결돼 있는가**뿐이다 — 라운드 49 이전의 세 구멍이
 * 전부 "서버·모듈에는 값이 있는데 화면이 그것을 쓰지 않는다"였기 때문이다:
 *
 *  - C-01: 상세의 찜하기가 저장하는 `interested`에 목록에서 도달할 방법이 없었다.
 *  - C-02: DTO의 분류(categoryId)를 프리필이 버려서 분류가 늘 기본 타일로 떨어졌다.
 *  - C-04: 연결된 지출(child_item_statuses.expense_id)이 상세에 한 번도 보이지 않았다.
 *  - C-07: 로그인 상태인데 아이만 안 골랐을 때 **픽셀 락용 가짜 상품/별점**이 그려졌다.
 */
describe("C-01 찜 칩 (클라이언트 필터, 서버 왕복 0)", () => {
  it("상태 칩 줄에 찜 칩이 붙고, 문구는 순수 모듈에서 가져온다", () => {
    const items = itemsSource();
    expect(items).toContain("INTERESTED_FILTER_LABEL");
    expect(items).toContain("label={INTERESTED_FILTER_LABEL}");
    // 문구를 화면에 인라인하지 않는다 -- 모듈이 단일 소스다.
    expect(items).not.toContain('label="찜한 것만"');
  });

  it("새 요청을 만들지 않는다 -- 이미 받아 둔 tab=\"all\" 스냅샷을 거른다", () => {
    const items = itemsSource();
    // DSN-053 P2-B: 그 스냅샷이 곧 목록이라(상태 탭 조회 없음) 찜은 같은 배열을 한 번 더
    // 거르는 클라이언트 필터로 남는다.
    expect(items).toContain("filterInterestedItems(visibleItems)");
    expect(items).toContain('listItems(authToken!, childId!, "all")');
    expect(items).not.toContain('listItems(authToken!, childId!, "interested"');
    // 목록 쿼리 키에도 찜이 끼지 않는다 = 칩을 눌러도 캐시가 갈리지 않는다.
    expect(items).toContain('queryKey: ["items", childId, "catalog"]');
  });

  it("찜을 끄면 보던 목록이 그대로 돌아온다 (다른 상태를 건드리지 않는다)", () => {
    const items = itemsSource();
    expect(items).toContain("const [showInterestedOnly, setShowInterestedOnly] = useState(false);");
    expect(items).toContain("onPress={() => setShowInterestedOnly((on) => !on)}");
    expect(items).toContain("selected={showInterestedOnly}");
  });

  it("찜 목록이 시기 칩을 따르지 않는다는 사실을 화면이 그 자리에서 밝힌다", () => {
    const items = itemsSource();
    expect(items).toContain("{INTERESTED_FILTER_SCOPE_NOTE}");
  });

  it("스냅샷이 오기 전/실패했을 때 다른 목록을 찜 목록인 척 그리지 않는다", () => {
    const items = itemsSource();
    // DSN-053 P2-B: 찜의 원천이 목록 그 자체가 됐다 -- 스냅샷이 아직 없으면 화면 전체가
    // 스켈레톤이고 실패하면 재시도 카드다(별도 분기를 둘 필요가 없어졌다).
    expect(items).toContain('if (hasSession && itemsPhase === "error") {');
    expect(items).toContain('if (hasSession && itemsPhase === "loading") {');
    expect(items).toContain("onPress={() => items.refetch()}");
    // 실패 문구도 오프라인 인지 공용 소스를 쓴다(UX-N).
    expect(items).toContain("const loadErrorCopy = useLoadErrorCopy(items.isError);");
  });

  it("찜 칩이 세션 렌더에만 있다 (ITEM-001 비세션 캡처 불변)", () => {
    const items = itemsSource();
    const previewReturnIndex = items.indexOf("if (!hasSession) {");
    const chipIndex = items.indexOf("label={INTERESTED_FILTER_LABEL}");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    expect(chipIndex).toBeGreaterThan(previewReturnIndex);
    // 비세션 미리보기 픽스처(ITEM-001 기준 이미지)는 그대로 남아 있다.
    expect(items).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");
  });

  it("빈 화면은 '찜이 없다'와 '필터에 안 맞는다'를 구분하고, 초기화는 찜도 함께 푼다", () => {
    const items = itemsSource();
    expect(items).toContain("const showInterestedEmptyState = showInterestedOnly && !isNarrowedByFilter;");
    expect(items).toContain("title={INTERESTED_FILTER_EMPTY_TEXT}");
    const resetBlock = items.slice(items.indexOf('actionLabel="필터 초기화"'), items.indexOf('actionLabel="홈으로 가기"'));
    expect(resetBlock).toContain("setShowInterestedOnly(false);");
  });
});

describe("C-02 준비템 -> 지출 분류 프리필", () => {
  it("목록: 프롬프트를 남길 때 그 행의 분류를 함께 박아 둔다 (행이 사라진 뒤에도 쓰려고)", () => {
    const items = itemsSource();
    expect(items).toContain("categoryId: variables.categoryId,");
    expect(items).toContain("categoryId: item.categoryId, status });");
  });

  it("목록: 인라인 줄도 분류를 넘긴다 (두 자리의 프리필이 갈리지 않는다)", () => {
    const items = itemsSource();
    expect(items).toContain("categoryId: item.categoryId");
    expect(items).toContain("categoryId: prompt.categoryId");
  });

  it("상세: 두 진입점 모두 같은 조립기로 분류를 넘긴다", () => {
    const detail = detailSource();
    const calls =
      detail.split("{ itemName: visibleDetail.name, itemTemplateId, categoryId: visibleDetail.categoryId },").length - 1;
    expect(calls).toBe(2);
  });

  /**
   * 금액 프리필 금지. 준비템이 가진 값은 가격대(priceBandText)라 범위이고, 그 안의 한 값을
   * 골라 금액 칸에 넣으면 사용자가 쓰지 않은 금액을 앱이 지어내게 된다.
   */
  it("두 화면 어디에서도 금액(amountKrw)을 프리필하지 않는다", () => {
    expect(itemsSource()).not.toContain("amountKrw:");
    expect(detailSource()).not.toContain("amountKrw:");
  });

  /** new.tsx(트랙 B 소유)의 프리필 계약은 손대지 않는다 — 이미 categoryId를 읽고 있다. */
  it("/expenses/new의 프리필 계약은 그대로 재사용한다", () => {
    expect(source("app/expenses/new.tsx")).toContain("parseExpensePrefillParams(params)");
    expect(source("src/expenses/record-row-actions.ts")).toContain("categoryId: string | null;");
  });
});

describe("C-04 준비템 상세의 연결 지출 (역링크)", () => {
  it("판정·문구는 순수 모듈이 하고, 화면은 그리기만 한다", () => {
    const detail = detailSource();
    expect(detail).toContain("items/linked-expense");
    expect(detail).toContain("linkedExpenseRow({ hasSession, linkedExpense: visibleDetail.linkedExpense })");
    // 화면이 금액/날짜를 직접 조립하지 않는다.
    expect(detail).toContain("label={linkedExpense.text}");
    expect(detail).toContain("accessibilityLabel={linkedExpense.accessibilityLabel}");
  });

  it("값이 있을 때만 그리고, 누르면 그 지출 상세로 간다", () => {
    const detail = detailSource();
    expect(detail).toContain("{linkedExpense ? (");
    expect(detail).toContain("router.push(linkedExpense.href)");
    expect(source("src/items/linked-expense.ts")).toContain("`/expenses/${expense.id}`");
  });

  /**
   * DNC-010: 제휴 고지와 구매 CTA 사이에는 아무것도 끼우지 않는다. 이 줄은 정보 카드 안
   * (준비 상태 배지 아래)이라 그 인접 구간을 지나지 않는다.
   */
  it("제휴 고지-구매 CTA 인접 구간을 건드리지 않는다 (DNC-010)", () => {
    const detail = detailSource();
    const rowIndex = detail.indexOf("{linkedExpense ? (");
    const disclosureIndex = detail.indexOf("<AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    expect(rowIndex).toBeGreaterThan(-1);
    expect(rowIndex).toBeLessThan(disclosureIndex);
    expect(disclosureIndex).toBeLessThan(ctaIndex);
  });
});

describe("C-07 목록 프리뷰 게이트 정직화", () => {
  /**
   * 예전에는 `hasSession = Boolean(authToken && childId)` 하나로 갈라져, **로그인은 했지만
   * 아이만 안 골라진** 상태에서도 픽셀 락 캡처용 픽스처(가짜 상품 3개 + "★ 4.7 (1,245)")가
   * 자기 데이터인 양 그려졌다.
   */
  it("토큰이 있는데 아이가 없으면 픽스처 대신 안내 상태를 보여준다", () => {
    const items = itemsSource();
    expect(items).toContain("if (authToken && !childId) {");
    const gate = items.slice(items.indexOf("if (authToken && !childId) {"), items.indexOf("if (hasSession && itemsPhase === \"error\")"));
    expect(gate).toContain("아이를 먼저 선택해 주세요.");
    expect(gate).toContain('router.push("/settings/children")');
    expect(gate).not.toContain("previewItems");
  });

  it("비세션(authToken === null) 분기는 한 픽셀도 바뀌지 않는다 (ITEM-001)", () => {
    const items = itemsSource();
    // 미리보기 픽스처와 그 캡션/배지는 그대로다.
    expect(items).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");
    expect(items).toContain('const recommendationPreviewCaptions = ["★ 4.7 (1,245)", "★ 4.8 (2,154)", "★ 4.6 (982)"] as const;');
    expect(items).toContain('id: "preview-baby-carrier-hipseat"');
    // 새 게이트는 authToken이 있을 때만 걸린다 -- 비세션은 그 조건을 통과하지 못한다.
    expect(items).not.toContain("if (!authToken) {\n    return (");
  });
});
