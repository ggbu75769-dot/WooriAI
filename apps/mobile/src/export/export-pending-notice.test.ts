import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OFFLINE_RETRY_NOTICE,
  SYNC_ROW_PENDING_LABEL,
  SYNC_ROW_UNSENDABLE_LABEL,
  recordsCountPhrase,
  unsendableRecordsSuffixText
} from "../offline/messages";
import {
  countPendingExportBreakdown,
  evaluateExportPendingNotice,
  exportPendingNoticeText,
  exportPendingToastSuffix,
  EXPORT_PENDING_NOTICE_TEST_ID,
  isSpentOnInExportScope,
  type ExportPendingExpenseRow
} from "./export-pending-notice";
import { reportPendingScopeNoticeText } from "../reports/pending-scope-notice";

/**
 * GAP-056 #3 — CSV 내보내기가 오프라인 대기 기록을 조용히 빠뜨리던 문제.
 *
 * 고정하는 계약은 넷이다.
 *  1. 세는 대상: 이 아이의 **서버와 아직 어긋난** 지출 행 전부(syncState !== "synced"). 리포트
 *     고지와 달리 선물·환불도 센다 -- CSV는 합계가 아니라 행 목록이고, 그 행들도 실제로 어긋난다.
 *     (라운드 57 QA P1-2: 그 집합에는 "서버에 없는" 생성 대기 행과 "서버에 있으나 옛 값인" 수정·
 *     삭제 대기 행이 섞여 있다 -- 그래서 문구는 둘 중 하나를 단언하지 않는다.)
 *  2. 기간은 내보내기 칩과 같은 스코프(이번 달·올해·전체·직접 선택)이고 기준은 지출 날짜다.
 *  3. 0건이면 아무것도 그리지 않는다(카드 레이아웃 불변).
 *  4. 문구의 "동기화 대기"는 offline/messages.ts의 단일 소스에서 온다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function row(overrides: Partial<ExportPendingExpenseRow> & { spentOn?: string | null } = {}): ExportPendingExpenseRow {
  const { spentOn = "2026-08-05", ...rest } = overrides;
  return {
    childId: "child-1",
    syncState: "pending",
    payload: { spentOn },
    ...rest
  };
}

const today = "2026-08-14";

describe("GAP-056 #3 내보내기 대기 건수 판정", () => {
  it("이 아이·이 기간에서 서버가 아직 모르는 행만 센다", () => {
    const rows = [
      row(), // 대상
      row({ syncState: "syncing" }), // 전송 중도 서버 조회에는 아직 안 잡힌다
      row({ syncState: "failed" }),
      row({ syncState: "conflict" }),
      row({ syncState: "synced" }), // 서버에 있으므로 CSV에 담긴다
      row({ childId: "child-2" }), // 다른 아이
      row({ spentOn: "2026-07-31" }) // 다른 달
    ];
    expect(countPendingExportBreakdown({ rows, childId: "child-1", range: "month", todaySeoul: today }).count).toBe(4);
  });

  it("선물·환불 대기도 센다 -- 리포트 고지와 모집단이 다른 유일한 지점", () => {
    // 리포트의 고지는 합산되지 않는 구분을 빼지만(DNC-015), CSV는 구분 열을 실어 그 행들까지
    // 내보낸다. 대기 중이면 그 행들도 실제로 파일에서 빠지므로 여기서는 함께 센다.
    const rows = [
      { childId: "child-1", syncState: "pending", payload: { spentOn: "2026-08-02", expenseType: "gift" } },
      { childId: "child-1", syncState: "pending", payload: { spentOn: "2026-08-03", expenseType: "refund" } },
      { childId: "child-1", syncState: "pending", payload: { spentOn: "2026-08-04", expenseType: "expense" } }
    ];
    expect(countPendingExportBreakdown({ rows, childId: "child-1", range: "month", todaySeoul: today }).count).toBe(3);
  });

  it("아이를 아직 모르면(또는 로그아웃) 아무것도 세지 않는다", () => {
    for (const childId of [null, undefined, ""]) {
      expect(countPendingExportBreakdown({ rows: [row()], childId, range: "all", todaySeoul: today })).toEqual({
        count: 0,
        unsendableCount: 0
      });
    }
  });

  it("삭제 대기 행도 센다 -- 서버에는 아직 있어 CSV에 실리지만 이 기기에서는 이미 지운 값이다", () => {
    const pendingDeleteRow = {
      childId: "child-1",
      syncState: "pending" as const,
      pendingDelete: true,
      payload: { spentOn: "2026-08-09" }
    };
    expect(
      countPendingExportBreakdown({ rows: [pendingDeleteRow], childId: "child-1", range: "month", todaySeoul: today }).count
    ).toBe(1);
  });
});

describe("GAP-056 #3 내보내기 기간 스코프", () => {
  it("이번 달은 오늘의 서울 연-월 한 달이다", () => {
    const scope = { range: "month" as const, todaySeoul: today };
    expect(isSpentOnInExportScope("2026-08-01", scope)).toBe(true);
    expect(isSpentOnInExportScope("2026-08-31", scope)).toBe(true);
    expect(isSpentOnInExportScope("2026-07-31", scope)).toBe(false);
    expect(isSpentOnInExportScope("2026-09-01", scope)).toBe(false);
  });

  it("올해는 1월 1일부터 12월 31일까지의 같은 해다", () => {
    const scope = { range: "year" as const, todaySeoul: today };
    expect(isSpentOnInExportScope("2026-01-01", scope)).toBe(true);
    expect(isSpentOnInExportScope("2026-12-31", scope)).toBe(true);
    expect(isSpentOnInExportScope("2025-12-31", scope)).toBe(false);
  });

  it("직접 선택은 정규화된 닫힌 구간이다 (화면이 보여 준 구간 = 고지가 센 구간)", () => {
    const scope = { range: "custom" as const, todaySeoul: today, custom: { startYearMonth: "2025-11", endYearMonth: "2026-01" } };
    expect(isSpentOnInExportScope("2025-11-01", scope)).toBe(true);
    expect(isSpentOnInExportScope("2026-01-31", scope)).toBe(true);
    expect(isSpentOnInExportScope("2025-10-31", scope)).toBe(false);
    expect(isSpentOnInExportScope("2026-02-01", scope)).toBe(false);
    // 뒤집힌 입력도 정규화(맞바꾸기)를 거친 뒤 판정된다 -- export-range.ts와 같은 함수다.
    const swapped = { range: "custom" as const, todaySeoul: today, custom: { startYearMonth: "2026-01", endYearMonth: "2025-11" } };
    expect(isSpentOnInExportScope("2025-12-05", swapped)).toBe(true);
    // custom을 넘기지 않으면 이번 달 한 달(수집기와 같은 폴백).
    expect(isSpentOnInExportScope("2026-08-05", { range: "custom", todaySeoul: today })).toBe(true);
    expect(isSpentOnInExportScope("2026-07-05", { range: "custom", todaySeoul: today })).toBe(false);
  });

  it("전체는 날짜를 보지 않는다 -- 대기 행의 변경은 어느 달이든 파일에 반영되지 않는다", () => {
    const scope = { range: "all" as const, todaySeoul: today };
    expect(isSpentOnInExportScope("2015-01-01", scope)).toBe(true);
    // 날짜가 깨진 행도 파일에 반영되지 않는 것은 마찬가지라 여기서만은 세어 준다.
    expect(isSpentOnInExportScope(null, scope)).toBe(true);
    expect(isSpentOnInExportScope("2026-08", scope)).toBe(true);
  });

  it("전체가 아닌 구간에서는 깨진 날짜를 아무 달에나 세어 넣지 않는다", () => {
    for (const broken of [null, undefined, 20260805, "2026-08", "어제"]) {
      expect(isSpentOnInExportScope(broken, { range: "month", todaySeoul: today })).toBe(false);
      expect(isSpentOnInExportScope(broken, { range: "year", todaySeoul: today })).toBe(false);
    }
  });
});

describe("GAP-056 #3 고지 문구", () => {
  it("0건이면 고지 자체가 없다(카드가 한 줄도 밀리지 않는다)", () => {
    expect(evaluateExportPendingNotice({ rows: [], childId: "child-1", range: "all", todaySeoul: today })).toBeNull();
    expect(
      evaluateExportPendingNotice({
        rows: [row({ syncState: "synced" })],
        childId: "child-1",
        range: "month",
        todaySeoul: today
      })
    ).toBeNull();
    // 토스트 꼬리표도 0건이면 빈 문자열 -- 평소 토스트는 한 글자도 길어지지 않는다.
    expect(exportPendingToastSuffix(0)).toBe("");
    expect(exportPendingToastSuffix(-1)).toBe("");
  });

  it("건수를 그대로 말하고, 어휘는 기록 탭·리포트 고지와 같은 단일 소스다", () => {
    const notice = evaluateExportPendingNotice({
      rows: [row(), row({ spentOn: "2026-08-20", syncState: "failed" })],
      childId: "child-1",
      range: "month",
      todaySeoul: today
    });
    expect(notice).toEqual({
      count: 2,
      // 라운드 59 트랙 A: 영구 실패가 섞이지 않은 평소 카드는 문구가 한 글자도 바뀌지 않는다.
      unsendableCount: 0,
      text: "동기화 대기 중인 기록 2건은 이 파일에 아직 반영되지 않았어요."
    });
    expect(exportPendingToastSuffix(2)).toBe(" 동기화 대기 중인 기록 2건은 이 CSV에 아직 반영되지 않았어요.");
    // 문구를 손으로 다시 적지 않는다 -- 상태 이름은 offline/messages.ts가 정한다.
    expect(exportPendingNoticeText(1).startsWith(SYNC_ROW_PENDING_LABEL)).toBe(true);
    expect(exportPendingToastSuffix(1).trim().startsWith(SYNC_ROW_PENDING_LABEL)).toBe(true);
    // DNC-018 해요체.
    expect(exportPendingNoticeText(1).endsWith("요.")).toBe(true);
    expect(exportPendingToastSuffix(1).endsWith("요.")).toBe(true);
  });

  /**
   * 라운드 57 QA(P1-2) — **문구가 세는 규칙보다 세게 말하지 않는다.**
   *
   * 세는 것은 `syncState !== "synced"` 전부이고 거기에는 **수정 대기** 행이 들어 있다. 그 행이
   * 가리키는 지출은 서버에 있고 CSV에도 담긴다(옛 값으로). 그러니 "아직 서버에 없어요"·"담기지
   * 않아요"는 그 행에 대해 두 번 거짓이다. 문구는 리포트 고지와 같은 약한 주장(관측)까지만 한다.
   *
   * 라운드 59 통합리뷰 P1-1 — **영구 실패 갈래도 이 가드 안에 있다.** 트랙 A가 그 갈래를 새로
   * 만들면서 여기 루프는 1인자 호출만 돌고 있었고, 그 사이 새 갈래의 문장이 "빠져 있어요"라는
   * 더 센 주장으로 흘러갔다(삭제 대기·수정 대기 부분집합에 거짓). 세 문장 전부를 같은 루프에
   * 넣어, 갈래가 하나 더 생겨도 세기가 갈릴 수 없게 한다.
   */
  it("문구는 '서버에 없다'·'담기지 않는다'를 단언하지 않는다 (수정 대기 행에는 거짓이다)", () => {
    const sentences = [
      exportPendingNoticeText(3),
      exportPendingToastSuffix(3),
      // 영구 실패가 섞인 갈래(2인자) — 주어의 수식만 다르고 주장의 세기는 같아야 한다.
      exportPendingNoticeText(3, 1),
      exportPendingToastSuffix(3, 1),
      reportPendingScopeNoticeText(3),
      reportPendingScopeNoticeText(3, 1)
    ];
    for (const text of sentences) {
      expect(text).not.toContain("서버에 없");
      expect(text).not.toContain("담기지 않");
      // "빠져 있다"도 같은 세기의 단언이다 -- 삭제 대기 행은 아직 들어 있고, 수정 대기 행은
      // 옛 값으로 담긴다(둘 다 이 모집단 안에 있다).
      expect(text).not.toContain("빠져 있");
      // 남는 주장은 관측 하나: "아직 반영되지 않았다".
      expect(text).toContain("아직 반영되지 않았어요");
    }
  });

  /**
   * 라운드 59 트랙 A — 영구 실패 행을 어떻게 취급하는지 **근거를 한 문단으로** 적어 둔다.
   *
   * 코드 규칙은 자리마다 다르다(합계 유지 · 판정 제외 · 고지 어휘 분리 · 모집단 제외). 다르기
   * **때문에** 근거가 한 곳에 모여 있어야 한다 — 다음 사람이 "왜 여기만 빼지 않지?"를 각 파일에서
   * 따로 추측하기 시작하면 넷 중 하나가 조용히 다른 답으로 흘러간다. 라운드 57 QA P1-2가 세 모듈에
   * 같은 문단을 둔 관례를 그대로 잇고, 자리 넷을 담느라 파일이 다섯이 됐다(고지 어휘 분리 한 자리를
   * 리포트·CSV 두 모듈이 나눠 진다).
   */
  it("영구 실패 행 네 자리의 근거가 다섯 모듈 주석에 **글자까지 같은** 문단으로 있다", () => {
    const heading = "## 영구 실패 행의 네 자리 — 다섯 모듈이 공유하는 근거 (라운드 59 트랙 A)";
    const owners = [
      "src/offline/expense-list-reconciliation.ts",
      "src/expenses/recurring-template.ts",
      "src/reports/pending-scope-notice.ts",
      "src/export/export-pending-notice.ts",
      "src/expenses/suggest-source.ts"
    ];

    const paragraphs = owners.map((path) => {
      const moduleSource = source(path);
      const start = moduleSource.indexOf(` * ${heading}`);
      expect(start, `${path}에 공유 문단이 없다`).toBeGreaterThan(-1);
      const end = moduleSource.indexOf("빼는 것은 삭제 대기와 위 2번의 영구 실패뿐이다).", start);
      expect(end, `${path}의 공유 문단이 끝맺음까지 오지 않는다`).toBeGreaterThan(start);
      return moduleSource.slice(start, end);
    });

    // 다섯 사본이 서로 한 글자도 다르지 않다.
    for (const [index, path] of owners.entries()) {
      expect(paragraphs[index], path).toBe(paragraphs[0]);
    }

    // 문단이 실제로 네 자리를 **각자의 이유와 함께** 담고 있다(제목만 같은 껍데기 방지).
    const shared = paragraphs[0];
    for (const seat of [
      "1. **합계 유지**",
      "2. **정기 지출 판정**",
      "3. **고지 어휘 분리**",
      "4. **자동완성 모집단**"
    ]) {
      expect(shared, seat).toContain(seat);
    }
    expect(shared).toContain("한 술어로 통일하지 않는다");
    // 라운드 57 QA P1-2의 세 갈래 구분도 이 문단이 계속 진다(대체가 아니라 확장이다).
    expect(shared).toContain("**수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고");
  });
});

