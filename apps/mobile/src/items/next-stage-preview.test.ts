import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { objectParticle } from "../text/korean-particles";
import { buildNextStagePreview, type NextStagePreviewInput } from "./next-stage-preview";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 기능 라운드 1 트랙 F — 다음 시기 D-day 예고 배너의 판정·문구·배선 계약.
 *
 * 화면(react-native)은 vitest가 렌더할 수 없으므로 판정은 순수 모듈을 값으로, 배선은 소스
 * 그렙으로 문다(items-stage-band-flow.test.ts와 같은 관례). 날짜는 전부 **주입한 고정값**이다 —
 * 이 파일 어디에도 시계가 없다(라운드 90의 KST 월 경계 교훈).
 */

/** 생후 6→7개월(밴드 "0-6개월" → "6-12개월") 경계가 2026-08-10인 아이. */
const bornBase: NextStagePreviewInput = {
  stageMode: "born",
  birthDate: "2026-01-10",
  dueDate: null,
  todayIso: "2026-08-01",
  selectedBand: "0-6개월",
  celebrationVisible: false
};

/** 출산 예정일이 2026-09-15인 임신 중 아이. */
const pregnantBase: NextStagePreviewInput = {
  stageMode: "pregnant",
  dueDate: "2026-09-15",
  birthDate: null,
  todayIso: "2026-09-04",
  selectedBand: "12-24개월",
  celebrationVisible: false
};

describe("트랙 F: D-day 경계 (0/1/14/15)", () => {
  it("경계 전날(D-1)에는 선다", () => {
    const preview = buildNextStagePreview({ ...bornBase, todayIso: "2026-08-09" });
    expect(preview).not.toBeNull();
    expect(preview?.band).toBe("6-12개월");
    expect(preview?.daysUntil).toBe(1);
    expect(preview?.startDateIso).toBe("2026-08-10");
  });

  it("창의 끝(D-14)에도 선다", () => {
    const preview = buildNextStagePreview({ ...bornBase, todayIso: "2026-07-27" });
    expect(preview?.daysUntil).toBe(14);
    expect(preview?.startDateIso).toBe("2026-08-10");
  });

  it("15일 전에는 아직 서지 않는다 (창은 14일)", () => {
    expect(buildNextStagePreview({ ...bornBase, todayIso: "2026-07-26" })).toBeNull();
  });

  it("전환 당일(D-0)에는 숨는다 — 그날부터는 기본 칩이 이미 새 시기를 말한다", () => {
    expect(buildNextStagePreview({ ...bornBase, todayIso: "2026-08-10" })).toBeNull();
  });

  it("월말 생일도 도메인 산술 그대로다 (1월 31일생의 7개월 경계는 8월 31일)", () => {
    const preview = buildNextStagePreview({ ...bornBase, birthDate: "2026-01-31", todayIso: "2026-08-25" });
    expect(preview?.band).toBe("6-12개월");
    expect(preview?.daysUntil).toBe(6);
    expect(preview?.startDateIso).toBe("2026-08-31");
  });

  it("경계 달에 그 날짜가 없으면 경계가 다음 달 초로 밀린다 (10월 31일생의 13개월 경계 = 12월 1일)", () => {
    // completedMonthsBetween이 11월 30일을 12개월로 세므로(31 > 30), 밴드는 12-01에 갈린다 —
    // 이 산술을 모듈이 복제하지 않고 도메인에 묻기 때문에 여기서도 답이 하나다.
    const preview = buildNextStagePreview({
      ...bornBase,
      birthDate: "2025-10-31",
      todayIso: "2026-11-20",
      selectedBand: "6-12개월"
    });
    expect(preview?.band).toBe("12-24개월");
    expect(preview?.daysUntil).toBe(11);
    expect(preview?.startDateIso).toBe("2026-12-01");
  });
});

