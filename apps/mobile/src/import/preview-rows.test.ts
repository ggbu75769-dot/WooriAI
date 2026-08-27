import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attentionFilterChipLabel,
  buildImportBulkSelectionPlan,
  canBulkSelectImportRows,
  confirmableSelectedRowIds,
  countImportRowsNeedingAttention,
  filterImportRows,
  formatImportRowDate,
  importBulkProgressLabel,
  importBulkSelectionLabel,
  importRowBadge,
  importRowDisplay,
  isImportRowConfirmable,
  resolveImportTargetChildName,
  rollbackImportRowSelection,
  setImportRowSelection,
  shouldShowAttentionFilter,
  toggleImportRowSelection,
  IMPORT_ATTENTION_FILTER_EMPTY_TEXT,
  IMPORT_ROW_LOCKED_MESSAGE,
  IMPORT_TARGET_CHILD_LABEL,
  type ImportPreviewRow
} from "./preview-rows";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function row(overrides: Partial<ImportPreviewRow> = {}): ImportPreviewRow {
  return {
    id: "row-1",
    parsedDate: "2026-08-27",
    parsedItemName: "기저귀 6팩",
    parsedAmountKrw: 42000,
    confidence: 0.95,
    selected: true,
    validationStatus: "valid",
    ...overrides
  };
}

describe("UX-S 확정 불가 행 잠금 (서버 규칙을 화면이 말한다)", () => {
  it('validationStatus가 "valid"일 때만 확정 가능하다 -- 모르는 사유는 잠금 쪽에 선다', () => {
    expect(isImportRowConfirmable(row())).toBe(true);
    for (const status of [
      "missing_date",
      "invalid_date",
      "missing_item_name",
      "invalid_amount",
      "low_confidence_duplicate_candidate",
      "some_future_server_reason"
    ]) {
      expect(isImportRowConfirmable(row({ validationStatus: status })), status).toBe(false);
    }
  });

  it("확정 불가 행은 낙관적으로도 체크되지 않는다 (서버가 selected를 false로 되돌리므로)", () => {
    const rows = [row({ id: "a", selected: false, validationStatus: "missing_date" })];
    const next = toggleImportRowSelection(rows, "a");
    // 같은 배열 참조를 그대로 돌려준다 -- 캐시가 갈아 끼워지지 않아 행 memo가 유지된다.
    expect(next).toBe(rows);
    expect(next[0].selected).toBe(false);
  });

  it("확정 불가 행은 일괄 선택 대상에서도 빠지고, 확정 요청 본문에도 실리지 않는다", () => {
    const rows = [
      row({ id: "ok", selected: false }),
      row({ id: "locked", selected: true, validationStatus: "missing_item_name" })
    ];
    expect(buildImportBulkSelectionPlan(rows).targetRowIds).toEqual(["ok"]);
    // selected=true인 잠금 행(서버가 미처 되돌리기 전의 캐시)도 확정 id에서 빠진다.
    expect(confirmableSelectedRowIds(rows)).toEqual([]);
    expect(confirmableSelectedRowIds([row({ id: "ok" })])).toEqual(["ok"]);
  });

  it("잠금 안내 문구는 앱 밖에서 고쳐야 한다는 사실을 말한다 (해요체)", () => {
    expect(IMPORT_ROW_LOCKED_MESSAGE).toBe("이 행은 가져올 수 없어요 · 원본 파일에서 고친 뒤 다시 올려 주세요");
    expect(IMPORT_ROW_LOCKED_MESSAGE.endsWith("주세요")).toBe(true);
  });

  it("배지: 낮은 신뢰도 > 확인 필요 > 없음 순으로 하나만 붙는다", () => {
    expect(importRowBadge(row())).toBeNull();
    expect(importRowBadge(row({ confidence: 0.4 }))).toEqual({ label: "낮은 신뢰도 · 중복 확인 필요", tone: "warning" });
    expect(importRowBadge(row({ validationStatus: "low_confidence_duplicate_candidate" }))).toEqual({
      label: "낮은 신뢰도 · 중복 확인 필요",
      tone: "warning"
    });
    expect(importRowBadge(row({ validationStatus: "missing_date" }))).toEqual({ label: "확인이 필요해요", tone: "warning" });
  });
});

