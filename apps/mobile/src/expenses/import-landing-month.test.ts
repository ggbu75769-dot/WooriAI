import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENTRY_DATE_MAX_PAST_MONTHS } from "@wooriai/domain";
import {
  importLandingMonthNotice,
  resolveImportLandingMonth,
  resolveInitialMonthOffset,
  MAX_PAST_MONTH_OFFSET,
  RECORDS_MONTH_PARAM
} from "./import-landing-month";

/**
 * 라운드 51 C-#11 — 엑셀 가져오기 확정 → **해당 월** 기록 탭 착지.
 *
 * 지키려는 것: 128건을 가져온 사용자가 "가계부에서 확인하기"를 눌렀을 때 빈 이번 달이 아니라
 * 그 기록들이 실제로 있는 달을 본다. 그리고 그 판정이 조금이라도 불확실하면(파라미터 오염·
 * 미래 월·날짜를 못 읽은 파일) **종전 동작 그대로**여야 한다.
 */
const TODAY = "2026-08-27";
const mobileRoot = process.cwd();

describe("resolveImportLandingMonth — 확정한 행들의 대표 월", () => {
  it("여러 달에 걸친 파일이면 가장 최근 달을 고른다", () => {
    expect(
      resolveImportLandingMonth([
        { parsedDate: "2026-03-02" },
        { parsedDate: "2026-05-19" },
        { parsedDate: "2026-04-30" }
      ])
    ).toBe("2026-05");
  });

  it("해를 넘겨도 시간순으로 비교한다(문자열 정렬이 곧 시간순)", () => {
    expect(resolveImportLandingMonth([{ parsedDate: "2025-12-31" }, { parsedDate: "2026-01-01" }])).toBe("2026-01");
  });

  it("날짜를 못 읽은 행·형식이 다른 값은 건너뛴다", () => {
    expect(
      resolveImportLandingMonth([
        {},
        { parsedDate: "" },
        { parsedDate: "  " },
        { parsedDate: "2026/03/02" },
        { parsedDate: "2026-13-01" },
        { parsedDate: "2026-03-40" },
        { parsedDate: "2026-03-02" }
      ])
    ).toBe("2026-03");
  });

  it("근거가 하나도 없으면 null (호출부는 파라미터를 붙이지 않는다)", () => {
    expect(resolveImportLandingMonth([])).toBeNull();
    expect(resolveImportLandingMonth([{}, { parsedDate: "언제인지 모름" }])).toBeNull();
  });

  it("공백이 섞인 ISO 날짜는 다듬어 읽는다", () => {
    expect(resolveImportLandingMonth([{ parsedDate: " 2026-02-11 " }])).toBe("2026-02");
  });
});

describe("resolveInitialMonthOffset — 기록 탭의 초기 월 오프셋", () => {
  it("과거 달이면 그만큼 음수 오프셋", () => {
    expect(resolveInitialMonthOffset({ monthParam: "2026-08", todayIso: TODAY })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: "2026-05", todayIso: TODAY })).toBe(-3);
    expect(resolveInitialMonthOffset({ monthParam: "2025-08", todayIso: TODAY })).toBe(-12);
    expect(resolveInitialMonthOffset({ monthParam: "2025-12", todayIso: TODAY })).toBe(-8);
  });

  it("파라미터가 없으면 종전 동작(이번 달)", () => {
    expect(resolveInitialMonthOffset({ todayIso: TODAY })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: undefined, todayIso: TODAY })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: null, todayIso: TODAY })).toBe(0);
  });

  it("형식이 오염되면 종전 동작 -- 추측해서 엉뚱한 달을 열지 않는다", () => {
    for (const bad of ["", "  ", "abc", "2026-13", "2026-00", "2026-3", "26-03", "2026-03-02", "2026/03"]) {
      expect(resolveInitialMonthOffset({ monthParam: bad, todayIso: TODAY }), bad).toBe(0);
    }
  });

  it("미래 월도 종전 동작 -- 기록 탭은 이번 달 이후로 넘어가지 않는다", () => {
    expect(resolveInitialMonthOffset({ monthParam: "2026-09", todayIso: TODAY })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: "2030-01", todayIso: TODAY })).toBe(0);
  });

  it("비상식적으로 먼 과거(20년 초과)도 종전 동작", () => {
    // 정확히 20년 전(240개월)까지는 따라간다.
    expect(resolveInitialMonthOffset({ monthParam: "2006-08", todayIso: TODAY })).toBe(-240);
    expect(resolveInitialMonthOffset({ monthParam: "2006-07", todayIso: TODAY })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: "1970-01", todayIso: TODAY })).toBe(0);
  });

  it("같은 키가 여러 번 온 딥링크(배열)는 첫 값만 본다", () => {
    expect(resolveInitialMonthOffset({ monthParam: ["2026-06", "2026-01"], todayIso: TODAY })).toBe(-2);
    expect(resolveInitialMonthOffset({ monthParam: [], todayIso: TODAY })).toBe(0);
  });

  it("오늘 값 자체가 이상하면 종전 동작", () => {
    expect(resolveInitialMonthOffset({ monthParam: "2026-05", todayIso: "" })).toBe(0);
    expect(resolveInitialMonthOffset({ monthParam: "2026-05", todayIso: "오늘" })).toBe(0);
  });
});