describe("트랙 F: 임신 → 출생 (다음 경계는 출산 예정일)", () => {
  it("예정일이 창 안이면 출생 직후 밴드(0-6개월)를 예고한다", () => {
    const preview = buildNextStagePreview(pregnantBase);
    expect(preview?.band).toBe("0-6개월");
    expect(preview?.daysUntil).toBe(11);
    expect(preview?.startDateIso).toBe("2026-09-15");
  });

  it("이미 0-6개월 칩(임신 중의 기본 칩)을 보고 있으면 숨는다", () => {
    expect(buildNextStagePreview({ ...pregnantBase, selectedBand: "0-6개월" })).toBeNull();
  });

  it("예정일 당일·지난 뒤에는 숨는다 (지난 날을 D-day로 말하지 않는다)", () => {
    expect(buildNextStagePreview({ ...pregnantBase, todayIso: "2026-09-15" })).toBeNull();
    expect(buildNextStagePreview({ ...pregnantBase, todayIso: "2026-09-16" })).toBeNull();
  });

  it("예정일 창 경계도 14/15일에서 갈린다", () => {
    expect(buildNextStagePreview({ ...pregnantBase, todayIso: "2026-09-01" })?.daysUntil).toBe(14);
    expect(buildNextStagePreview({ ...pregnantBase, todayIso: "2026-08-31" })).toBeNull();
  });

  it("예정일이 없거나 형식이 아니면 숨는다 (지어내지 않는다)", () => {
    expect(buildNextStagePreview({ ...pregnantBase, dueDate: null })).toBeNull();
    expect(buildNextStagePreview({ ...pregnantBase, dueDate: undefined })).toBeNull();
    expect(buildNextStagePreview({ ...pregnantBase, dueDate: "2026-9-15" })).toBeNull();
  });
});

describe("트랙 F: 숨김 판정", () => {
  it("stageMode가 manual이거나 모르는 값이면 숨는다 (날짜가 있어도)", () => {
    expect(buildNextStagePreview({ ...bornBase, stageMode: "manual", todayIso: "2026-08-09" })).toBeNull();
    expect(buildNextStagePreview({ ...bornBase, stageMode: undefined, todayIso: "2026-08-09" })).toBeNull();
    expect(buildNextStagePreview({ ...bornBase, stageMode: "unknown", todayIso: "2026-08-09" })).toBeNull();
  });

  it("생년월일이 없거나 형식이 아니면 숨는다", () => {
    expect(buildNextStagePreview({ ...bornBase, birthDate: null, todayIso: "2026-08-09" })).toBeNull();
    expect(buildNextStagePreview({ ...bornBase, birthDate: "not-a-date", todayIso: "2026-08-09" })).toBeNull();
    // 달력에 없는 날짜(2월 30일)도 판정 밖이다 — day-math가 굴린 날짜를 되돌려 확인한다.
    expect(buildNextStagePreview({ ...bornBase, birthDate: "2026-02-30", todayIso: "2026-08-09" })).toBeNull();
  });

  it("오늘이 형식이 아니면 숨는다", () => {
    expect(buildNextStagePreview({ ...bornBase, todayIso: "언젠가" })).toBeNull();
  });

  it("마지막 밴드(24개월+)에서는 더 예고할 시기가 없다", () => {
    // 생후 4년 8개월(kid_4_7) — 어느 날을 넣어도 다음 밴드가 없다.
    expect(
      buildNextStagePreview({ ...bornBase, birthDate: "2022-01-05", todayIso: "2026-09-04", selectedBand: "24개월+" })
    ).toBeNull();
  });

  it("스테이지가 바뀌어도 밴드가 같으면 예고하지 않는다 (47→48개월은 둘 다 24개월+ 칩)", () => {
    expect(
      buildNextStagePreview({ ...bornBase, birthDate: "2022-10-01", todayIso: "2026-09-25", selectedBand: "0-6개월" })
    ).toBeNull();
  });

  it("이미 다음 밴드를 보고 있으면 숨는다", () => {
    expect(
      buildNextStagePreview({ ...bornBase, todayIso: "2026-08-09", selectedBand: "6-12개월" })
    ).toBeNull();
  });

  it("100% 축하 배너가 서 있으면 양보한다 — 같은 행선지를 두 배너가 말하지 않는다", () => {
    expect(
      buildNextStagePreview({ ...bornBase, todayIso: "2026-08-09", celebrationVisible: true })
    ).toBeNull();
  });

  it("겹치는 밴드의 갈림도 도메인 나이가 정한다 (24개월 경계 → 24개월+ 예고)", () => {
    const preview = buildNextStagePreview({
      ...bornBase,
      birthDate: "2024-09-20",
      todayIso: "2026-09-10",
      selectedBand: "12-24개월"
    });
    expect(preview?.band).toBe("24개월+");
    expect(preview?.daysUntil).toBe(10);
    expect(preview?.startDateIso).toBe("2026-09-20");
  });
});