describe("UX-S 행 표시 (날짜 부제 · 빈 값 자리 문구)", () => {
  it("parsedDate를 기록 탭과 같은 꼴로 보여 준다", () => {
    expect(formatImportRowDate("2026-08-27")).toBe("8월 27일");
    expect(formatImportRowDate("2026-01-03")).toBe("1월 3일");
  });

  it("날짜가 없거나 해석할 수 없으면 지어내지 않는다", () => {
    expect(formatImportRowDate(undefined)).toBe("날짜를 확인해 주세요");
    expect(formatImportRowDate("   ")).toBe("날짜를 확인해 주세요");
    // 원본 통과 규칙: "NaN월 NaN일"보다 원본이 정직하다.
    expect(formatImportRowDate("2026-ab-cd")).toBe("2026-ab-cd");
    expect(formatImportRowDate("작년 여름")).toBe("작년 여름");
  });

  it("품목명·금액이 비면 자리 문구를 쓰고, 있으면 원화 표기를 쓴다", () => {
    expect(importRowDisplay(row())).toEqual({
      title: "기저귀 6팩",
      amountText: "42,000원",
      dateText: "8월 27일"
    });
    expect(importRowDisplay(row({ parsedItemName: "   ", parsedAmountKrw: undefined }))).toMatchObject({
      title: "품목명을 확인해 주세요",
      amountText: "금액을 확인해 주세요"
    });
  });
});

