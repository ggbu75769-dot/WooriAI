import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("PERF-102 records list virtualization (source verification -- follows the existing\n  ui-wiring.test.ts source-grep convention; the screen isn't runtime-rendered here because\n  react-native has no native binding under vitest)", () => {
  const recordsSource = () => source("app/(tabs)/records.tsx");

  it("renders the expense list through a virtualized FlatList with a stable keyExtractor, not an eagerly-mounted map", () => {
    const src = recordsSource();
    expect(src).toContain("<FlatList");
    expect(src).toContain("keyExtractor={recordsRowKey}");
    expect(src).toContain("renderItem={renderRecordsRow}");
    expect(src).toContain("initialNumToRender");
    expect(src).toContain("ListEmptyComponent");
    expect(src).toContain("ListHeaderComponent");
    // The expense rows must never be mounted eagerly again (.map over the row arrays straight
    // into <ListRow> JSX was the PERF-102 jank source). Mapping to plain data descriptors for
    // the FlatList `data` prop is fine; mapping to mounted row elements is not.
    expect(src).not.toMatch(/\.map\([\s\S]{0,200}<ListRow/);
  });

  it("must not nest the FlatList inside AppScreen's ScrollView -- that disables virtualization", () => {
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
    // renderItem/keyExtractor/ItemSeparatorComponent are declared before the component, so a
    // re-render of RecordsScreen hands the FlatList referentially identical props.
    expect(src.indexOf("function renderRecordsRow(")).toBeLessThan(src.indexOf("export default function RecordsScreen"));
    expect(src).not.toMatch(/renderItem=\{\s*\(/);
    expect(src).not.toMatch(/keyExtractor=\{\s*\(/);
  });

  it("passes the list header as an element (not an inline component) so the search TextInput keeps focus", () => {
    const src = recordsSource();
    expect(src).toContain("const listHeader = (");
    expect(src).toContain("ListHeaderComponent={listHeader}");
  });

  it("keeps the pre-existing behavior contracts alive inside the FlatList structure (offline rows, states, filters)", () => {
    const src = recordsSource();
    // Offline pending rows render before server rows, with the distinct sync-state icon and
    // sync-status routing (EXP-005 wiring, also pinned by offline/ui-wiring.test.ts).
    expect(src).toContain("offlineStatusIcon(row.syncState)");
    expect(src).toContain('router.push("/sync-status")');
    // Loading skeleton / retry / empty states now live in ListEmptyComponent, gated exactly like
    // the old conditional render (no rows while loading or errored).
    expect(src).toContain("const listEmpty = expenses.isLoading ? (");
    expect(src).toContain("flatListData = showList ? listData : []");
    // Total card still reads the reconciled full-month total, never the filtered list.
    expect(src).toContain("formatKrw(monthlyTotalKrw)");
    expect(src).not.toContain("formatKrw(visibleExpenses");
  });

  it("shows the lightweight month summary line from already-fetched data only", () => {
    const src = recordsSource();
    expect(src).toContain("이번 달 ${monthlyRecordCount}건 · 합계 ${formatKrw(monthlyTotalKrw)}");
    // No new API surface was added for the summary -- it derives from the existing
    // listExpenses query + offline snapshot reconciliation.
    expect(src).not.toMatch(/listExpenses\([\s\S]{0,400}listExpenses\(/);
  });
});