/**
 * 라운드 59 트랙 A — CSV 고지도 **"대기"와 "보낼 수 없음"을 가른다.**
 *
 * 리포트 고지와 같은 구분 규칙·같은 두 조각을 쓰고, 다른 것은 목적어뿐이다("이 파일"/"이 CSV"
 * vs "아래 숫자"). 그래야 같은 기기 상태를 두 화면이 같은 말로 부른다(REC-123(H4)).
 */
describe("라운드 59 트랙 A CSV 고지 — 대기와 '보낼 수 없음'을 가른다", () => {
  const failedRow = (overrides: Partial<ExportPendingExpenseRow> & { spentOn?: string } = {}) =>
    row({ syncState: "failed", lastErrorStatus: 400, lastErrorCode: "EXPENSE_ITEM_NAME_TOO_LONG", ...overrides });

  it("영구 실패 행도 건수에는 그대로 들어간다 (파일에서 빠지는 것은 사실이다)", () => {
    const rows = [row(), failedRow({ spentOn: "2026-08-06" })];
    expect(countPendingExportBreakdown({ rows, childId: "child-1", range: "month", todaySeoul: today })).toEqual({
      count: 2,
      unsendableCount: 1
    });
    // 라운드 59 통합리뷰 P2-2: 총건수만 돌려주던 옛 이름은 없앴다 -- 건수는 이 결과의 한 필드다.
    expect(countPendingExportBreakdown({ rows, childId: "child-1", range: "month", todaySeoul: today }).count).toBe(2);
  });

  it("일시 실패·레거시 실패 행은 '보낼 수 없음'이 아니다 (경계 셋)", () => {
    const rows = [
      failedRow({ spentOn: "2026-08-01" }),
      failedRow({ spentOn: "2026-08-02", lastErrorStatus: 503 }),
      row({ spentOn: "2026-08-03", syncState: "failed", lastError: "권한이 없어요." })
    ];
    expect(countPendingExportBreakdown({ rows, childId: "child-1", range: "month", todaySeoul: today })).toEqual({
      count: 3,
      unsendableCount: 1
    });
  });

  it("카드 고지와 토스트 꼬리표가 같은 두 조각으로 어휘를 가른다", () => {
    const input = {
      rows: [row(), row({ spentOn: "2026-08-06" }), failedRow({ spentOn: "2026-08-07" })],
      childId: "child-1",
      range: "month" as const,
      todaySeoul: today
    };
    const notice = evaluateExportPendingNotice(input);

    expect(notice).toEqual({
      count: 3,
      unsendableCount: 1,
      text: "기록 3건은 이 파일에 아직 반영되지 않았어요. 그중 1건은 보낼 수 없는 기록이에요."
    });
    expect(exportPendingToastSuffix(3, 1)).toBe(
      " 기록 3건은 이 CSV에 아직 반영되지 않았어요. 그중 1건은 보낼 수 없는 기록이에요."
    );
    // 두 문장 모두 "대기"를 말하지 않는다 -- 오지 않을 시점을 약속하지 않는다.
    for (const text of [notice!.text, exportPendingToastSuffix(3, 1)]) {
      expect(text).not.toContain(SYNC_ROW_PENDING_LABEL);
      expect(text).toContain(recordsCountPhrase(3));
      expect(text).toContain(unsendableRecordsSuffixText(1));
      expect(text.trim().endsWith("요.")).toBe(true);
    }
    // 0건이면 꼬리표는 여전히 빈 문자열이다(영구 실패 여부와 무관).
    expect(exportPendingToastSuffix(0, 0)).toBe("");
  });

  it("리포트 고지와 **같은 두 조각**을 쓰고 목적어만 다르다", () => {
    const csv = exportPendingNoticeText(4, 2);
    const report = reportPendingScopeNoticeText(4, 2);
    expect(csv).toContain(recordsCountPhrase(4));
    expect(report).toContain(recordsCountPhrase(4));
    expect(csv).toContain(unsendableRecordsSuffixText(2));
    expect(report).toContain(unsendableRecordsSuffixText(2));
    // 갈라지는 것은 목적어 하나뿐이다 -- 술어는 두 갈래·두 모듈이 모두 같다(통합리뷰 P1-1).
    expect(csv).toContain("이 파일에 아직 반영되지 않았어요.");
    expect(report).toContain("아래 숫자에 아직 반영되지 않았어요.");
  });
});

