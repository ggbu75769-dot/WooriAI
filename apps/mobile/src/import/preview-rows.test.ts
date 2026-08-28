import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attentionFilterChipLabel,
  buildImportBulkSelectionPlan,
  canBulkSelectImportRows,
  canEditImportRowCategory,
  confirmableSelectedRowIds,
  countImportRowsNeedingAttention,
  countUnappliedReviewedRows,
  filterImportRows,
  formatImportRowDate,
  importBulkProgressLabel,
  importBulkSelectionLabel,
  importCategoryNameResolver,
  importRowBadge,
  importRowCategoryA11ySuffix,
  importRowCategoryEditLabel,
  importRowCategoryView,
  importRowDisplay,
  importRowNotice,
  importRowSelectability,
  importTargetChildNotice,
  isImportRowConfirmable,
  isImportRowReviewable,
  isImportRowSelectable,
  resolveImportTargetChildName,
  rollbackImportRowSelection,
  setImportRowSelection,
  shouldPatchImportRowCategory,
  shouldShowAttentionFilter,
  toggleImportRowSelection,
  IMPORT_ATTENTION_FILTER_EMPTY_TEXT,
  IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL,
  IMPORT_ROW_CATEGORY_EDIT_LABEL,
  IMPORT_ROW_CATEGORY_LABEL,
  IMPORT_ROW_CATEGORY_STUB_HINT,
  IMPORT_ROW_LOCKED_MESSAGE,
  IMPORT_ROW_REVIEW_MESSAGE,
  IMPORT_ROW_REVIEWABLE_STATUSES,
  IMPORT_TARGET_CHILD_LABEL,
  IMPORT_TARGET_CHILD_UNKNOWN_TEXT,
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

/**
 * 라운드 41 K-1. 이 describe가 지키는 것은 **서버 규칙의 미러**다:
 * apps/api/src/onboarding/import-pipeline.service.ts:405-432의 validationStatusForImportRow는
 * `duplicate_candidate` / `low_confidence_duplicate_candidate`를 **`!row.userReviewed`일 때만**
 * 매기고, updateImportRow는 어떤 PATCH에서도 userReviewed를 세운다 -- 즉 그 두 행은 체크 한
 * 번이면 valid가 된다. e2e 증거는 apps/api/test/import-parsing.db.test.ts에 있다.
 */