describe("importLandingMonthNotice — 완료 카드의 한 줄", () => {
  it("이번 달과 다른 달로 갈 때만 말한다", () => {
    expect(importLandingMonthNotice({ landingMonth: "2026-05", todayIso: TODAY })).toBe("5월 기록으로 이동해요");
  });

  it("해가 다르면 연도까지 말한다(어느 3월인지 알 수 없으면 안 된다)", () => {
    expect(importLandingMonthNotice({ landingMonth: "2025-03", todayIso: TODAY })).toBe("2025년 3월 기록으로 이동해요");
  });

  it("이번 달로 가는 경우에는 아무 말도 하지 않는다(종전과 같은 자리다)", () => {
    expect(importLandingMonthNotice({ landingMonth: "2026-08", todayIso: TODAY })).toBeNull();
  });

  it("기록 탭이 이번 달에 서게 되는 값에서는 침묵한다(안내와 실제가 갈리지 않는다)", () => {
    expect(importLandingMonthNotice({ landingMonth: null, todayIso: TODAY })).toBeNull();
    expect(importLandingMonthNotice({ landingMonth: "2026-09", todayIso: TODAY })).toBeNull();
    expect(importLandingMonthNotice({ landingMonth: "1970-01", todayIso: TODAY })).toBeNull();
    expect(importLandingMonthNotice({ landingMonth: "2026-13", todayIso: TODAY })).toBeNull();
  });

  it("해요체다(DNC-018)", () => {
    expect(importLandingMonthNotice({ landingMonth: "2026-05", todayIso: TODAY })!.endsWith("요")).toBe(true);
  });
});

/**
 * 화면 배선은 소스 검증으로 고정한다(react-native 화면은 vitest에서 렌더할 수 없다 --
 * src/expenses/auto-fill-wiring.test.ts와 같은 관례).
 */
