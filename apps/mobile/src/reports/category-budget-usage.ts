import { buildCategoryNameLookup, selectableCategories, type SelectableCategory } from "../categories";
// 퍼센트·초과 판정은 홈 히어로·인사이트·끝난 달 한 줄과 **같은 함수** 하나다(§4.3 — 반올림과
// "미소진 100% 금지" 캡이 그 안에 있다. 판정 두 벌 금지). "다 썼는가"의 경계도 같은 모듈의
// 같은 술어다(라운드 102 리뷰 L-1 — 아래 secondaryText 주석).
import { evaluateHomeBudgetProgress, isBudgetUsedUp } from "../home/budget-progress";
// 별칭/정식 가족 합류의 단일 소스(§5.1 — 새 매핑 코드 0건): 기록 탭 칩의 matchIds 그대로다.
import { buildRecordsCategoryChips } from "../expenses/records-list-view";
import { formatKrw } from "../money";

/**
 * 라운드 102 T3 — 리포트 월간 탭 "카테고리 예산" 블록의 조립 순수 로직
 * (docs/5차/round102-category-budget-design.md §4.3·§5.1·§9.6).
 *
 * ## 입력과 모집단 (없는 것을 지어내지 않는다 — §5.2)
 * - **예산**: 월간 리포트 응답의 `categoryBudgets`(§2.4 — 그 달 행, 없으면 빈 블록). 예산이
 *   없는 카테고리는 행이 없다 — 사용자가 정한 적 없는 기준선을 만들지 않는다.
 * - **사용액**: 도넛과 **같은 응답**(GET /reports/category — 원 id 단위, 선물·환불 제외 서버
 *   집계 DNC-015)을 칩 대장의 `matchIds` 가족으로 접는다: 사용액 = Σ breakdown[id ∈ matchIds].
 *   기록 탭에서 그 칩을 누르면 보이는 지출들의 합이 곧 이 예산의 사용액이다 — **필터가
 *   보여주는 것과 예산이 세는 것이 같은 집합**(§5.1의 정직성). 그래서 카테고리 목록이 아직
 *   없으면(이름도 가족도 모른다) 행을 만들지 않는다 — 정식 id 완전 일치로만 합하면 퀵타일
 *   지출이 통째로 빠진 가짜 사용액이 된다.
 * - **문구**: 행 `"{이름} {사용액} / 예산 {예산액}"` + 보조 한 줄. 초과 행은 "예산보다 N원 더
 *   썼어요", 정확히 다 쓴 행은 "예산을 모두 썼어요", 그 아래는 "예산의 N%를 썼어요" — 전부
 *   관측 사실만(DNC-018: 지출 억제 권고 금지). 세 갈래를 가르는 경계는 홈 히어로·넛지와 **같은
 *   한 술어**다(`isBudgetUsedUp`, `>=` — 리뷰 L-1). 색으로만 말하지 않는다(문장이 의미를
 *   지고, 경고색은 쓰지 않는다 — budget-warning의 관례).
 *
 * 이름 뒤 조사는 없다(§6.3 — 이름은 문두 명사구). 정렬은 칩 대장 순서가 지고, 칩 대장 밖의
 * 예산 행(운영자가 숨긴 카테고리 등)은 includeAll 이름 해석과 함께 앞에 선다(§6.5 기존 유지 —
 * 예산 화면의 끼워 유지와 같은 자리·같은 순서 규칙).
 *
 * React/react-native/네트워크 의존 없음 — vitest 단위 검증 대상(completed-month-budget.ts와
 * 같은 관례).
 */

