import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import { buildCategoryNameLookup } from "../categories";
import { buildExpenseCsv } from "./expense-csv";
import { capCsvForShare, csvShareToastMessage, MAX_SHARE_MESSAGE_BYTES, utf8ByteLength } from "./share-payload";

describe("EXP-106 share payload cap (Share.share message path)", () => {
  it("measures UTF-8 bytes correctly for ASCII, Korean, and astral characters", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("날짜")).toBe(6); // Hangul syllables: 3 bytes each
    expect(utf8ByteLength("👶")).toBe(4); // astral plane: 4 bytes
    expect(utf8ByteLength("")).toBe(0);
  });

  it("defaults to a ~100KB budget", () => {
    expect(MAX_SHARE_MESSAGE_BYTES).toBe(102400);
  });

  it("returns small CSVs untouched", () => {
    const csv = "날짜,금액\r\n2026-08-01,1000\r\n";
    expect(capCsvForShare(csv)).toEqual({ message: csv, truncated: false, droppedRows: 0 });
  });

  it("truncates at whole-row boundaries, always keeping the header", () => {
    const header = "날짜,금액";
    const rows = ["2026-08-01,1000", "2026-08-02,2000", "2026-08-03,3000"];
    const csv = `${header}\r\n${rows.join("\r\n")}\r\n`;
    // Budget fits header + first row only.
    const budget = utf8ByteLength(header) + 2 + utf8ByteLength(rows[0]) + 2;
    const result = capCsvForShare(csv, budget);
    expect(result.message).toBe(`${header}\r\n${rows[0]}\r\n`);
    expect(result.truncated).toBe(true);
    expect(result.droppedRows).toBe(2);
    expect(utf8ByteLength(result.message)).toBeLessThanOrEqual(budget);
  });

  it("keeps the header even when the budget is smaller than the header itself", () => {
    const csv = "날짜,카테고리,항목,금액(원),메모,출처\r\nrow-1\r\n";
    const result = capCsvForShare(csv, 4);
    expect(result.message).toBe("날짜,카테고리,항목,금액(원),메모,출처\r\n");
    expect(result.truncated).toBe(true);
    expect(result.droppedRows).toBe(1);
  });
});

/**
 * 라운드 106 T6 — **개행이 든 칸**이 있는 CSV에서도 잘림이 RFC 4180 레코드 경계에서 일어난다.
 *
 * 실측(고치기 전): 메모에 개행이 든 5행 CSV를 용량으로 자르면 본문 마지막 줄이
 * `...,"첫 줄` 로 끝났다 — 따옴표가 닫히지 않은 CSV다. 그리고 `droppedRows`가 줄 수를 세는
 * 바람에 데이터 4행이 빠진 자리에서 8을 돌려줬고, 호출부(ExpenseCsvExport.tsx)의
 * `built.rowCount - outcome.droppedRows`가 음수로 내려갈 수 있었다.
 */
