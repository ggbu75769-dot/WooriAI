// TEST-115: 경계·속성 기반 테스트 — money-date 모듈.
// 속성 기반은 라이브러리 없이 시드 고정 선형 합동 생성기(LCG)로 100케이스씩 수행한다.
import { describe, expect, it } from "vitest";
import {
  assertMoneyKrw,
  getEntryDateFloor,
  getSeoulMonthRange,
  getSeoulToday,
  isBeforeEntryDateFloor,
  isFutureSeoulDate,
  isMoneyKrw,
  isValidCalendarDate,
  ENTRY_DATE_MAX_PAST_MONTHS,
  ENTRY_DATE_MAX_PAST_YEARS,
  MONEY_KRW_MAX
} from "./money-date";

/** 시드 고정 선형 합동 생성기 — 실행마다 동일한 수열을 재현한다. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296; // [0, 1)
  };
}

function makeIntPicker(rand: () => number) {
  return (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const pad2 = (value: number) => String(value).padStart(2, "0");

describe("금액(KRW) 경계", () => {
  // GAP-054 라운드 54 P1-1: 상한이 생기기 전에는 MAX_SAFE_INTEGER까지 통과했다. 그 값들은
  // int4 컬럼에 들어갈 수 없어 저장이 아니라 5xx로 끝나므로, 이제 도메인 술어가 거절한다.
  it("상한(int4) 경계: 상한 그 자체는 허용하고 한 칸 위부터 거부한다", () => {
    expect(MONEY_KRW_MAX).toBe(2_147_483_647);
    expect(isMoneyKrw(MONEY_KRW_MAX)).toBe(true);
    expect(isMoneyKrw(MONEY_KRW_MAX - 1)).toBe(true);
    expect(assertMoneyKrw(MONEY_KRW_MAX)).toBe(MONEY_KRW_MAX);
    expect(isMoneyKrw(MONEY_KRW_MAX + 1)).toBe(false);
    expect(() => assertMoneyKrw(MONEY_KRW_MAX + 1)).toThrow("EXPENSE_AMOUNT_INVALID");
    expect(isMoneyKrw(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isMoneyKrw(Number.MAX_SAFE_INTEGER - 1)).toBe(false);
  });

  it("0·음수·소수·비수치 입력을 모두 거부한다", () => {
    expect(isMoneyKrw(0)).toBe(false);
    expect(isMoneyKrw(-0)).toBe(false);
    expect(isMoneyKrw(-1)).toBe(false);
    expect(isMoneyKrw(-Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isMoneyKrw(0.5)).toBe(false);
    expect(isMoneyKrw(Number.MIN_VALUE)).toBe(false);
    expect(isMoneyKrw(Number.EPSILON)).toBe(false);
    expect(isMoneyKrw(NaN)).toBe(false);
    expect(isMoneyKrw(Infinity)).toBe(false);
    expect(isMoneyKrw(-Infinity)).toBe(false);
    expect(isMoneyKrw("49800")).toBe(false);
    expect(isMoneyKrw(true)).toBe(false);
    expect(isMoneyKrw(null)).toBe(false);
    expect(isMoneyKrw(undefined)).toBe(false);
    expect(isMoneyKrw(49800n as unknown)).toBe(false);
  });

  it("정수 표현 한계 바로 위(2^53)도 상한 위라 거부된다", () => {
    // 2^53은 IEEE754에서 정수로 표현되지만 int4 컬럼에는 들어갈 수 없다.
    expect(isMoneyKrw(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(() => assertMoneyKrw(Number.MAX_SAFE_INTEGER + 1)).toThrow("EXPENSE_AMOUNT_INVALID");
  });

  it("[속성] 임의 양의 정수 100건: isMoneyKrw 참 + assertMoneyKrw 항등", () => {
    const rand = makeLcg(20250815);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const value = randomInt(1, MONEY_KRW_MAX);
      expect(isMoneyKrw(value)).toBe(true);
      expect(assertMoneyKrw(value)).toBe(value); // 항등(멱등: 재적용해도 동일)
      expect(assertMoneyKrw(assertMoneyKrw(value))).toBe(value);
    }
  });

  it("[속성] 상한 위 임의 정수 100건: 항상 거부", () => {
    const rand = makeLcg(540541);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const value = randomInt(MONEY_KRW_MAX + 1, Number.MAX_SAFE_INTEGER);
      expect(isMoneyKrw(value)).toBe(false);
      expect(() => assertMoneyKrw(value)).toThrow("EXPENSE_AMOUNT_INVALID");
    }
  });

  it("[속성] 임의 소수 입력 100건: 항상 거부", () => {
    const rand = makeLcg(115);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const base = randomInt(0, 1_000_000_000);
      const fraction = Math.max(rand(), Number.EPSILON); // (0, 1)
      const value = base + fraction;
      if (!Number.isInteger(value)) {
        expect(isMoneyKrw(value)).toBe(false);
        expect(() => assertMoneyKrw(value)).toThrow("EXPENSE_AMOUNT_INVALID");
      }
    }
  });
});

describe("getSeoulToday 경계", () => {
  it("연말 자정(KST) 경계에서 해를 넘긴다", () => {
    expect(getSeoulToday(new Date("2026-12-31T14:59:59.999Z"))).toBe("2026-12-31");
    expect(getSeoulToday(new Date("2026-12-31T15:00:00.000Z"))).toBe("2027-01-01");
  });

  it("윤년 2월 29일로 넘어가는 KST 자정 경계를 처리한다", () => {
    expect(getSeoulToday(new Date("2028-02-28T14:59:59.999Z"))).toBe("2028-02-28");
    expect(getSeoulToday(new Date("2028-02-28T15:00:00.000Z"))).toBe("2028-02-29");
    expect(getSeoulToday(new Date("2028-02-29T15:00:00.000Z"))).toBe("2028-03-01");
  });

  it("평년 2월 28일 다음날은 3월 1일이다", () => {
    expect(getSeoulToday(new Date("2026-02-28T15:00:00.000Z"))).toBe("2026-03-01");
  });
});

describe("getSeoulMonthRange 경계", () => {
  it("12월은 이듬해 1월 1일을 endExclusive로 낸다", () => {
    expect(getSeoulMonthRange("2026-12")).toEqual({
      yearMonth: "2026-12-01",
      startInclusive: "2026-12-01",
      endExclusive: "2027-01-01"
    });
  });

  it("1월과 날짜 포함 입력(YYYY-MM-DD)도 동일 월 범위를 낸다", () => {
    expect(getSeoulMonthRange("2026-01")).toMatchObject({ endExclusive: "2026-02-01" });
    expect(getSeoulMonthRange("2026-07-15")).toEqual(getSeoulMonthRange("2026-07"));
    expect(getSeoulMonthRange("2026-07-31")).toEqual(getSeoulMonthRange("2026-07-01"));
  });

  it("월 0·13·비수치·빈 문자열을 거부한다", () => {
    expect(() => getSeoulMonthRange("2026-00")).toThrow("YEAR_MONTH_INVALID");
    expect(() => getSeoulMonthRange("2026-13")).toThrow("YEAR_MONTH_INVALID");
    expect(() => getSeoulMonthRange("")).toThrow("YEAR_MONTH_INVALID");
    expect(() => getSeoulMonthRange("not-a-m")).toThrow("YEAR_MONTH_INVALID");
    expect(() => getSeoulMonthRange("2026")).toThrow("YEAR_MONTH_INVALID");
  });

  // 발견 사항(TEST-115): 0채움 없는 "2026-7" 입력이 거부되지 않고
  // startInclusive "2026-7-01" 같은 비정규(날짜 패턴 불일치) 문자열을 반환한다.
  // isValidCalendarDate("2026-7-01") === false 이므로 하류에서 비교/검증이 깨질 수 있다.
  // 소스 수정 금지 지침에 따라 기대 동작(거부)을 skip으로 남긴다.
  it.skip("[버그 재현] 0채움 없는 월 입력(2026-7)은 YEAR_MONTH_INVALID로 거부해야 한다", () => {
    expect(() => getSeoulMonthRange("2026-7")).toThrow("YEAR_MONTH_INVALID");
  });

  it("[속성] 임의 연·월 100건: 범위 불변식(유효 날짜, start<end, 다음 달 1일, 멱등)", () => {
    const rand = makeLcg(7777);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const year = randomInt(1901, 2099);
      const month = randomInt(1, 12);
      const input = `${year}-${pad2(month)}`;
      const range = getSeoulMonthRange(input);

      // 유효한 달력 날짜여야 한다.
      expect(isValidCalendarDate(range.startInclusive)).toBe(true);
      expect(isValidCalendarDate(range.endExclusive)).toBe(true);

      // 시작 < 끝 (사전순 = 날짜순, 동일 포맷 보장 하에서).
      expect(range.startInclusive < range.endExclusive).toBe(true);

      // endExclusive는 정확히 다음 달 1일이다 — 독립 계산으로 검증.
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      expect(range.endExclusive).toBe(`${nextYear}-${pad2(nextMonth)}-01`);

      // 멱등: 결과 startInclusive를 다시 넣어도 같은 범위가 나온다.
      expect(getSeoulMonthRange(range.startInclusive)).toEqual(range);

      // 역원 유사 관계: endExclusive를 넣으면 startInclusive가 이전 endExclusive와 일치한다(월 체인).
      expect(getSeoulMonthRange(range.endExclusive).startInclusive).toBe(range.endExclusive);
    }
  });
});

describe("isFutureSeoulDate 경계", () => {
  it("오늘과 같은 날짜는 미래가 아니다", () => {
    const now = new Date("2026-07-05T15:30:00.000Z"); // KST 2026-07-06
    expect(isFutureSeoulDate("2026-07-06", now)).toBe(false);
    expect(isFutureSeoulDate("1999-01-01", now)).toBe(false);
  });

  it("KST 자정 경계에서 미래 판정이 뒤집힌다", () => {
    // UTC 2026-08-19 14:59 → KST 08-19: 08-20은 미래.
    expect(isFutureSeoulDate("2026-08-20", new Date("2026-08-19T14:59:59.999Z"))).toBe(true);
    // 1ms 뒤 KST 08-20: 더 이상 미래가 아니다.
    expect(isFutureSeoulDate("2026-08-20", new Date("2026-08-19T15:00:00.000Z"))).toBe(false);
  });

  it("형식 위반(빈 문자열·공백·이모지·후행 개행)을 DATE_INVALID로 거부한다", () => {
    expect(() => isFutureSeoulDate("")).toThrow("DATE_INVALID");
    expect(() => isFutureSeoulDate("   ")).toThrow("DATE_INVALID");
    expect(() => isFutureSeoulDate(" 2026-07-06")).toThrow("DATE_INVALID");
    expect(() => isFutureSeoulDate("2026-07-06\n")).toThrow("DATE_INVALID");
    expect(() => isFutureSeoulDate("👶👶👶👶-07-06")).toThrow("DATE_INVALID");
    expect(() => isFutureSeoulDate("2026/07/06")).toThrow("DATE_INVALID");
  });
});

describe("isValidCalendarDate 경계", () => {
  it("세기 윤년 규칙(100년 예외·400년 재예외)을 적용한다", () => {
    expect(isValidCalendarDate("1900-02-29")).toBe(false); // 100의 배수: 평년
    expect(isValidCalendarDate("2000-02-29")).toBe(true); // 400의 배수: 윤년
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
  });

  it("월·일 0과 자릿수 위반, 공백·개행·이모지를 거부한다", () => {
    expect(isValidCalendarDate("2026-00-10")).toBe(false);
    expect(isValidCalendarDate("2026-01-00")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
    expect(isValidCalendarDate("   ")).toBe(false);
    expect(isValidCalendarDate("2026-07-06 ")).toBe(false);
    expect(isValidCalendarDate("2026-07-06\n")).toBe(false); // JS $는 개행 앞을 허용하지 않아야 함
    expect(isValidCalendarDate("2026-07-0👶")).toBe(false);
    expect(isValidCalendarDate("２０２６-07-06")).toBe(false); // 전각 숫자
  });

  it("31일이 없는 달의 31일과 12월 31일 경계를 판정한다", () => {
    expect(isValidCalendarDate("2026-06-31")).toBe(false);
    expect(isValidCalendarDate("2026-09-31")).toBe(false);
    expect(isValidCalendarDate("2026-11-31")).toBe(false);
    expect(isValidCalendarDate("2026-12-31")).toBe(true);
    expect(isValidCalendarDate("2026-01-31")).toBe(true);
  });

  it("[속성] 임의 유효 날짜 100건은 참, 말일+1일은 거짓", () => {
    const rand = makeLcg(424242);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const year = randomInt(1901, 2099);
      const month = randomInt(1, 12);
      const last = daysInMonth(year, month);
      const day = randomInt(1, last);

      expect(isValidCalendarDate(`${year}-${pad2(month)}-${pad2(day)}`)).toBe(true);

      // 말일 + 1 (예: 02-29/02-30, 04-31)은 항상 거짓 — 단 31일까지 표현 가능 범위 내에서.
      if (last < 31) {
        expect(isValidCalendarDate(`${year}-${pad2(month)}-${pad2(last + 1)}`)).toBe(false);
      }
    }
  });
});

/**
 * 라운드 68 A — 손으로 적는 날짜의 **과거 하한**(20년).
 *
 * 이 자리에 구멍이 있던 이유는 라운드 67 B와 같다: 모든 유효 과거 날짜가 통과하는 것이 종전
 * 계약이었고, 앱의 **읽는 쪽 넷**만 240개월에서 잠겨 있었다. 그래서 여기서 고정하는 것은 값
 * 하나가 아니라 **하한이 읽는 쪽의 축과 정확히 맞물리는가**다 — 달력 픽커가 마지막으로 열어
 * 주는 달의 1일이 곧 하한이어야 한다(쓰기가 읽기보다 좁으면 픽커에서 고른 날이 저장 직전에
 * 막히고, 넓으면 기록 탭이 열 수 없는 달의 지출이 다시 생긴다).
 */