describe("UX-S 확인 필요 필터 칩", () => {
  const rows = [
    row({ id: "a" }),
    row({ id: "b", validationStatus: "missing_date" }),
    row({ id: "c", validationStatus: "invalid_amount" })
  ];

  it("칩 라벨은 확인 필요 건수를 그대로 말한다", () => {
    expect(countImportRowsNeedingAttention(rows)).toBe(2);
    expect(attentionFilterChipLabel(2)).toBe("확인 필요 2건만 보기");
  });

  it("확인 필요 행이 0건이면 칩을 내지 않는다 (누를 수 없는 칩은 소음)", () => {
    expect(shouldShowAttentionFilter(0)).toBe(false);
    expect(shouldShowAttentionFilter(1)).toBe(true);
    expect(countImportRowsNeedingAttention([row(), row({ id: "b" })])).toBe(0);
  });

  it('필터를 켜면 확정 불가 행만 남고, "all"이면 전부 남는다', () => {
    expect(filterImportRows(rows, "attention").map((item) => item.id)).toEqual(["b", "c"]);
    expect(filterImportRows(rows, "all").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("필터 때문에 빈 화면은 전체가 빈 화면과 다른 문구를 쓴다", () => {
    expect(filterImportRows([row()], "attention")).toEqual([]);
    expect(IMPORT_ATTENTION_FILTER_EMPTY_TEXT).toBe("확인이 필요한 행이 없어요");
    expect(IMPORT_ATTENTION_FILTER_EMPTY_TEXT).not.toBe("가져올 항목이 없어요");
  });
});

describe("UX-S 낙관적 토글과 롤백", () => {
  it("확정 가능한 행은 즉시 뒤집히고, 다른 행 객체는 참조까지 그대로다", () => {
    const rows = [row({ id: "a", selected: false }), row({ id: "b", selected: true })];
    const next = toggleImportRowSelection(rows, "a");
    expect(next[0].selected).toBe(true);
    expect(next[1]).toBe(rows[1]);
    // 원본은 손대지 않는다(캐시 객체를 직접 수정하면 react-query가 변화를 놓친다).
    expect(rows[0].selected).toBe(false);
  });

  it("없는 행 id는 아무것도 바꾸지 않는다", () => {
    const rows = [row({ id: "a" })];
    expect(toggleImportRowSelection(rows, "zzz")).toBe(rows);
  });

  it("실패 롤백은 그 행 하나만 되돌린다 -- 그 사이 성공한 다른 행을 지우지 않는다", () => {
    const snapshot = [row({ id: "a", selected: false }), row({ id: "b", selected: false })];
    // a는 낙관적으로 켰고(실패 예정), 그 사이 b는 진짜로 켜졌다.
    const current = [row({ id: "a", selected: true }), row({ id: "b", selected: true })];
    const rolledBack = rollbackImportRowSelection(current, "a", snapshot);
    expect(rolledBack.map((item) => item.selected)).toEqual([false, true]);
  });

  it("이미 원래 상태로 돌아와 있으면 배열을 갈아 끼우지 않는다", () => {
    const snapshot = [row({ id: "a", selected: false })];
    const current = [row({ id: "a", selected: false })];
    expect(rollbackImportRowSelection(current, "a", snapshot)).toBe(current);
  });

  it("스냅샷에 없던 행(그 사이 목록이 갱신됨)은 건드리지 않는다", () => {
    const current = [row({ id: "a", selected: true })];
    expect(rollbackImportRowSelection(current, "a", [])).toBe(current);
  });
});

describe("UX-S 전체 선택/해제", () => {
  it("하나라도 꺼져 있으면 전체 선택, 다 켜져 있으면 전체 해제", () => {
    const mixed = [row({ id: "a", selected: true }), row({ id: "b", selected: false })];
    expect(buildImportBulkSelectionPlan(mixed)).toEqual({ nextSelected: true, targetRowIds: ["b"] });
    expect(importBulkSelectionLabel(mixed)).toBe("전체 선택");

    const allOn = [row({ id: "a", selected: true }), row({ id: "b", selected: true })];
    expect(buildImportBulkSelectionPlan(allOn)).toEqual({ nextSelected: false, targetRowIds: ["a", "b"] });
    expect(importBulkSelectionLabel(allOn)).toBe("전체 해제");
  });

  it("확정 가능한 행이 하나도 없으면 누를 것이 없다", () => {
    expect(canBulkSelectImportRows([row({ validationStatus: "missing_date" })])).toBe(false);
    expect(canBulkSelectImportRows([row()])).toBe(true);
    expect(buildImportBulkSelectionPlan([row({ validationStatus: "missing_date" })]).targetRowIds).toEqual([]);
  });

  it("순차 PATCH 진행 표시는 남은 양을 숫자로 말한다", () => {
    expect(importBulkProgressLabel(0, 120)).toBe("반영 중이에요 0/120");
    expect(importBulkProgressLabel(120, 120)).toBe("반영 중이에요 120/120");
  });

  it("일괄 세터는 확정 불가 행과 이미 그 상태인 행을 건너뛴다", () => {
    const rows = [row({ id: "a", selected: false }), row({ id: "b", selected: false, validationStatus: "missing_date" })];
    expect(setImportRowSelection(rows, "b", true)).toBe(rows);
    expect(setImportRowSelection(rows, "a", false)).toBe(rows);
    expect((setImportRowSelection(rows, "a", true) as ImportPreviewRow[])[0].selected).toBe(true);
  });
});

describe("UX-S 대상 아이 한 줄", () => {
  const children = [
    { id: "child-1", nickname: "다온" },
    { id: "child-2", nickname: "하율" }
  ];

  it("고른 아이의 이름을 돌려준다", () => {
    expect(resolveImportTargetChildName("child-2", children)).toBe("하율");
    expect(IMPORT_TARGET_CHILD_LABEL).toBe("대상 아이");
  });

  it("캐시가 없거나 그 아이를 못 찾으면 줄을 그리지 않는다 (자리 문구 금지)", () => {
    expect(resolveImportTargetChildName("child-1", undefined)).toBeNull();
    expect(resolveImportTargetChildName("child-1", null)).toBeNull();
    expect(resolveImportTargetChildName(null, children)).toBeNull();
    expect(resolveImportTargetChildName("child-9", children)).toBeNull();
    expect(resolveImportTargetChildName("child-1", [{ id: "child-1", nickname: "  " }])).toBeNull();
  });
});

/**
 * 화면 배선은 source-grep으로 고정한다 -- react-native가 vitest에서 네이티브 바인딩 없이 렌더되지
 * 않으므로, 이 저장소의 기존 관례(src/records-list-virtualization.test.ts)를 그대로 따른다.
 */
describe("UX-S 검수 화면 배선 (app/import/[importJobId].tsx)", () => {
  const screen = () => source("app/import/[importJobId].tsx");

  it("2,000행 상한을 가상화 목록으로 그린다 -- 전 행 즉시 마운트(.map) 금지", () => {
    const src = screen();
    expect(src).toContain("<FlatList");
    expect(src).toContain("keyExtractor={importRowKey}");
    expect(src).toContain("renderItem={renderImportRow}");
    expect(src).toContain("initialNumToRender");
    // 기록 탭 PERF-102와 같은 이유: ScrollView(AppScreen) 안에 넣으면 가상화가 꺼진다.
    expect(src).not.toContain("<AppScreen>");
    expect(src).not.toMatch(/\.map\([\s\S]{0,200}<ImportRowCard/);
    // renderItem/keyExtractor는 모듈 스코프 함수다(인라인 람다 금지).
    expect(src).not.toMatch(/renderItem=\{\s*\(/);
    expect(src).not.toMatch(/keyExtractor=\{\s*\(/);
    expect(src.indexOf("function renderImportRow(")).toBeLessThan(src.indexOf("export default function ImportPreviewScreen"));
    expect(src).toContain("const SelectableImportRowCard = memo(");
    expect(src).toContain("const LockedImportRowCard = memo(");
  });

  it("토글은 낙관적으로 갱신하고 실패하면 그 행만 되돌린다 (전체 재조회 없음)", () => {
    const src = screen();
    expect(src).toContain("onMutate: async (row) => {");
    expect(src).toContain("toggleImportRowSelection(current.rows, row.id)");
    expect(src).toContain("rollbackImportRowSelection(current.rows, row.id, snapshot.rows)");
    // 성공 시 서버가 돌려준 행을 캐시에 꽂는다 -- 체크 1회마다 목록 전체를 다시 받지 않는다.
    expect(src).not.toContain('invalidateQueries({ queryKey: ["import-rows"');
  });

  it("잠기는 것은 그 행 하나뿐이다 (전 행 잠금 회귀 금지)", () => {
    const src = screen();
    expect(src).toContain("pendingRowIds.has(row.id)");
    expect(src).not.toContain("disabled={toggleRow.isPending}");
  });

  it("확정 불가 행은 체크박스 대신 잠금 표시와 안내를 그린다", () => {
    const src = screen();
    expect(src).toContain("isImportRowConfirmable(item.row)");
    expect(src).toContain("IMPORT_ROW_LOCKED_MESSAGE");
    // 체크박스 역할/상태는 선택 가능한 행에만 남는다(A11Y 계약과 같은 문자열).
    expect(src).toContain("accessibilityState={{ checked: row.selected, disabled }}");
  });

  it("대상 아이는 새 요청 없이 기존 캐시에서 읽는다", () => {
    const src = screen();
    expect(src).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])');
    expect(src).toContain("resolveImportTargetChildName(childId, cachedChildren)");
    // useQuery로 새로 부르면 안 된다.
    expect(src).not.toContain('queryKey: ["children"]');
  });

  it("확인 필요 필터 칩과 전체 선택/해제를 배선한다", () => {
    const src = screen();
    expect(src).toContain("attentionFilterChipLabel(attentionCount)");
    expect(src).toContain("shouldShowAttentionFilter(attentionCount)");
    expect(src).toContain("importBulkSelectionLabel(rowList)");
    expect(src).toContain("importBulkProgressLabel(bulkProgress.done, bulkProgress.total)");
    // 44dp 터치 타깃(새 치수 금지).
    expect(src).toContain("minHeight: theme.touchTarget");
  });
});