describe("라운드 106 T6: 개행이 든 칸과 용량 잘림 (RFC 4180 레코드 경계)", () => {
  function makeExpense(overrides: Partial<Expense> = {}): Expense {
    return {
      id: "e-1",
      childId: "child-1",
      categoryId: "cat-x",
      amountKrw: 45900,
      spentOn: "2026-08-01",
      itemName: "기저귀",
      merchant: null,
      memo: null,
      expenseType: "expense",
      source: "manual",
      version: 1,
      ...overrides
    };
  }

  /** 개행이 든 메모 5건짜리 **실제** CSV — 손으로 지어낸 문자열이 아니라 빌더가 만든 것 그대로. */
  function multilineBuild() {
    return buildExpenseCsv(
      Array.from({ length: 5 }, (_, index) => makeExpense({ id: `e${index}`, memo: `첫 줄\r\n둘째 줄 ${index}` }))
    );
  }

  it("따옴표 한가운데서 자르지 않는다 — 어떤 예산에서도 따옴표 개수가 짝수다", () => {
    const { csv } = multilineBuild();
    const full = utf8ByteLength(csv);
    // 헤더만 남는 예산부터 전량이 들어가는 예산까지 한 바이트씩 훑는다.
    for (let budget = 1; budget <= full; budget += 1) {
      const { message } = capCsvForShare(csv, budget);
      const quoteCount = (message.match(/"/g) ?? []).length;
      expect(quoteCount % 2, `예산 ${budget}바이트에서 따옴표가 닫히지 않았다`).toBe(0);
      // 레코드는 언제나 CRLF로 끝난다 — 잘린 레코드 조각이 남지 않는다.
      expect(message.endsWith("\r\n"), `예산 ${budget}바이트에서 레코드가 잘렸다`).toBe(true);
    }
  });

  it("droppedRows는 줄이 아니라 레코드를 센다 — 토스트 건수가 음수로 내려가지 않는다", () => {
    const built = multilineBuild();
    expect(built.rowCount).toBe(5);

    const full = utf8ByteLength(built.csv);
    for (let budget = 1; budget <= full; budget += 1) {
      const capped = capCsvForShare(built.csv, budget);
      expect(capped.droppedRows).toBeLessThanOrEqual(built.rowCount);
      // ExpenseCsvExport.tsx가 토스트 건수를 만드는 식 그대로.
      expect(built.rowCount - capped.droppedRows, `예산 ${budget}바이트에서 건수가 음수다`).toBeGreaterThanOrEqual(0);
    }

    // 헤더만 남는 예산에서는 데이터 5건이 전부 빠진다(줄 수 8이 아니다).
    const headerOnly = capCsvForShare(built.csv, 1);
    expect(headerOnly.droppedRows).toBe(5);
    expect(headerOnly.message.split("\r\n").filter(Boolean)).toHaveLength(1);
  });

  it("커스텀 분류 이름에 쉼표·따옴표가 들어가도 같은 규칙이다 (라운드 103 자유 문자열)", () => {
    const categoryName = buildCategoryNameLookup([{ id: "cat-x", name: '아빠, "비상"금' }]);
    const built = buildExpenseCsv(
      Array.from({ length: 4 }, (_, index) => makeExpense({ id: `e${index}` })),
      { categoryName }
    );
    const full = utf8ByteLength(built.csv);
    for (let budget = 1; budget <= full; budget += 1) {
      const { message } = capCsvForShare(built.csv, budget);
      expect((message.match(/"/g) ?? []).length % 2).toBe(0);
      expect(message.endsWith("\r\n")).toBe(true);
    }
  });

  it("개행이 없는 CSV(대다수)에서는 예전 줄 단위 계산과 결과가 같다", () => {
    const header = "날짜,금액";
    const rows = ["2026-08-01,1000", "2026-08-02,2000", "2026-08-03,3000"];
    const csv = `${header}\r\n${rows.join("\r\n")}\r\n`;
    const budget = utf8ByteLength(header) + 2 + utf8ByteLength(rows[0]) + 2;
    expect(capCsvForShare(csv, budget)).toEqual({
      message: `${header}\r\n${rows[0]}\r\n`,
      truncated: true,
      droppedRows: 2
    });
  });
});

/**
 * GAP-056 #9 — 잘림 안내가 **어느 쪽이 잘렸는지** 말한다.
 *
 * 잘림에는 두 종류가 있고 잘리는 쪽이 정반대다: 행 상한은 최신 달부터 모으므로 오래된 기록이
 * 빠지고(export-range.ts), 공유 본문 용량 제한은 앞에서부터 채우므로 최근 기록이 빠진다
 * (위 capCsvForShare). 예전에는 둘을 한 플래그로 뭉쳐 "일부만 포함됐어요"만 말했다.
 */
describe("GAP-056 #9 CSV 토스트의 잘림 문구", () => {
  /**
   * 라운드 57 QA(P2-12) — 행 상한 쪽은 **"빠졌을 수 있어요"**다.
   *
   * 이 플래그의 출처(collectExpensesForRange의 truncated)는 "행을 실제로 버렸다"와 "상한 때문에
   * 멈춰 **열어 보지 못한** 과거 달이 남았다"를 함께 뜻한다. 뒤쪽 경우의 남은 달이 전부 비어
   * 있었다면 실제로 빠진 행은 없다 -- 그때 "빠졌어요"는 없는 손실을 단언하는 허위 통보다.
   * 방향(오래된 쪽)은 수집 방향에서 확실하므로 그대로 단언한다.
   */
  it("행 상한 쪽은 방향만 단언하고 손실은 '있을 수 있다'까지만 말한다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 5000, truncated: false, rowCapTruncated: true })).toBe(
      "기록 5000건을 내보냈어요. (행 상한에 닿아 오래된 기록이 빠졌을 수 있어요)"
    );
  });

  it("용량 제한으로 잘리면 최근 쪽이 빠졌다고 말한다 (라운드 56 B: 실제 잘리는 방향)", () => {
    // 수집기가 돌려주는 목록은 날짜 오름차순이고(export-range.ts sortBySpentOnAscending)
    // capCsvForShare는 앞에서부터 채우므로, 빠지는 것은 **뒤쪽 = 최근 기록**이다.
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 3, truncated: true })).toBe(
      "기록 3건으로 공유 화면을 열었어요. (용량 제한으로 최근 기록부터 빠졌어요)"
    );
    // rowCapTruncated를 명시적으로 false로 넘겨도 같은 문장이다(기본값 = 안 잘림).
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 3, truncated: true, rowCapTruncated: false })).toBe(
      "기록 3건으로 공유 화면을 열었어요. (용량 제한으로 최근 기록부터 빠졌어요)"
    );
  });

  it("두 잘림이 함께 일어나면 서로 반대 방향을 각각 말한다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 4000, truncated: true, rowCapTruncated: true })).toBe(
      "기록 4000건을 내보냈어요. (행 상한에 닿아 오래된 기록이 빠졌을 수 있어요 · 용량 제한으로 최근 기록부터 빠졌어요)"
    );
  });

  it("잘리지 않았으면 괄호 안내가 아예 붙지 않는다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 12, truncated: false, rowCapTruncated: false })).toBe(
      "기록 12건을 내보냈어요."
    );
  });
});