describe("트랙 F: 문구 — 정보 제공만, 수·조사는 값에서", () => {
  const d1 = () => buildNextStagePreview({ ...bornBase, todayIso: "2026-08-09" })!;

  it("제목은 밴드와 D-N을 값 그대로 말한다", () => {
    expect(d1().title).toBe("6-12개월 시기가 D-1일 뒤에 시작돼요");
  });

  it("버튼 라벨의 을/를은 밴드 라벨의 받침에서 갈린다 (korean-particles 단일 소스)", () => {
    expect(d1().previewActionLabel).toBe("6-12개월을 미리 볼까요?");
    expect(d1().previewActionLabel).toBe(`6-12개월${objectParticle("6-12개월")} 미리 볼까요?`);
    // 받침 판정이 서지 않는 라벨(24개월+)은 저장소 관례대로 받침 없는 형으로 떨어진다.
    const overlapping = buildNextStagePreview({
      ...bornBase,
      birthDate: "2024-09-20",
      todayIso: "2026-09-10",
      selectedBand: "12-24개월"
    })!;
    expect(overlapping.previewActionLabel).toBe("24개월+를 미리 볼까요?");
    expect(overlapping.previewActionLabel).toBe(`24개월+${objectParticle("24개월+")} 미리 볼까요?`);
  });

  it("TalkBack 문장은 D-를 소리로 풀고, 눌렀을 때 생기는 일까지 말한다", () => {
    expect(d1().accessibilityLabel).toBe("6-12개월 시기가 1일 뒤에 시작돼요. 6-12개월을 미리 볼까요?");
  });

  it("전환·구매를 재촉하지 않는다 (prep-milestones 머리말의 규율: 구매를 재촉하지 않는다)", () => {
    const preview = d1();
    for (const text of [preview.title, preview.previewActionLabel, preview.accessibilityLabel]) {
      for (const forbidden of ["구매", "사세요", "지금 바로", "서두르", "늦기 전에", "놓치"]) {
        expect(text, `"${text}"에 재촉 표현이 없다`).not.toContain(forbidden);
      }
    }
    // 인용한 규율이 원문에 실재하는지 값으로 확인한다(유령 인용 방지).
    expect(source("src/items/prep-milestones.ts")).toContain("구매를 재촉하지 않는다");
  });
});