describe("K-1 행 상태 3분류 (valid · 검토 가능 · 잠금)", () => {
  it("검토 가능 상태는 서버가 userReviewed 하나로 푸는 두 가지뿐이다", () => {
    expect([...IMPORT_ROW_REVIEWABLE_STATUSES]).toEqual(["duplicate_candidate", "low_confidence_duplicate_candidate"]);
  });

  it("valid / 검토 가능 / 잠금으로 갈리고, 모르는 새 상태는 잠금 쪽에 선다", () => {
    expect(importRowSelectability(row())).toBe("valid");
    for (const status of IMPORT_ROW_REVIEWABLE_STATUSES) {
      expect(importRowSelectability(row({ validationStatus: status })), status).toBe("reviewable");
    }
    for (const status of [
      "missing_date",
      "invalid_date",
      "missing_item_name",
      "invalid_amount",
      "missing_category",
      "some_future_server_reason"
    ]) {
      expect(importRowSelectability(row({ validationStatus: status })), status).toBe("locked");
    }
  });

  it("확정 가능(=지금 이대로 가져갈 수 있음)은 valid뿐 -- 검토 가능 행은 아직 아니다", () => {
    expect(isImportRowConfirmable(row())).toBe(true);
    for (const status of [...IMPORT_ROW_REVIEWABLE_STATUSES, "missing_date", "some_future_server_reason"]) {
      expect(isImportRowConfirmable(row({ validationStatus: status })), status).toBe(false);
    }
    // 확정 본문에도 실리지 않는다 -- 서버가 조용히 버릴 id를 보내지 않는다(체크가 서버에
    // 반영돼 valid가 된 뒤에 실린다).
    expect(confirmableSelectedRowIds([row({ id: "dup", selected: true, validationStatus: "duplicate_candidate" })])).toEqual([]);
  });

  it("체크박스를 그리는 행 = valid + 검토 가능. 잠금만 빠진다", () => {
    expect(isImportRowSelectable(row())).toBe(true);
    for (const status of IMPORT_ROW_REVIEWABLE_STATUSES) {
      expect(isImportRowSelectable(row({ validationStatus: status })), status).toBe(true);
      expect(isImportRowReviewable(row({ validationStatus: status })), status).toBe(true);
    }
    expect(isImportRowSelectable(row({ validationStatus: "missing_date" }))).toBe(false);
    expect(isImportRowReviewable(row())).toBe(false);
  });

  it("검토 가능 행은 탭하면 낙관적으로 체크된다 (서버가 valid로 재계산해 주므로 거짓 체크가 아니다)", () => {
    for (const status of IMPORT_ROW_REVIEWABLE_STATUSES) {
      const rows = [row({ id: "a", selected: false, validationStatus: status })];
      const next = toggleImportRowSelection(rows, "a");
      expect(next, status).not.toBe(rows);
      expect(next[0].selected, status).toBe(true);
      // 상태까지 앞질러 고치지는 않는다 -- 정정은 서버 응답의 몫이다.
      expect(next[0].validationStatus, status).toBe(status);
    }
  });

  it("잠긴 행은 낙관적으로도 체크되지 않는다 (서버가 selected를 false로 되돌리므로)", () => {
    const rows = [row({ id: "a", selected: false, validationStatus: "missing_date" })];
    const next = toggleImportRowSelection(rows, "a");
    // 같은 배열 참조를 그대로 돌려준다 -- 캐시가 갈아 끼워지지 않아 행 memo가 유지된다.
    expect(next).toBe(rows);
    expect(next[0].selected).toBe(false);
  });

  it("일괄 선택은 검토 가능 행을 포함하고 잠긴 행만 뺀다", () => {
    const rows = [
      row({ id: "ok", selected: false }),
      row({ id: "dup", selected: false, validationStatus: "duplicate_candidate" }),
      row({ id: "low", selected: false, validationStatus: "low_confidence_duplicate_candidate" }),
      row({ id: "locked", selected: true, validationStatus: "missing_item_name" })
    ];
    expect(buildImportBulkSelectionPlan(rows)).toEqual({ nextSelected: true, targetRowIds: ["ok", "dup", "low"] });
    // selected=true인 잠금 행(서버가 미처 되돌리기 전의 캐시)도 확정 id에서 빠진다.
    expect(confirmableSelectedRowIds(rows)).toEqual([]);
    expect(confirmableSelectedRowIds([row({ id: "ok" })])).toEqual(["ok"]);
    expect(setImportRowSelection(rows, "dup", true)).not.toBe(rows);
    expect(setImportRowSelection(rows, "locked", false)).toBe(rows);
  });

  it("안내 문장: 검토 가능은 '확인하면 된다'고, 잠금만 '원본을 고쳐 다시 올리라'고 말한다", () => {
    expect(importRowNotice(row())).toBeNull();
    for (const status of IMPORT_ROW_REVIEWABLE_STATUSES) {
      expect(importRowNotice(row({ validationStatus: status })), status).toBe(IMPORT_ROW_REVIEW_MESSAGE);
    }
    expect(importRowNotice(row({ validationStatus: "missing_date" }))).toBe(IMPORT_ROW_LOCKED_MESSAGE);
    expect(importRowNotice(row({ validationStatus: "some_future_server_reason" }))).toBe(IMPORT_ROW_LOCKED_MESSAGE);
  });

  it("문구는 해요체이고, 검토 가능 행에는 다시 올리라는 거짓 안내가 붙지 않는다", () => {
    expect(IMPORT_ROW_LOCKED_MESSAGE).toBe("이 행은 가져올 수 없어요 · 원본 파일에서 고친 뒤 다시 올려 주세요");
    expect(IMPORT_ROW_LOCKED_MESSAGE.endsWith("주세요")).toBe(true);
    expect(IMPORT_ROW_REVIEW_MESSAGE).toBe("확인하면 가져올 수 있어요 · 체크하면 확인한 것으로 볼게요");
    expect(IMPORT_ROW_REVIEW_MESSAGE).toContain("가져올 수 있어요");
    expect(IMPORT_ROW_REVIEW_MESSAGE).not.toContain("다시 올려");
  });

  it("배지: 낮은 신뢰도 > 중복 후보 > 확인 필요 > 없음 순으로 하나만 붙는다", () => {
    expect(importRowBadge(row())).toBeNull();
    expect(importRowBadge(row({ confidence: 0.4 }))).toEqual({ label: "낮은 신뢰도 · 중복 확인 필요", tone: "warning" });
    expect(importRowBadge(row({ validationStatus: "low_confidence_duplicate_candidate" }))).toEqual({
      label: "낮은 신뢰도 · 중복 확인 필요",
      tone: "warning"
    });
    expect(importRowBadge(row({ validationStatus: "duplicate_candidate" }))).toEqual({
      label: "이미 있는 지출과 같아 보여요",
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

describe("UX-S 전체 선택/해제 + K-9 필터 정합", () => {
  it("하나라도 꺼져 있으면 선택, 다 켜져 있으면 해제", () => {
    const mixed = [row({ id: "a", selected: true }), row({ id: "b", selected: false })];
    expect(buildImportBulkSelectionPlan(mixed)).toEqual({ nextSelected: true, targetRowIds: ["b"] });
    expect(importBulkSelectionLabel(mixed, "all")).toBe("전체 선택");

    const allOn = [row({ id: "a", selected: true }), row({ id: "b", selected: true })];
    expect(buildImportBulkSelectionPlan(allOn)).toEqual({ nextSelected: false, targetRowIds: ["a", "b"] });
    expect(importBulkSelectionLabel(allOn, "all")).toBe("전체 해제");
  });

  /**
   * K-9: 필터를 켜면 버튼이 건드리는 범위가 화면에 보이는 행으로 줄어든다. 라벨이 "전체"라고
   * 말한 채 보이지 않는 행까지 바꾸면, 사용자가 승인한 적 없는 변경이 조용히 일어난다.
   */
  it("필터 중에는 라벨이 '보이는 행'이라고 말한다", () => {
    const visible = [row({ id: "b", selected: false, validationStatus: "duplicate_candidate" })];
    expect(importBulkSelectionLabel(visible, "attention")).toBe("보이는 행 선택");
    expect(importBulkSelectionLabel([row({ id: "b", selected: true })], "attention")).toBe("보이는 행 해제");
  });

  it("계획은 넘겨받은(=보이는) 행에서만 세워진다 -- 필터 밖 행은 대상이 아니다", () => {
    const all = [
      row({ id: "visible", selected: false, validationStatus: "low_confidence_duplicate_candidate" }),
      row({ id: "hidden", selected: false })
    ];
    const visible = filterImportRows(all, "attention");
    expect(visible.map((item) => item.id)).toEqual(["visible"]);
    expect(buildImportBulkSelectionPlan(visible).targetRowIds).toEqual(["visible"]);
  });

  it("체크할 수 있는 행이 하나도 없으면 누를 것이 없다", () => {
    expect(canBulkSelectImportRows([row({ validationStatus: "missing_date" })])).toBe(false);
    expect(canBulkSelectImportRows([row()])).toBe(true);
    // K-1 이후: 검토 가능 행만 있어도 누를 것이 있다.
    expect(canBulkSelectImportRows([row({ validationStatus: "duplicate_candidate" })])).toBe(true);
    expect(buildImportBulkSelectionPlan([row({ validationStatus: "missing_date" })]).targetRowIds).toEqual([]);
  });

  it("순차 PATCH 진행 표시는 남은 양을 숫자로 말한다", () => {
    expect(importBulkProgressLabel(0, 120)).toBe("반영 중이에요 0/120");
    expect(importBulkProgressLabel(120, 120)).toBe("반영 중이에요 120/120");
  });

  it("일괄 세터는 잠긴 행과 이미 그 상태인 행을 건너뛴다", () => {
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

  /**
   * 라운드 42 L-6 — 이름 해석에 실패하면 줄이 그냥 사라져, 화면이 **대상 아이를 밝히지 않은 채**
   * 확정을 열어 뒀다(K-2가 겨냥한 그 자리와 같은 시나리오다).
   */
  it("L-6: childId는 있는데 이름을 못 찾으면 모른다는 사실을 한 줄로 말한다", () => {
    expect(importTargetChildNotice("child-9", children)).toBe(IMPORT_TARGET_CHILD_UNKNOWN_TEXT);
    expect(importTargetChildNotice("child-1", undefined)).toBe(IMPORT_TARGET_CHILD_UNKNOWN_TEXT);
    expect(importTargetChildNotice("child-1", null)).toBe(IMPORT_TARGET_CHILD_UNKNOWN_TEXT);
    expect(importTargetChildNotice("child-1", [{ id: "child-1", nickname: "  " }])).toBe(
      IMPORT_TARGET_CHILD_UNKNOWN_TEXT
    );
  });

  it("L-6: 이름을 찾았거나 childId 자체가 없으면 아무 말도 하지 않는다", () => {
    // 이름이 있으면 그 이름을 값으로 그린다(경고를 겹쳐 붙이지 않는다).
    expect(importTargetChildNotice("child-2", children)).toBeNull();
    // 비세션·잡 미수신: 모르는 것은 모르는 것이지 문제가 아니다(IMP-003 비로그인 렌더 불변).
    expect(importTargetChildNotice(null, children)).toBeNull();
    expect(importTargetChildNotice(undefined, undefined)).toBeNull();
  });

  it("L-6: 문구는 해요체이고 확정을 막는다고 말하지 않는다 (DNC-018)", () => {
    expect(IMPORT_TARGET_CHILD_UNKNOWN_TEXT).toBe(
      "대상 아이를 확인할 수 없어요. 아이 관리에서 확인 후 진행해 주세요"
    );
    expect(IMPORT_TARGET_CHILD_UNKNOWN_TEXT).toContain("확인할 수 없어요");
    // 이름을 지어내거나 자리 문구로 메우지 않는다.
    expect(IMPORT_TARGET_CHILD_UNKNOWN_TEXT).not.toContain("아이 이름");
  });
});

/**
 * 라운드 42 L-2 — 검토 가능 행을 체크한 **직후**(PATCH 왕복 전)의 확정은 영구 손실이다.
 * 낙관 갱신은 selected만 뒤집으므로 그 행들은 아직 valid가 아니라 확정 본문에서 빠지는데,
 * 잡은 confirmed로 넘어가 그 뒤로는 편집도 재확정도 받지 않는다(IMPORT_NOT_EDITABLE).
 */
describe("L-2 아직 반영되지 않은 검토 체크", () => {
  it("체크는 켜졌는데 아직 valid가 아닌 검토 가능 행만 센다", () => {
    const rows = [
      row({ id: "a", validationStatus: "valid", selected: true }),
      row({ id: "b", validationStatus: "duplicate_candidate", selected: true }),
      row({ id: "c", validationStatus: "low_confidence_duplicate_candidate", selected: true }),
      // 체크하지 않은 검토 가능 행은 확정 본문에 애초에 실리지 않는다 -- 기다릴 이유가 없다.
      row({ id: "d", validationStatus: "duplicate_candidate", selected: false }),
      // 잠긴 행은 어차피 가져올 수 없다(체크 자체가 서버에서 false로 되돌아간다).
      row({ id: "e", validationStatus: "parse_error", selected: true })
    ];
    expect(countUnappliedReviewedRows(rows)).toBe(2);
  });

  it("서버 응답이 도착해 valid가 되면 0이 된다(그때 확정이 열린다)", () => {
    const pending = [row({ id: "b", validationStatus: "duplicate_candidate", selected: true })];
    expect(countUnappliedReviewedRows(pending)).toBe(1);
    // PATCH 응답을 캐시에 꽂은 뒤의 같은 행.
    const applied = [row({ id: "b", validationStatus: "valid", selected: true })];
    expect(countUnappliedReviewedRows(applied)).toBe(0);
    // 그리고 그때 비로소 확정 본문에 실린다.
    expect(confirmableSelectedRowIds(pending)).toEqual([]);
    expect(confirmableSelectedRowIds(applied)).toEqual(["b"]);
  });

  it("빈 목록·전부 valid면 0이다", () => {
    expect(countUnappliedReviewedRows([])).toBe(0);
    expect(countUnappliedReviewedRows([row({ selected: true }), row({ id: "b", selected: false })])).toBe(0);
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

  it("K-1: 체크박스는 선택 가능(valid+검토 가능) 행에, 잠금 카드는 나머지에만 그린다", () => {
    const src = screen();
    expect(src).toContain("isImportRowSelectable(item.row)");
    // 확정 가능(valid) 판정으로 행을 잠그던 회귀가 되돌아오면 안 된다.
    expect(src).not.toContain("isImportRowConfirmable(item.row)");
    expect(src).toContain("IMPORT_ROW_LOCKED_MESSAGE");
    // 안내 문장은 순수 모듈이 고른다(화면 JSX에서 상태를 다시 판정하지 않는다).
    expect(src).toContain("importRowNotice(row)");
    // 체크박스 역할/상태는 선택 가능한 행에만 남는다(A11Y 계약과 같은 문자열).
    expect(src).toContain("accessibilityState={{ checked: row.selected, disabled }}");
  });

  it("K-2: 대상 아이는 잡 응답의 childId 기준이고, 새 요청 없이 기존 캐시에서 이름만 읽는다", () => {
    const src = screen();
    expect(src).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])');
    expect(src).toContain("resolveImportTargetChildName(job.data?.childId, cachedChildren)");
    // 선택 아이 스토어를 "대상 아이"로 단언하던 경로가 되돌아오면 안 된다.
    expect(src).not.toContain("useSelectedChildStore");
    // useQuery로 새로 부르면 안 된다.
    expect(src).not.toContain('queryKey: ["children"]');
  });

  it("확인 필요 필터 칩과 일괄 선택/해제를 배선한다 (K-9: 라벨·계획 모두 보이는 행 기준)", () => {
    const src = screen();
    expect(src).toContain("attentionFilterChipLabel(attentionCount)");
    expect(src).toContain("shouldShowAttentionFilter(attentionCount)");
    expect(src).toContain("importBulkSelectionLabel(filteredRows, rowFilter)");
    expect(src).toContain("buildImportBulkSelectionPlan(filteredRows)");
    expect(src).toContain("buildImportBulkSelectionPlan(filterImportRows(cached, rowFilter))");
    expect(src).toContain("importBulkProgressLabel(bulkProgress.done, bulkProgress.total)");
    // 44dp 터치 타깃(새 치수 금지).
    expect(src).toContain("minHeight: theme.touchTarget");
  });

  it("K-6: 일괄 루프는 순수 모듈의 취소·재진입 규칙을 지나고, 끝나면 재조회한다", () => {
    const src = screen();
    expect(src).toContain("claimImportBulkRun(importJobId)");
    expect(src).toContain("runImportBulkSelection(");
    expect(src).toContain("isCancelled: handle.isCancelled");
    expect(src).toContain("handle.release()");
    expect(src).toContain("useFocusEffect(");
    expect(src).toContain("mountedRef.current");
    expect(src).toContain("cancelImportBulkRun(importJobId)");
    expect(src).toContain('invalidateQueries({ queryKey: rowsQueryKey })');
    // 화면이 직접 for 루프를 돌며 PATCH하던 옛 배선이 되돌아오면 안 된다.
    expect(src).not.toMatch(/for \(const rowId of plan\.targetRowIds\)/);
  });

  it("K-7: 토글·일괄도 확정과 같은 보기 전용 게이트를 지난다", () => {
    const src = screen();
    expect(src).toContain("const gateLocked = expenseGate.locked;");
    expect(src).toContain("explainExpenseViewOnly()");
    // 게이트 판정은 boolean 하나여야 한다 -- guard()를 의존성에 넣으면 행 memo가 깨진다.
    expect(src).not.toContain("expenseGate.guard(() => toggleMutate");
  });

  it("K-10: 일괄 부분 실패·중단은 목록 조회 실패 문구를 돌려 쓰지 않는다", () => {
    const src = screen();
    expect(src).toContain("IMPORT_BULK_PARTIAL_FAILURE_TEXT");
    expect(src).toContain("IMPORT_BULK_CANCELLED_TEXT");
    expect(src).toContain("IMPORT_BULK_CANCEL_LABEL");
    expect(src).not.toContain("bulkFailed ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}");
  });

  /**
   * 라운드 42 L-2 — 검토 행 반영 전 확정 시 영구 손실 창.
   */
  it("L-2: 확정 disabled가 진행 중인 반영까지 본다 (판정은 순수 모듈 하나)", () => {
    const src = screen();
    expect(src).toContain("const canConfirm = canConfirmImport({");
    expect(src).toContain("pendingRowCount: pendingRowIds.size,");
    expect(src).toContain("unappliedReviewedCount");
    expect(src).toContain("countUnappliedReviewedRows(rowList)");
    expect(src).toContain("disabled={!canConfirm}");
    // 반영 중인 이유를 말한다(버튼이 왜 안 눌리는지 침묵하면 고장으로 읽힌다).
    expect(src).toContain("IMPORT_CONFIRM_PENDING_TEXT");
    // pendingRowIds를 보지 않던 옛 disabled 식이 되돌아오면 안 된다.
    expect(src).not.toContain("disabled={!isPreviewReady || !selectedCount || confirm.isPending || isBulkRunning}");
  });

  it("L-2: 일괄 종료 재조회는 마운트 여부와 무관하게 돈다 (언마운트 뒤 낡은 상태 방지)", () => {
    const src = screen();
    const finallyBlock = src.slice(src.indexOf("} finally {"), src.indexOf("const cancelBulkSelection"));
    expect(finallyBlock).toContain("await queryClient.invalidateQueries({ queryKey: rowsQueryKey });");
    // 화면 상태(setBulkProgress)만 마운트 조건 안에 남는다.
    expect(finallyBlock).toContain("if (mountedRef.current) setBulkProgress(null);");
    // 재조회를 마운트 조건 안에 가두던 옛 배선.
    expect(finallyBlock).not.toMatch(/if \(mountedRef\.current\) \{[\s\S]*invalidateQueries/);
  });

  /**
   * 라운드 42 L-3 — 확인 필요 행이 0이 되면 칩은 사라지는데 필터 상태만 "attention"으로 남아,
   * 빈 목록에 끌 컨트롤이 없는 막다른 길이 됐다.
   */
  it("L-3: 칩이 사라지는 조건에서 필터도 함께 풀린다 (칩과 같은 판정 함수)", () => {
    const src = screen();
    expect(src).toContain('if (rowFilter === "attention" && !shouldShowAttentionFilter(attentionCount)) setRowFilter("all");');
    expect(src).toContain("}, [attentionCount, rowFilter]);");
  });

  /**
   * 라운드 42 L-4 — claim 실패가 조용한 무동작이었다.
   */
  it("L-4: 실행권을 못 받으면 버튼이 잠기고 그 사실을 한 줄로 말한다", () => {
    const src = screen();
    // 라운드 44 리뷰 N-6: 등록부를 렌더 중 1회 읽는 대신 구독해서 읽는다(잠금이 스스로 풀린다).
    expect(src).toContain("const bulkRunHeldElsewhere = !isBulkRunning && bulkRunRegistered;");
    expect(src).toContain("useSyncExternalStore(");
    expect(src).toContain("!bulkRunHeldElsewhere &&");
    expect(src).toContain("setBulkClaimBlocked(true);");
    expect(src).toContain("IMPORT_BULK_CLAIM_BUSY_TEXT");
    // 아무 말 없이 돌아가던 옛 배선.
    expect(src).not.toContain("if (!handle) return;");
  });

  /**
   * 라운드 42 L-6 — 대상 아이 이름을 못 찾았을 때의 사실 한 줄(확정은 막지 않는다).
   */
  it("L-6: 이름 해석 실패를 침묵하지 않는다 (판정·문구는 순수 모듈)", () => {
    const src = screen();
    expect(src).toContain("const targetChildNotice = importTargetChildNotice(job.data?.childId, cachedChildren);");
    expect(src).toContain("{targetChildNotice ? <Text style={mutedTextStyle}>{targetChildNotice}</Text> : null}");
    // 안내가 확정 버튼을 잠그지는 않는다(서버가 쓰는 값은 어차피 job.childId다).
    expect(src).not.toContain("targetChildNotice ? true :");
    expect(src).not.toContain("!targetChildNotice &&");
    // 새 hex 금지 -- 이 화면은 theme 토큰만 쓴다.
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

/**
 * 라운드 65 A(#2) — 검수 화면의 **분류 표시·편집**.
 *
 * 서버 PATCH는 `categoryId`를 진작부터 받고 있었는데(apps/api/src/imports/dto/import.dto.ts)
 * 화면은 읽은 값을 되돌려 보낼 뿐이었고, 행 카드에는 분류를 그리는 줄조차 없었다. 자동 분류는
 * 품목명 키워드 표가 정하므로 가맹점 이름(쿠팡·이마트·올리브영)뿐인 카드 내역은 대부분
 * 스텁 분류("가져오기 기본")로 떨어지는데, 사용자는 **승인 전에 그 사실을 볼 수 없었다**.
 */
describe("A(#2) 행 분류 표시 (importRowCategoryView)", () => {
  const options = [
    { id: "cat-diaper", label: "기저귀/위생" },
    { id: "cat-feeding", label: "수유/이유식" }
  ];
  const resolve = importCategoryNameResolver([
    { id: "cat-diaper", name: "기저귀/위생" },
    { id: "cat-feeding", name: "수유/이유식" },
    { id: "cat-import-stub", name: "가져오기 기본" }
  ]);

  it("고를 수 있는 목록에 있는 분류는 칩과 같은 라벨로 보이고, 고르라고 재촉하지 않는다", () => {
    expect(importRowCategoryView(row({ categoryId: "cat-diaper" }), options, resolve)).toEqual({
      name: "기저귀/위생",
      needsChoice: false
    });
  });

  it("스텁 분류로 떨어진 행은 이름을 보여 주되 '골라 주세요'가 함께 붙는다", () => {
    expect(importRowCategoryView(row({ categoryId: "cat-import-stub" }), options, resolve)).toEqual({
      name: "가져오기 기본",
      needsChoice: true
    });
  });

  it("categoryId가 없으면 줄 자체를 만들지 않는다 (없는 값을 지어내지 않는다)", () => {
    expect(importRowCategoryView(row({ categoryId: undefined }), options, resolve)).toBeNull();
    expect(importRowCategoryView(row({ categoryId: "   " }), options, resolve)).toBeNull();
  });

  it("이름을 해석하지 못하면 '기타'로 단언하지 않고 줄을 지운다", () => {
    // buildCategoryNameLookup은 모르는 id를 "기타"로 떨어뜨린다 -- 아직 승인하지 않은 행에는
    // 그 단언이 거짓이 될 수 있으므로 이 모듈은 null을 쓴다.
    expect(resolve("모르는-id")).toBeNull();
    expect(importRowCategoryView(row({ categoryId: "모르는-id" }), options, resolve)).toBeNull();
  });

  it("분류 목록을 아직 못 받았으면(0건) 멀쩡한 행에 '골라 주세요'를 붙이지 않는다", () => {
    expect(importRowCategoryView(row({ categoryId: "cat-import-stub" }), [], resolve)).toEqual({
      name: "가져오기 기본",
      needsChoice: false
    });
    expect(importRowCategoryView(row({ categoryId: "cat-diaper" }), [], null)).toBeNull();
  });

  it("잠금 카드는 accessible 한 덩어리라 분류를 라벨에도 싣는다", () => {
    const view = importRowCategoryView(row({ categoryId: "cat-diaper" }), options, resolve);
    expect(importRowCategoryA11ySuffix(view)).toBe(`, ${IMPORT_ROW_CATEGORY_LABEL} 기저귀/위생`);
    expect(importRowCategoryA11ySuffix(null)).toBe("");
  });
});

describe("A(#2) 분류 편집 판정", () => {
  it("잠긴 행에는 분류 픽커를 열지 않는다 (분류를 바꿔도 잠긴 이유는 그대로다)", () => {
    expect(canEditImportRowCategory(row())).toBe(true);
    expect(canEditImportRowCategory(row({ validationStatus: "duplicate_candidate" }))).toBe(true);
    expect(canEditImportRowCategory(row({ validationStatus: "missing_item_name" }))).toBe(false);
    expect(canEditImportRowCategory(row({ validationStatus: "invalid_amount" }))).toBe(false);
    // 체크박스를 그리는 판정과 같은 자를 쓴다(두 벌로 갈리면 다시 침묵하는 컨트롤이 생긴다).
    for (const status of ["valid", "duplicate_candidate", "low_confidence_duplicate_candidate", "missing_date"]) {
      expect(canEditImportRowCategory(row({ validationStatus: status }))).toBe(
        isImportRowSelectable(row({ validationStatus: status }))
      );
    }
  });

  it("이미 그 분류면 PATCH를 보내지 않는다 (빈 요청이 userReviewed만 세우는 것을 막는다)", () => {
    expect(shouldPatchImportRowCategory(row({ categoryId: "cat-diaper" }), "cat-feeding")).toBe(true);
    expect(shouldPatchImportRowCategory(row({ categoryId: "cat-diaper" }), "cat-diaper")).toBe(false);
    expect(shouldPatchImportRowCategory(row({ categoryId: undefined }), "cat-diaper")).toBe(true);
    expect(shouldPatchImportRowCategory(row({ categoryId: "cat-diaper" }), "  ")).toBe(false);
  });

  it("펼침 버튼 문구는 한 자리에서 갈린다", () => {
    expect(importRowCategoryEditLabel(false)).toBe(IMPORT_ROW_CATEGORY_EDIT_LABEL);
    expect(importRowCategoryEditLabel(true)).toBe(IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL);
    expect(IMPORT_ROW_CATEGORY_EDIT_LABEL).not.toBe(IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL);
  });

  it("문구는 해요체이고 없는 기능을 약속하지 않는다 (DNC-018)", () => {
    for (const text of [
      IMPORT_ROW_CATEGORY_STUB_HINT,
      IMPORT_ROW_CATEGORY_EDIT_LABEL,
      IMPORT_ROW_CATEGORY_EDIT_CLOSE_LABEL
    ]) {
      expect(text).not.toMatch(/(습니다|하십시오|하세요\.$)/);
    }
    expect(IMPORT_ROW_CATEGORY_STUB_HINT).toContain("골라 주세요");
    expect(IMPORT_ROW_CATEGORY_LABEL).toBe("분류");
  });
});

describe("A(#2) 분류 표시·편집 배선 (app/import/[importJobId].tsx)", () => {
  const screen = () => source("app/import/[importJobId].tsx");

  it("칩 목록은 지출 수정 화면과 같은 모듈(selectableCategories)을 지난 목록만 쓴다", () => {
    const src = screen();
    expect(src).toContain('import { selectableCategories } from "../../src/categories";');
    expect(src).toContain("selectableCategories(serverCategories ?? []).map(");
    // 새 픽커를 만들지 않는다 -- 공유 CategoryChip을 쓴다.
    expect(src).toContain("<CategoryChip");
    // 행의 현재 값을 selectableCategories에 넘기면 스텁이 칩으로 되살아난다(=고를 수 있게 된다).
    expect(src).not.toContain("selectableCategories(serverCategories ?? [], row.categoryId)");
  });

  it("이름 해석은 공유 캐시 하나에서 오고 includeAll 규약을 지킨다(CAT-124)", () => {
    const src = screen();
    expect(src).toContain('queryKey: ["categories"]');
    expect(src).toContain("listCategories(authToken!, { includeAll: true })");
    expect(src).toContain("importCategoryNameResolver(serverCategories)");
    // 세션이 없으면 요청 자체가 없다(IMP-003 캡처 경로 불변).
    expect(src).toContain("enabled: Boolean(authToken),");
  });

  it("PATCH는 categoryId 하나만 싣고, 그 행만 잠근다", () => {
    const src = screen();
    expect(src).toContain("updateImportRow(authToken!, importJobId, row.id, { categoryId })");
    expect(src).toContain("shouldPatchImportRowCategory(row, categoryId)");
    // 보기 전용 참여자는 다른 편집 경로와 같은 게이트를 지난다(라운드 41 K-7).
    expect(src).toContain("explainExpenseViewOnly();");
    // 확정 버튼이 보는 그 집합에 이 행도 들어간다(반영 중 확정으로 행이 조용히 빠지지 않는다).
    expect(src).toContain("const updateCategory = useMutation({");
    expect(src).toContain("next.add(row.id);");
  });

  it("분류 줄은 값이 있을 때만 그리고, 잠금 카드에도 보인다", () => {
    const src = screen();
    expect(src).toContain("importRowCategoryView(row, categoryOptions, resolveCategoryName)");
    expect(src).toContain("{category.needsChoice ? <Text style={rowNoticeStyle}>{IMPORT_ROW_CATEGORY_STUB_HINT}</Text> : null}");
    expect(src).toContain("importRowCategoryA11ySuffix(category)");
    // 체크박스 역할·상태는 종전 문자열 그대로다(A11Y 계약).
    expect(src).toContain("accessibilityState={{ checked: row.selected, disabled }}");
  });

  it("칩은 펼친 한 행에만 마운트한다 (2,000행 가상화 유지)", () => {
    const src = screen();
    expect(src).toContain("const [expandedCategoryRowId, setExpandedCategoryRowId] = useState<string | null>(null);");
    expect(src).toContain("categoryExpanded: expandedCategoryRowId === row.id,");
    expect(src).toContain("{expanded ? (");
    // 분류 줄 자체를 listData에서 만들면(새 객체) 전 행 memo가 깨진다 -- 계산은 행 안에서 한다.
    expect(src).not.toContain("category: importRowCategoryView(");
  });
});
