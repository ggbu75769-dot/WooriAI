import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("PERF-102 records list virtualization (source verification -- follows the existing\n  ui-wiring.test.ts source-grep convention; the screen isn't runtime-rendered here because\n  react-native has no native binding under vitest)", () => {
  const recordsSource = () => source("app/(tabs)/records.tsx");

  // UX-B: the screen's list is a SectionList (날짜 그룹 헤더 + 일별 소계) as of UX-B; it was a
  // FlatList when PERF-102 wrote this contract. What PERF-102 actually pinned -- a *virtualized*
  // RN list with module-scope renderItem/keyExtractor, never an eager .map of mounted rows -- is
  // unchanged: SectionList is the same VirtualizedList underneath. Only the element name moved.
  it("renders the expense list through a virtualized SectionList with a stable keyExtractor, not an eagerly-mounted map", () => {
    const src = recordsSource();
    expect(src).toContain("<SectionList");
    // 회귀 방지: 그룹 헤더를 얻자고 리스트를 평평한 FlatList로 되돌리면 안 된다.
    expect(src).not.toContain("<FlatList");
    expect(src).toContain("keyExtractor={recordsRowKey}");
    expect(src).toContain("renderItem={renderRecordsRow}");
    expect(src).toContain("initialNumToRender");
    expect(src).toContain("ListEmptyComponent");
    expect(src).toContain("ListHeaderComponent");
    // The expense rows must never be mounted eagerly again (.map over the row arrays straight
    // into <ListRow> JSX was the PERF-102 jank source). Mapping to plain data descriptors for
    // the list's `sections` prop is fine; mapping to mounted row elements is not.
    expect(src).not.toMatch(/\.map\([\s\S]{0,200}<ListRow/);
    // 같은 이유로 섹션도 미리 그려 두면 안 된다 -- 그룹 헤더 역시 렌더 콜백으로만 나온다.
    expect(src).not.toMatch(/\.map\([\s\S]{0,200}<RecordsSectionHeader/);
  });

  it("must not nest the list inside AppScreen's ScrollView -- that disables virtualization", () => {
    const src = recordsSource();
    expect(src).not.toContain("<AppScreen>");
    // The only remaining ScrollView is the horizontal category-chip strip (bounded, ~10 chips).
    const scrollViewUses = src.match(/<ScrollView/g) ?? [];
    expect(scrollViewUses).toHaveLength(1);
    expect(src).toContain("<ScrollView horizontal");
  });

  it("memoizes both row variants and keeps renderItem/keyExtractor at module scope (no inline list lambdas)", () => {
    const src = recordsSource();
    expect(src).toContain("const OfflineExpenseListRow = memo(");
    expect(src).toContain("const ServerExpenseListRow = memo(");
    expect(src).toContain("function renderRecordsRow(");
    expect(src).toContain("function recordsRowKey(");
    // UX-B: the date-group header follows the same rule (memoized component + module-scope
    // render callback), so a screen re-render doesn't remount every visible header.
    expect(src).toContain("const RecordsSectionHeader = memo(");
    expect(src).toContain("function renderRecordsSectionHeader(");
    // renderItem/keyExtractor/renderSectionHeader/ItemSeparatorComponent are declared before the
    // component, so a re-render of RecordsScreen hands the list referentially identical props.
    expect(src.indexOf("function renderRecordsRow(")).toBeLessThan(src.indexOf("export default function RecordsScreen"));
    expect(src.indexOf("function renderRecordsSectionHeader(")).toBeLessThan(
      src.indexOf("export default function RecordsScreen")
    );
    expect(src).not.toMatch(/renderItem=\{\s*\(/);
    expect(src).not.toMatch(/keyExtractor=\{\s*\(/);
    expect(src).not.toMatch(/renderSectionHeader=\{\s*\(/);
  });

  it("passes the list header as an element (not an inline component) so the search TextInput keeps focus", () => {
    const src = recordsSource();
    expect(src).toContain("const listHeader = (");
    expect(src).toContain("ListHeaderComponent={listHeader}");
  });

  it("keeps the pre-existing behavior contracts alive inside the list structure (offline rows, states, filters)", () => {
    const src = recordsSource();
    // Offline pending rows render before server rows, with the distinct sync-state icon and
    // sync-status routing (EXP-005 wiring, also pinned by offline/ui-wiring.test.ts).
    expect(src).toContain("offlineStatusIcon(row.syncState)");
    expect(src).toContain('router.push("/sync-status")');
    // Loading skeleton / retry / empty states now live in ListEmptyComponent, gated exactly like
    // the old conditional render (no rows while loading or errored).
    expect(src).toContain("const listEmpty = expenses.isLoading ? (");
    // UX-B: the same gate, now applied to the grouped sections -- rows/headers only appear once
    // the server list has resolved (loading -> skeleton, error -> retry card).
    expect(src).toContain("showList ? groupExpensesByDate(listData, seoulToday) : []");
    // Total card still reads the reconciled full-month total, never the filtered list.
    expect(src).toContain("formatKrw(monthlyTotalKrw)");
    expect(src).not.toContain("formatKrw(visibleExpenses");
  });

  it("shows the lightweight month summary line from already-fetched data only", () => {
    const src = recordsSource();
    // 라운드 39 UX-P: 문구는 보고 있는 달의 라벨에서 나온다(더 이상 "이번 달" 하드코딩이 아니다).
    expect(src).toContain("const monthSummary = buildRecordsMonthSummary({");
    expect(src).toContain("monthLabel: recordsMonthLabel,");
    expect(src).toContain("recordCount: monthlyRecordCount,");
    expect(src).toContain("totalKrw: monthlyTotalKrw");
    expect(src).not.toContain("이번 달 ${monthlyRecordCount}건");
    // No new API surface was added for the summary -- it derives from the existing
    // listExpenses query + offline snapshot reconciliation.
    // REC-123(D1)이 그 아래 붙인 "지난달 같은 시점" 한 줄은 홈(REP-121)과 **같은 캐시 키**
    // (["expenses", childId, 지난달])를 공유하는 두 번째 listExpenses 조회라, 새 엔드포인트가
    // 아니라 이미 받아둔 응답의 재사용이다. 호출 지점은 딱 이 둘까지만 허용한다.
    const listExpensesCalls = src.match(/listExpenses\(authToken!/g) ?? [];
    expect(listExpensesCalls).toHaveLength(2);
    expect(src).toContain('queryKey: ["expenses", childId, lastYearMonth]');
  });
});