describe("트랙 F: 배선 (소스 계약)", () => {
  const itemsScreen = () => source("app/(tabs)/items.tsx");
  const moduleSource = () => source("src/items/next-stage-preview.ts");

  it("화면은 서울 오늘을 주입하고, 모듈은 시계를 읽지 않는다", () => {
    const items = itemsScreen();
    expect(items).toContain("const seoulToday = getSeoulToday();");
    expect(items).toContain("todayIso: seoulToday,");
    // 모듈에는 시계가 없다 — 오늘은 언제나 인자다(시계 의존 테스트 금지 규율의 근거).
    expect(moduleSource()).not.toContain("getSeoulToday");
    expect(moduleSource()).not.toContain("new Date(");
  });

  it("판정 입력은 이미 구독 중인 children 캐시의 그 아이다 (새 요청 0건)", () => {
    const items = itemsScreen();
    expect(items).toContain("buildNextStagePreview({");
    expect(items).toContain("stageMode: stageSourceChild.stageMode,");
    expect(items).toContain("dueDate: stageSourceChild.dueDate,");
    expect(items).toContain("birthDate: stageSourceChild.birthDate,");
    expect(items).toContain("selectedBand: stageLabel,");
    expect(items).toContain("celebrationVisible: showPrepCelebration");
  });

  it("배너 탭은 기존 시기 칩 선택이다 (새 화면·새 라우트 없음)", () => {
    const items = itemsScreen();
    const bannerAt = items.indexOf("{nextStagePreview ? (");
    expect(bannerAt).toBeGreaterThan(-1);
    const tapAt = items.indexOf("setStageLabel(nextStagePreview.band)");
    expect(tapAt, "배너 탭 핸들러가 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const bannerEndAt = items.indexOf("</View>", tapAt);
    expect(bannerEndAt, "배너 닫는 태그가 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const banner = items.slice(bannerAt, bannerEndAt);
    expect(banner).toContain("setHasManualStageSelection(true);");
    expect(banner).toContain("setStageLabel(nextStagePreview.band);");
    expect(banner).not.toContain("router.push");
  });

  it("배너는 세션 렌더의 시기 칩 줄 아래에 선다 (캡처 경로 밖 · 칩 근처)", () => {
    const items = itemsScreen();
    const previewReturnAt = items.indexOf("if (!hasSession) {");
    const chipRowAt = items.indexOf("{tabOptions.map((option) => (", previewReturnAt);
    const bannerAt = items.indexOf("{nextStagePreview ? (");
    expect(previewReturnAt).toBeGreaterThan(-1);
    expect(chipRowAt).toBeGreaterThan(previewReturnAt);
    expect(bannerAt).toBeGreaterThan(chipRowAt);
    // 판정 게이트에도 캡처 이중 게이트가 선다(비세션 조기 반환 + !isPixelLockMode).
    const declAt = items.indexOf("const nextStagePreview =");
    expect(declAt, "판정 선언이 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const declEndAt = items.indexOf("? buildNextStagePreview");
    expect(declEndAt, "판정 삼항의 몸이 실재해야 자르는 구간이 참이다").toBeGreaterThan(declAt);
    const declaration = items.slice(declAt, declEndAt);
    expect(declaration).toContain("hasSession");
    expect(declaration).toContain("!isPixelLockMode");
  });

  it("배너는 alert도 live region도 아니다 (a11y 대장의 role 단독 자리 수를 움직이지 않는다)", () => {
    const items = itemsScreen();
    const bannerAt = items.indexOf("{nextStagePreview ? (");
    expect(bannerAt).toBeGreaterThan(-1);
    const bannerCloseAt = items.indexOf(") : null}", bannerAt);
    expect(bannerCloseAt, "배너 삼항 닫힘이 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const banner = items.slice(bannerAt, bannerCloseAt);
    expect(banner).toContain('accessibilityRole="text"');
    expect(banner).not.toContain('accessibilityRole="alert"');
    expect(banner).not.toContain("accessibilityLiveRegion");
  });

  it("날짜 산술은 도메인 한 벌 재사용이다 (경계식 복제 금지)", () => {
    const module = moduleSource();
    expect(module).toContain('from "@wooriai/domain"');
    expect(module).toContain("calculateChildStage(");
    expect(module).toContain("bandForStage(");
    // 개월 경계 상수(3/6/12/47…)를 이 모듈이 다시 적지 않는다 — 답은 도메인에 묻는다.
    expect(module).not.toContain("ageMonths <=");
    expect(module).not.toContain("pregnancyWeek");
  });

  it("문구의 단일 소스는 모듈이다 — 화면이 문장을 다시 적지 않는다", () => {
    const items = itemsScreen();
    expect(items).toContain("{nextStagePreview.title}");
    expect(items).toContain("label={nextStagePreview.previewActionLabel}");
    expect(items).toContain("accessibilityLabel={nextStagePreview.accessibilityLabel}");
    expect(items).not.toContain("시기가 D-");
  });
});