export type CategoryBudgetUsageRow = {
  categoryId: string;
  name: string;
  /** "{이름} {사용액} / 예산 {예산액}" — 도넛 아래 행의 본문. */
  primaryText: string;
  /**
   * 보조 한 줄(관측 톤) — 초과면 "예산보다 N원 더 썼어요", 정확히 다 썼으면 "예산을 모두
   * 썼어요", 그 아래면 "예산의 N%를 썼어요". 경계는 `isBudgetUsedUp` 하나다(리뷰 L-1).
   */
  secondaryText: string;
  /** TalkBack 한 문장 — 구분자만 쉼표(낭독 구분자 관례). */
  accessibilityLabel: string;
};

export type CategoryBudgetUsageInput = {
  /** 월간 리포트 응답의 categoryBudgets(§2.4). 없으면(구 캐시 포함) 행 0건. */
  budgets: ReadonlyArray<{ categoryId: string; amountKrw: number }> | null | undefined;
  /** 도넛과 같은 카테고리 분해 응답의 행(GET /reports/category — 원 id 단위). */
  breakdown: ReadonlyArray<{ categoryId: string; amountKrw: number }> | null | undefined;
  /** `["categories"]` 캐시의 전량(includeAll) 목록. 없으면 행 0건(모르면 지어내지 않는다). */
  categories: ReadonlyArray<SelectableCategory> | null | undefined;
};

