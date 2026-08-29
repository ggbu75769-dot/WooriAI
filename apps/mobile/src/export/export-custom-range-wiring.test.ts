import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GAP-054 D#11 — 사용자 지정 기간의 **화면 배선** 고정.
 *
 * 판정(경계·행 필터·파일 이름)은 export-range.test.ts가 직접 부르며 잠근다. 여기서 잠그는 것은
 * 그 판정이 화면에서 **우회되지 않는지**다: 카드가 스스로 달 계산을 하거나, 미래 달·시작>끝을
 * 자기 방식으로 막기 시작하면 두 규칙이 갈린다. react-native는 vitest에서 네이티브 바인딩이
 * 없어 렌더할 수 없으므로 소스 grep 관례를 따른다(export-flow.test.ts와 같은 방식).
 */
const mobileRoot = process.cwd();
const cardSource = readFileSync(join(mobileRoot, "src/export/ExpenseCsvExport.tsx"), "utf8");

describe("GAP-054 D#11 내보내기 카드의 시작/끝 달 선택", () => {
  it("판정은 전부 순수 모듈에서 온다 -- 카드가 달 계산을 다시 하지 않는다", () => {
    for (const imported of [
      "canShiftCustomRange",
      "customRangeLabel",
      "defaultCustomRange",
      "exportFileName",
      "shiftCustomRange",
      "yearMonthLabel"
    ]) {
      expect(cardSource, `${imported} should come from ./export-range`).toContain(imported);
    }
    expect(cardSource).toContain('} from "./export-range"');
    // 카드가 자체 날짜 산술을 들고 있으면 미래 달 상한이 두 곳으로 갈린다.
    expect(cardSource).not.toContain("new Date(");
    expect(cardSource).not.toContain("getMonth()");
  });

  it("고른 기간은 수집기에도 그대로 넘어간다 (화면이 보여준 구간 = 내보낸 구간)", () => {
    expect(cardSource).toContain("{ custom: customRange }");
    // 고른 구간이 runExport의 의존성이라, 칩/화살표를 바꾼 뒤 바로 누르면 **그 구간**이 나간다
    // (GAP-056 #3에서 대기 건수 pendingCount가, 라운드 59 트랙 A에서 그중 보낼 수 없는 건수
    // pendingUnsendableCount가 같은 이유로 이 목록에 합류했다).
    expect(cardSource).toContain("customRange, pendingCount, pendingStorage, pendingUnsendableCount, range, showToast]");
  });

  it("직접 선택 칩을 고른 동안에만 두 줄이 열린다 (다른 구간은 종전 카드 그대로)", () => {
    expect(cardSource).toContain('{controller.range === "custom" ? (');
    expect(cardSource).toContain('<ExportMonthStepper label="시작 달" edge="start" controller={controller} />');
    expect(cardSource).toContain('<ExportMonthStepper label="끝 달" edge="end" controller={controller} />');
  });

  it("달 내비는 기록 탭과 같은 문법이다 -- chevron 26 · 48dp · 잠금은 opacity (DSN-053 P2-C)", () => {
    expect(cardSource).toContain('name={delta < 0 ? "chevron-left" : "chevron-right"} size={26}');
    expect(cardSource).toContain("minHeight: theme.touchTarget,");
    expect(cardSource).toContain("minWidth: theme.touchTarget,");
    expect(cardSource).toContain("opacity: enabled ? 1 : 0.35");
    // 잠금을 색으로 말하지 않는다(gray300 화살표는 AA 미달이라 기록 탭이 이미 버린 방식이다).
    expect(cardSource).not.toContain("theme.colors.gray300");
    // 텍스트 글리프 화살표는 쓰지 않는다.
    expect(cardSource).not.toContain("‹");
    expect(cardSource).not.toContain("›");
  });

  it("시작>끝·미래 달은 화면에서 '눌러도 안 되는' 것이 아니라 눌리지 않는 것이다", () => {
    expect(cardSource).toContain("const enabled = controller.canShiftCustomMonth(edge, delta);");
    expect(cardSource).toContain("disabled={!enabled}");
    expect(cardSource).toContain("accessibilityState={{ disabled: !enabled }}");
    // 스크린리더는 어느 쪽 달을 옮기는지 알아야 한다("이전 달"만으로는 시작인지 끝인지 모른다).
    expect(cardSource).toContain('accessibilityLabel={`${label} ${delta < 0 ? "이전" : "다음"} 달`}');
    // 라운드 67 트랙 C(#5): 그 문장은 이제 시트 트리거가 진다(아래 describe) -- 어느 쪽 달인지를
    // 말한다는 사실 자체는 한 글자도 바뀌지 않았다.
    expect(cardSource).toContain("monthJumpTriggerAccessibilityLabel(`${label} ${monthLabel}`)");
  });

  it("붙여 넣은 뒤 무슨 이름으로 저장할지까지 말한다 (텍스트 공유 안내와 한 벌)", () => {
    expect(cardSource).toContain('export const EXPORT_FILE_NAME_LABEL = "저장할 이름"');
    expect(cardSource).toContain("{EXPORT_FILE_NAME_LABEL}: {controller.fileName}");
    // 라운드 66 트랙 B(#3): 같은 호출에 아이 라벨 한 칸이 더 붙었다(기간 계산은 그대로다).
    expect(cardSource).toContain(
      "exportFileName({ range, todaySeoul: getSeoulToday(), custom: customRange, childLabel: childScopeLabel })"
    );
    // 파일이 아니라 텍스트라는 기존 고지는 그대로 남아 있어야 한다(D#11이 지우지 않았다).
    expect(cardSource).toContain("<Text style={exportCardNoticeStyle}>{EXPORT_TEXT_SHARE_NOTICE}</Text>");
  });

  it("고른 구간을 사람이 읽는 문장으로도 확인시킨다", () => {
    expect(cardSource).toContain("{customRangeLabel(controller.customRange)} 기록을 내보내요.");
  });
});