describe("라운드 51 C-#11 화면 배선", () => {
  const importSource = readFileSync(join(mobileRoot, "app/import/[importJobId].tsx"), "utf8");
  const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

  it("가져오기 확정이 **실제로 보낸 행들**에서 대표 월을 뽑는다", () => {
    expect(importSource).toContain('from "../../src/expenses/import-landing-month"');
    expect(importSource).toContain("const confirmedIds = selectedRowIds(rowList);");
    expect(importSource).toContain(
      "landingMonthRef.current = resolveImportLandingMonth(rowList.filter((row) => confirmedIdSet.has(row.id)));"
    );
    // 확정 요청 본문은 종전과 같은 순수 판정(confirmableSelectedRowIds)에서 나온다.
    expect(importSource).toContain("return confirmImport(authToken!, importJobId, confirmedIds);");
  });

  it("대표 월을 알 때만 파라미터를 붙이고, 모르면 종전 그대로 이동한다", () => {
    expect(importSource).toContain('router.replace("/(tabs)/records");');
    expect(importSource).toContain(
      'router.replace({ pathname: "/(tabs)/records", params: { [RECORDS_MONTH_PARAM]: landingMonth } });'
    );
    expect(RECORDS_MONTH_PARAM).toBe("month");
  });

  it("완료 카드가 이동해 갈 달을 미리 말한다", () => {
    expect(importSource).toContain(
      "const recordsLandingNotice = importLandingMonthNotice({ landingMonth, todayIso: getSeoulToday() });"
    );
    expect(importSource).toContain("landingNotice={recordsLandingNotice}");
  });

  it("기록 탭은 파라미터를 **값당 한 번만** 적용한다(재렌더에 다시 적용하지 않는다)", () => {
    expect(recordsSource).toContain('from "../../src/expenses/import-landing-month"');
    // 라운드 52 C-03이 같은 호출에 `categoryId`를 더했다(리포트 드릴다운) -- month 쪽 규약은
    // 그대로이므로 여기서는 month 키가 여전히 이 호출에서 온다는 것만 고정한다.
    expect(recordsSource).toContain("const monthParams = useLocalSearchParams<{");
    expect(recordsSource).toContain("    month?: string;");
    expect(recordsSource).toContain(
      "const monthParam = Array.isArray(monthParams.month) ? monthParams.month[0] : monthParams.month;"
    );
    // 첫 마운트: 지연 초기화로 초기 오프셋을 정한다.
    expect(recordsSource).toContain(
      "const [monthOffset, setMonthOffset] = useState(() =>\n    resolveInitialMonthOffset({ monthParam, todayIso: getSeoulToday() })\n  );"
    );
    // 이미 마운트된 탭: 파라미터 값이 실제로 바뀔 때만 한 번 적용한다.
    expect(recordsSource).toContain("const appliedMonthParamRef = useRef<string | undefined>(monthParam);");
    expect(recordsSource).toContain("if (appliedMonthParamRef.current === monthParam) return;");
    expect(recordsSource).toContain("}, [monthParam]);");
    // 화면 안의 월 이동은 종전 로직 그대로다.
    expect(recordsSource).toContain("setMonthOffset((value) => value - 1);");
    expect(recordsSource).toContain("setMonthOffset((value) => value + 1);");
  });

  /**
   * 라운드 68 리뷰 C-1 — **‹ 화살표도 같은 바닥에서 멈춘다.**
   *
   * `resolveInitialMonthOffset`은 20년보다 먼 달의 `month=` 파라미터를 이번 달로 되돌린다. 그런데
   * 화살표에는 그 바닥이 없어, 파라미터로는 못 가는 달에 ‹ 를 눌러서는 갈 수 있었다. 그 달의
   * 달력 칸을 누르면 기록 시트가 그 날짜로 열리는데(handleRecordForCalendarDate →
   * `/expenses/new?spentOn=`) 저장 가드는 하한에서 거절한다 — 읽기가 쓰기보다 넓어진 자리다.
   *
   * 화면은 vitest에서 렌더할 수 없으므로 소스 계약으로 고정한다(이 파일의 다른 배선 단언과 같은
   * 관례). 고정하는 것은 두 가지: 판정이 **이 모듈의 상수**에서 나온다는 것(숫자를 화면에 다시
   * 적으면 파라미터 쪽 바닥과 갈린다)과, 그 판정이 함수 안과 버튼 양쪽에 걸린다는 것.
   */
  it("기록 탭의 ‹ 는 같은 상수에서 과거 바닥을 얻는다(파라미터 쪽과 두 벌이 아니다)", () => {
    expect(recordsSource).toContain(
      'import { MAX_PAST_MONTH_OFFSET, resolveInitialMonthOffset } from "../../src/expenses/import-landing-month";'
    );
    expect(recordsSource).toContain("const canGoPrevMonth = monthOffset > -MAX_PAST_MONTH_OFFSET;");
    // 함수 안 가드: ‹ 를 부르는 다른 자리(0건 카드의 "지난달에서 찾기")도 이 바닥을 지난다.
    expect(recordsSource).toContain("const goToPreviousMonth = () => {\n    if (!canGoPrevMonth) return;");
    // 버튼도 다음 달 잠금과 **같은 형태**로 상태를 말한다(A11Y-117).
    expect(recordsSource).toContain("accessibilityState={{ disabled: !canGoPrevMonth }}");
    expect(recordsSource).toContain("disabled={!canGoPrevMonth}");
    expect(recordsSource).toContain("opacity: canGoPrevMonth ? 1 : 0.35");
    // 숫자는 화면에 없다 — 이 모듈이(그리고 그 위 도메인이) 단일 소스다.
    expect(recordsSource).not.toMatch(/\b240\b/);
  });
});

/**
 * 라운드 68 A — 240이 적혀 있는 자리는 **하나뿐**이다.
 *
 * 라운드 54 P2-8이 이 상수를 단일 소스로 세웠고(그때 픽커가 적어 두고 있던 240을 지웠다),
 * 이번 라운드에 그 소스가 도메인으로 한 칸 더 내려갔다. 값도 이름도 동작도 여기서는 그대로다 —
 * 바뀐 이유는 하나다: 이제 **서버도 같은 하한을 쓰는데** 서버는 `apps/mobile`을 import할 수
 * 없다. 두 층이 각자 240을 적으면 P2-8이 여기서 고친 바로 그 드리프트가 다시 생긴다.
 */
describe("라운드 68 A — 하한 숫자의 단일 소스", () => {
  it("모바일 상수는 도메인 값을 그대로 읽고, 값은 종전과 같다", () => {
    expect(MAX_PAST_MONTH_OFFSET).toBe(ENTRY_DATE_MAX_PAST_MONTHS);
    expect(MAX_PAST_MONTH_OFFSET).toBe(240);
  });

  it("이 모듈에는 그 숫자가 리터럴로 적혀 있지 않다", () => {
    const source = readFileSync(join(process.cwd(), "src/expenses/import-landing-month.ts"), "utf8");
    expect(source).toContain('import { ENTRY_DATE_MAX_PAST_MONTHS } from "@wooriai/domain";');
    expect(source).toContain("export const MAX_PAST_MONTH_OFFSET = ENTRY_DATE_MAX_PAST_MONTHS;");
    expect(source).not.toMatch(/\b240\b/);
  });
});