export function buildCategoryBudgetUsageRows(input: CategoryBudgetUsageInput): CategoryBudgetUsageRow[] {
  const budgets = (input.budgets ?? []).filter(
    (entry) =>
      Boolean(entry) &&
      typeof entry.categoryId === "string" &&
      entry.categoryId.length > 0 &&
      Number.isFinite(entry.amountKrw) &&
      entry.amountKrw > 0
  );
  if (budgets.length === 0) return [];

  const categories = input.categories ?? null;
  if (!categories || categories.length === 0) return [];

  // 칩 대장은 예산 화면의 행 모집단과 같은 한 소스다(§5.1 R2 — 합류 규칙 드리프트 금지).
  // ⚠️ 두 시점(라운드 102 리뷰 L-9): 그래서 **거르는 자도 같은 자**여야 한다. 종전 두 모듈은
  // "서버 목록에 있는 id인가"로 걸렀는데, 폴백 8타일의 id는 서버 별칭 행의 id와 바이트 동일이라
  // 그 자를 통과했다(예산 화면 모듈의 주석이 근거 원문). 제안 가능 행 집합으로 좁힌다 — 폴백
  // 칩은 전부 `selectable:false`라 여기서 떨어지고, 정상 경로에서는 항등식이다.
  const offeredIds = new Set(selectableCategories(categories).map((category) => category.id));
  const chips = buildRecordsCategoryChips(categories).filter((chip) => offeredIds.has(chip.id));
  const nameOf = buildCategoryNameLookup(categories);

  const budgetByCategoryId = new Map(budgets.map((entry) => [entry.categoryId, entry.amountKrw]));
  const spentByCategoryId = new Map<string, number>();
  for (const row of input.breakdown ?? []) {
    if (!row || typeof row.categoryId !== "string" || !Number.isFinite(row.amountKrw)) continue;
    spentByCategoryId.set(row.categoryId, (spentByCategoryId.get(row.categoryId) ?? 0) + row.amountKrw);
  }

  // 순서: 칩 대장 순서가 진다(§2.3 — 서버 정렬은 오름차순일 뿐, 화면 정렬은 칩 대장 몫).
  // 칩 대장 밖의 예산 행은 categoryId 오름차순으로 앞에 끼운다(예산 화면과 같은 규칙).
  const chipRows = chips
    .filter((chip) => budgetByCategoryId.has(chip.id))
    .map((chip) => ({
      categoryId: chip.id,
      name: chip.plainLabel,
      matchIds: chip.matchIds
    }));
  const chipCategoryIds = new Set(chipRows.map((row) => row.categoryId));
  /**
   * 칩 대장 밖 행(운영자가 숨긴 카테고리 등)의 가족.
   *
   * ⚠️ 두 시점 (라운드 102 리뷰 L-7): 종전에는 `[entry.categoryId]` 한 개였다 — "모르는 합류를
   * 지어내지 않는다"는 뜻이었지만, 그 자리에서 실제로 일어나는 일은 **아는 합류를 잃는 것**
   * 이었다: 운영자가 "기저귀/위생"을 숨기는 순간 그 행의 사용액에서 퀵타일 지출(별칭 id)이
   * 통째로 빠져, 예산은 그대로인데 사용액만 급감한 가짜 숫자가 된다(§5.1의 정직성 — 필터가
   * 보여주는 집합과 예산이 세는 집합이 같아야 한다).
   *
   * 합류 규칙은 여전히 **한 소스**다(R2 — 새 매핑 코드 0건): 같은 `buildRecordsCategoryChips`를
   * 그 id를 "현재 값"으로 넘겨 한 번 더 세운다. `selectableCategories` 규칙 (d)가 그 행을
   * 언제나 남기므로(숨김·비선택이어도), 돌아오는 칩의 matchIds가 곧 그 카테고리의 가족이다 —
   * 예산 화면의 "끼워 유지"와 같은 판단·같은 함수다. 목록에 아예 없는 id는 종전대로 자기 id
   * 하나다(그때는 이름도 코드도 모른다).
   */
  const keptMatchIds = (categoryId: string): string[] =>
    buildRecordsCategoryChips(categories, categoryId).find((chip) => chip.id === categoryId)?.matchIds ?? [categoryId];
  const keptRows = budgets
    .filter((entry) => !chipCategoryIds.has(entry.categoryId))
    .map((entry) => ({
      categoryId: entry.categoryId,
      name: nameOf(entry.categoryId),
      matchIds: keptMatchIds(entry.categoryId)
    }))
    .sort((left, right) => (left.categoryId < right.categoryId ? -1 : left.categoryId > right.categoryId ? 1 : 0));

  return [...keptRows, ...chipRows].map(({ categoryId, name, matchIds }) => {
    const budgetKrw = budgetByCategoryId.get(categoryId)!;
    const usedKrw = matchIds.reduce((total, id) => total + (spentByCategoryId.get(id) ?? 0), 0);
    const progress = evaluateHomeBudgetProgress({ budgetKrw, spentKrw: usedKrw });
    const overKrw = usedKrw - budgetKrw;
    // ⚠️ 두 시점 (라운드 102 리뷰 L-1): 종전 갈래는 `usedKrw > budgetKrw`라, 같은 행 안에서
    // 퍼센트(모듈의 `>=` 경계로 100%가 되는 값)와 문장(`>` 경계)이 **서로 다른 경계**를 들고
    // 있었다 — 라운드 38 H-2가 히어로·넛지에서 없앤 그 모양이다. 경계는 그 모듈의 한 술어
    // (`isBudgetUsedUp`, `>=`)로 통일하고, 초과 **금액**은 실제로 초과했을 때만 말한다
    // (정확히 다 쓴 달의 "0원 더 썼어요"는 없는 사실이다 — 넛지가 같은 이유로 같은 갈래를
    // 갖는다). 이 통일 덕에 아래 퍼센트 문장은 **미소진 구간에만** 서므로 "예산의 100%를
    // 썼어요"가 초과 아님으로 읽히는 자리도 사라진다.
    const secondaryText = isBudgetUsedUp(budgetKrw, usedKrw)
      ? overKrw > 0
        ? `예산보다 ${formatKrw(overKrw)} 더 썼어요`
        : "예산을 모두 썼어요"
      : `예산의 ${progress.percent ?? 0}%를 썼어요`;
    return {
      categoryId,
      name,
      primaryText: `${name} ${formatKrw(usedKrw)} / 예산 ${formatKrw(budgetKrw)}`,
      secondaryText,
      accessibilityLabel: `${name}, ${formatKrw(usedKrw)} 사용, 예산 ${formatKrw(budgetKrw)}, ${secondaryText}`
    };
  });
}