describe("라운드 68 A 입력 날짜 하한(20년)", () => {
  const NOW = new Date("2026-08-29T12:00:00+09:00");

  it("상수는 240개월 = 20년 한 벌이고, 그 값이 곧 사람이 읽는 단위다", () => {
    expect(ENTRY_DATE_MAX_PAST_MONTHS).toBe(240);
    expect(ENTRY_DATE_MAX_PAST_YEARS).toBe(20);
    expect(ENTRY_DATE_MAX_PAST_YEARS * 12).toBe(ENTRY_DATE_MAX_PAST_MONTHS);
  });

  it("하한은 240개월 전 **달의 1일**이다(읽는 쪽의 축이 달이라서)", () => {
    expect(getEntryDateFloor(NOW)).toBe("2006-08-01");
    // 연 경계를 넘는 달에서도 같은 식이다(1월 → 12월로 내려간다).
    expect(getEntryDateFloor(new Date("2026-01-15T12:00:00+09:00"))).toBe("2006-01-01");
    expect(getEntryDateFloor(new Date("2026-12-31T12:00:00+09:00"))).toBe("2006-12-01");
  });

  it("경계 세 값 — 하한 당일 통과 · 하루 넘김 거부 · 오늘 통과", () => {
    expect(isBeforeEntryDateFloor("2006-08-01", NOW)).toBe(false);
    expect(isBeforeEntryDateFloor("2006-07-31", NOW)).toBe(true);
    expect(isBeforeEntryDateFloor("2026-08-29", NOW)).toBe(false);
  });

  it("실패 시나리오의 오타를 거절하고, 정상 과거 입력은 종전대로 통과한다", () => {
    // 2026을 2016으로 친 한 자리 오타는 20년 안이라 **여전히 통과한다** — 하한이 잡는 것은
    // 그보다 먼 오타다(1926-08-14, 1970-01-01 같은 값). 이 사실을 여기 못박아 두는 이유는
    // 하한을 좁히자는 다음 제안이 오면 그 대가를 먼저 보게 하기 위해서다.
    expect(isBeforeEntryDateFloor("2016-08-14", NOW)).toBe(false);
    expect(isBeforeEntryDateFloor("1926-08-14", NOW)).toBe(true);
    expect(isBeforeEntryDateFloor("1970-01-01", NOW)).toBe(true);
    for (const iso of ["2026-08-28", "2025-01-01", "2010-12-31", "2006-08-15"]) {
      expect(isBeforeEntryDateFloor(iso, NOW), iso).toBe(false);
    }
  });

  it("형식이 깨진 값에서는 isFutureSeoulDate와 **같은 방식으로** 던진다", () => {
    for (const bad of ["2026/08/29", "20260829", "", "오늘"]) {
      expect(() => isBeforeEntryDateFloor(bad, NOW), bad).toThrow("DATE_INVALID");
      expect(() => isFutureSeoulDate(bad, NOW), bad).toThrow("DATE_INVALID");
    }
  });

  it("[속성] 하한 앞뒤 100쌍 — 하한 이상은 통과, 하한 미만은 거부", () => {
    const rand = makeLcg(680108);
    const randomInt = makeIntPicker(rand);
    const floor = getEntryDateFloor(NOW);

    for (let i = 0; i < 100; i += 1) {
      const days = randomInt(0, 7300);
      const above = new Date(`${floor}T00:00:00Z`);
      above.setUTCDate(above.getUTCDate() + days);
      const aboveIso = above.toISOString().slice(0, 10);
      // 하한 + n일은 오늘을 넘길 수 있지만, 이 술어가 보는 것은 아래쪽 경계뿐이다.
      expect(isBeforeEntryDateFloor(aboveIso, NOW), aboveIso).toBe(false);

      const below = new Date(`${floor}T00:00:00Z`);
      below.setUTCDate(below.getUTCDate() - (days + 1));
      const belowIso = below.toISOString().slice(0, 10);
      expect(isBeforeEntryDateFloor(belowIso, NOW), belowIso).toBe(true);
    }
  });
});