/**
 * 라운드 67 트랙 C(#5) — 두 달 라벨이 **달 점프 시트**의 입구가 된다.
 *
 * 판정은 여기서 단언하지 않는다(export-range.test.ts가 경계 셋을 직접 부르며 잠근다). 여기서
 * 잠그는 것은 화면이 그 판정을 **우회하지 않는지** 하나다: 카드가 자기 격자를 그리거나, 시트를
 * 새로 만들거나, 고른 달을 자기 방식으로 넣기 시작하면 같은 규칙이 두 벌이 된다.
 */
describe("라운드 67 트랙 C(#5) 내보내기 달 라벨 → 월 선택 시트", () => {
  it("기록·리포트 탭과 **같은 시트**를 연다 (새 시트를 만들지 않는다)", () => {
    expect(cardSource).toContain('import { MonthJumpSheet } from "../MonthJumpSheet";');
    expect(cardSource).toContain('} from "../month-jump";');
    // 카드 안에 시트는 한 벌뿐이다(끝마다 한 번씩 그려지는 같은 컴포넌트).
    expect((cardSource.match(/<MonthJumpSheet/g) ?? []).length).toBe(1);
    // 격자·연도 스테퍼를 카드가 다시 짓지 않는다.
    expect(cardSource).not.toContain("buildMonthJumpYear");
  });

  it("두 라벨이 눌리고, 열린 쪽은 한 번에 하나다", () => {
    // 트리거·시트는 끝마다 한 벌씩 서지만 소스에는 한 번만 적힌다(같은 컴포넌트가 edge를 받는다).
    expect(cardSource).toContain("testID={`export-${edge}-month-jump-trigger`}");
    expect(cardSource).toContain("testID={`export-${edge}-month-jump-sheet`}");
    expect(cardSource).toContain("const monthJumpOpen = controller.monthJumpEdge === edge;");
    expect(cardSource).toContain("setMonthJumpEdge((open) => (open === edge ? null : edge));");
    // 감싸기만 한다 -- 라벨 스타일은 종전 그대로다(렌더 불변).
    expect(cardSource).toContain("<Text style={exportMonthValueStyle}>{monthLabel}</Text>");
  });

  it("경계·이유 문장·고른 달의 반영은 전부 순수 모듈에서 온다", () => {
    for (const imported of ["customRangeMonthJumpBounds", "EXPORT_MONTH_JUMP_HINT", "selectCustomRangeMonth"]) {
      expect(cardSource, imported).toContain(imported);
    }
    expect(cardSource).toContain("bounds={controller.monthJumpBounds(edge)}");
    expect(cardSource).toContain("controller.selectCustomMonth(edge, next)");
    // "왜 못 고르는지"의 문장이 카드에 리터럴로 없다(있으면 시트와 카드가 갈린다).
    expect(cardSource).not.toContain("고를 수 없어요");
  });

  it("스테퍼는 그대로 남는다 -- 시트는 대안이지 대체가 아니다", () => {
    expect(cardSource).toContain("const stepButton = (delta: -1 | 1) => {");
    expect(cardSource).toContain("onPress={() => controller.shiftCustomMonth(edge, delta)}");
    expect(cardSource).toContain('<ExportMonthStepper label="시작 달" edge="start" controller={controller} />');
  });

  it("구간 칩을 옮기면 열려 있던 시트가 닫힌다 (연 적 없는 시트가 서 있지 않게)", () => {
    expect(cardSource).toContain("const selectRange = useCallback((next: ExportRange) => {");
    expect(cardSource).toContain("setRange: selectRange,");
  });
});