/**
 * 화면 배선(소스 검증 -- react-native는 vitest에서 네이티브 바인딩이 없어 렌더할 수 없다.
 * export-flow.test.ts / export-custom-range-wiring.test.ts와 같은 grep 관례).
 */
describe("GAP-056 #3 내보내기 카드 배선", () => {
  const cardSource = () => source("src/export/ExpenseCsvExport.tsx");

  it("소비 화면을 건드리지 않고 카드가 스스로 오프라인 스냅숏을 구독한다", () => {
    const src = cardSource();
    expect(src).toContain(
      'import { refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../offline/sync-controller";'
    );
    expect(src).toContain("const offlineSyncSnapshot = useOfflineSyncSnapshot();");
    // 리포트 탭과 같은 이유의 한 번 읽기(콜드 스타트에서 고지가 한 박자 늦게 뜨지 않게).
    expect(src).toContain("void refreshOfflineSyncSnapshot();");
    // 판정은 순수 모듈이 한다 -- 카드가 syncState 문자열을 직접 비교하지 않는다.
    expect(src).toContain("evaluateExportPendingNotice({");
    expect(src).toContain("rows: offlineSyncSnapshot.rows,");
    expect(src).not.toContain('syncState !== "synced"');
    // 소비 화면(더보기·설정)은 이 배선을 알 필요가 없다.
    for (const screen of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      expect(source(screen), `${screen} must not wire the snapshot itself`).not.toContain("useOfflineSyncSnapshot");
    }
  });

  it("고지는 대기 0건이면 렌더되지 않고, 문구를 카드가 다시 적지 않는다", () => {
    const src = cardSource();
    expect(src).toContain("{controller.pendingNotice ? (");
    expect(src).toContain(`testID={EXPORT_PENDING_NOTICE_TEST_ID}`);
    expect(EXPORT_PENDING_NOTICE_TEST_ID).toBe("export-pending-notice");
    expect(src).toContain("{controller.pendingNotice.text}");
    expect(src).not.toContain("동기화 대기 중인 기록");
  });

  it("성공·빈 결과 토스트가 대기 건을 덮지 않는다", () => {
    const src = cardSource();
    // 성공 문구 뒤에 꼬리표가 붙는다(0건이면 빈 문자열이라 종전 문장 그대로다).
    expect(src).toContain("}${exportPendingToastSuffix(pendingCount, pendingUnsendableCount)}`");
    expect(src).toContain(
      '`선택한 기간에 내보낼 기록이 없어요.${exportPendingToastSuffix(pendingCount, pendingUnsendableCount)}`'
    );
    // 대기 건수가 바뀌면 다음 내보내기의 문구도 바뀐다(고정 클로저에 갇히지 않는다).
    expect(src).toContain("customRange, pendingCount, pendingUnsendableCount, range, showToast]");
  });

  /**
   * 라운드 59 트랙 A 후속 배선 — **카드 고지와 토스트가 같은 어휘를 쓴다.**
   *
   * 두 조각을 가르는 규칙은 순수 모듈 하나(`exportPendingToastSuffix`의 두 번째 인자)인데, 카드만
   * 그 값을 지나고 토스트는 첫 인자만 넘겨서 같은 기기 상태를 한 화면 안에서 두 말로 불렀다.
   */
  it("토스트 꼬리표도 '보낼 수 없는 기록'을 가른다 (카드 고지와 같은 두 조각)", () => {
    const src = cardSource();
    // 값은 카드 고지가 이미 계산해 둔 것을 그대로 쓴다 -- 카드가 세는 규칙을 다시 적지 않는다.
    expect(src).toContain("const pendingUnsendableCount = pendingNotice?.unsendableCount ?? 0;");
    // 꼬리표 호출 두 곳 모두 두 인자를 넘긴다(한 곳만 넘기면 어휘가 다시 갈린다).
    expect(src.match(/exportPendingToastSuffix\(pendingCount, pendingUnsendableCount\)/g) ?? []).toHaveLength(2);
    expect(src).not.toMatch(/exportPendingToastSuffix\(pendingCount\)/);
    // 문구는 여전히 순수 모듈 한 곳에서만 나온다.
    expect(src).not.toContain(SYNC_ROW_UNSENDABLE_LABEL);
  });

  it("완전 오프라인 실패는 '잠시 후 다시'가 아니라 messages.ts의 정직 문구다 (라운드 52 C-07 선례)", () => {
    const src = cardSource();
    expect(src).toContain('import { OFFLINE_RETRY_NOTICE } from "../offline/messages";');
    expect(src).toContain("isOnline ? \"내보내기에 실패했어요. 잠시 후 다시 시도해주세요.\" : OFFLINE_RETRY_NOTICE");
    // 판정은 실패 시점의 폴 한 번(family 화면의 실패 Alert과 같은 관례).
    expect(src).toContain('import { isCurrentlyOnline } from "../offline/connectivity";');
    expect(src).toContain("void isCurrentlyOnline().then((isOnline) => {");
    // 오프라인 문구를 카드가 새로 짓지 않는다.
    expect(OFFLINE_RETRY_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.");
    expect(src).not.toContain("지금은 오프라인이에요");
  });

  it("잘림 두 갈래를 따로 실어 문구가 잘린 쪽을 말할 수 있게 한다 (#9)", () => {
    const src = cardSource();
    expect(src).toContain("const rowCapTruncated = collected.truncated || built.truncated;");
    expect(src).toContain("const truncated = outcome.truncated;");
    expect(src).toContain("truncated, rowCapTruncated }");
  });
});
