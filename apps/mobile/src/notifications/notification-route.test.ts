import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRecordsCalendarViewParam,
  nextRecordsViewNonce,
  notificationTapRoute,
  RECORDS_CALENDAR_VIEW,
  RECORDS_VIEW_NONCE_PARAM,
  RECORDS_VIEW_PARAM,
  resolveNotificationTapChild,
  resolveRecordsViewNonceParam
} from "./notification-route";
import { RECORDS_MONTH_PARAM, resolveInitialMonthOffset } from "../expenses/import-landing-month";
import { RECORDS_DRILLDOWN_NONCE_PARAM } from "../reports/category-drilldown";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 39 UX-O: 알림 탭 목적지 판정.
 *
 * 회귀의 핵심은 weekly_summary다 -- 예산 알림과 한 조건으로 묶여 예산 **수정 폼**으로 가고
 * 있었는데, 그 알림 본문은 "지출 내역을 확인해보세요"다. 종류별 목적지를 값으로 못박는다.
 */
describe("라운드 39 UX-O 알림 탭 목적지", () => {
  it("주간 요약은 지출 내역으로 간다 (예산 수정 폼이 아니라)", () => {
    const route = notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" });
    expect(route).toBe("/(tabs)/records");
    expect(route).not.toBe("/budget");
  });

  it("예산 80%/100% 알림은 그대로 예산 화면으로 간다", () => {
    expect(notificationTapRoute({ type: "budget_80", dedupeKey: "budget_80:child-1:2026-08" })).toBe("/budget");
    expect(notificationTapRoute({ type: "budget_100", dedupeKey: "budget_100:child-1:2026-08" })).toBe("/budget");
  });

  it("시기 전환 알림은 준비템 탭으로 간다", () => {
    expect(notificationTapRoute({ type: "stage_transition", dedupeKey: "stage_transition:child-1:12개월" })).toBe(
      "/(tabs)/items"
    );
  });

  it("구매 확인 알림은 그 준비템 상세로 간다", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending:item-diaper:1700000000000" })).toBe(
      "/items/item-diaper"
    );
  });

  it("dedupeKey에서 준비템을 못 뽑거나 모르는 종류면 준비템 목록으로 떨어진다 (기존 폴백 그대로)", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending" })).toBe("/(tabs)/items");
    expect(notificationTapRoute({ type: "something_new", dedupeKey: "something_new:1" })).toBe("/(tabs)/items");
  });
});

/**
 * 라운드 56 트랙 D(#10) — 기록 리마인더는 **달력**으로 착지한다.
 *
 * 왜 값으로 못박는가: 이 알림이 말하는 사실("며칠 동안 기록이 없어요")은 리스트에 **없는 것**이다.
 * 목적지만 기록 탭으로 두면 사용자는 있는 기록의 목록을 보게 되고, 알림이 가리킨 빈 며칠은 화면
 * 어디에도 나타나지 않는다. 빈 날을 보여 주는 화면은 달력 격자 하나뿐이다(UX-D).
 */
describe("라운드 56 D#10 record_gap 달력 착지", () => {
  it("record_gap은 기록 탭 + view=calendar + 이번 탭의 회차를 싣는다 (다른 종류는 예전 그대로 문자열 목적지)", () => {
    expect(notificationTapRoute({ type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" }, 7)).toEqual({
      pathname: "/(tabs)/records",
      params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW, [RECORDS_VIEW_NONCE_PARAM]: "7" }
    });
    // 주간 요약은 "지출 내역"을 말하므로 리스트 그대로다 -- 달력 파라미터가 번지지 않는다.
    expect(notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" })).toBe(
      "/(tabs)/records"
    );
  });

  it("파라미터 이름·값은 링크를 만드는 쪽과 읽는 쪽의 단일 소스다", () => {
    expect(RECORDS_VIEW_PARAM).toBe("view");
    expect(RECORDS_CALENDAR_VIEW).toBe("calendar");
    expect(RECORDS_VIEW_NONCE_PARAM).toBe("viewNonce");
    // 드릴다운의 회차 파라미터를 빌려 쓰지 않는다 -- 그 회차는 월·카테고리를 함께 다시
    // 적용하므로, record_gap 링크(둘 다 없다)가 그것을 타면 사용자가 걸어 둔 필터가 풀린다.
    expect(RECORDS_VIEW_NONCE_PARAM).not.toBe(RECORDS_DRILLDOWN_NONCE_PARAM);
    // 읽는 쪽(기록 탭)이 이 모듈의 상수·파서를 그대로 쓴다 -- 문자열을 두 번 적으면 "보내는데
    // 읽지 못하는" 조합이 조용히 생긴다(category-drilldown.ts P3-6과 같은 요지).
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("  isRecordsCalendarViewParam,");
    expect(recordsSource).toContain("  RECORDS_VIEW_NONCE_PARAM,");
    expect(recordsSource).toContain("  RECORDS_VIEW_PARAM,");
    expect(recordsSource).toContain("  resolveRecordsViewNonceParam");
    expect(recordsSource).toContain('} from "../../src/notifications/notification-route";');
    expect(recordsSource).toContain("const viewParam = monthParams[RECORDS_VIEW_PARAM];");
    expect(recordsSource).toContain(
      "const viewNonceParam = resolveRecordsViewNonceParam(monthParams[RECORDS_VIEW_NONCE_PARAM]);"
    );
    // 링크를 만드는 화면(알림함)도 같은 모듈의 카운터를 쓴다.
    const notificationsSource = source("app/notifications.tsx");
    expect(notificationsSource).toContain("  nextRecordsViewNonce,");
    expect(notificationsSource).toContain('} from "../src/notifications/notification-route";');
    expect(notificationsSource).toContain("router.push(notificationTapRoute(entry, nextRecordsViewNonce(), getSeoulToday()));");
  });

  /**
   * 회차 값의 형식 방어는 **링크를 만드는 쪽**에 있다: 쓸 수 없는 값이면 키 자체를 싣지 않는다.
   * 읽는 쪽이 무시할 값을 실어 보내면 착지가 조용히 예전 가드로 되돌아가고, 그게 이 항목이
   * 고치는 증상이다.
   */
  it("회차가 없거나 형식이 어긋나면 회차 키를 아예 싣지 않는다 (예전 링크와 같은 모양)", () => {
    const gap = { type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" } as const;
    for (const bad of [undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000_000_000]) {
      expect(notificationTapRoute(gap, bad as number | undefined), String(bad)).toEqual({
        pathname: "/(tabs)/records",
        params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW }
      });
    }
    // 0은 유효한 회차다(카운터의 시작점 아래 경계).
    expect(notificationTapRoute(gap, 0)).toEqual({
      pathname: "/(tabs)/records",
      params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW, [RECORDS_VIEW_NONCE_PARAM]: "0" }
    });
  });

  it("읽기 쪽 회차 파서: 배열이면 첫 값, 숫자 문자열이 아니면 null (회차가 없던 때와 같다)", () => {
    expect(resolveRecordsViewNonceParam("12")).toBe("12");
    expect(resolveRecordsViewNonceParam(["3", "9"])).toBe("3");
    for (const raw of [undefined, null, "", "-1", "1.5", "abc", "1234567890123", [], ["x"]] as const) {
      expect(resolveRecordsViewNonceParam(raw as string | string[] | null | undefined), String(raw)).toBeNull();
    }
  });

  /**
   * 카운터가 화면 state가 아니라 모듈 스코프인 이유: 알림함은 뒤로가기로 **언마운트**되는
   * 화면이라, 화면 안 카운터는 다시 들어올 때마다 0부터 시작해 같은 회차를 다시 보낸다.
   */
  it("회차 카운터는 부를 때마다 다른 값을 준다 (화면이 언마운트돼도 이어진다)", () => {
    const first = nextRecordsViewNonce();
    const second = nextRecordsViewNonce();
    const third = nextRecordsViewNonce();
    expect(Number.isInteger(first)).toBe(true);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(new Set([first, second, third]).size).toBe(3);
  });

  it("읽기 쪽 방어: 배열이면 첫 값, 모르는 값이면 false (파라미터가 없던 때와 같다)", () => {
    expect(isRecordsCalendarViewParam("calendar")).toBe(true);
    expect(isRecordsCalendarViewParam(["calendar", "list"])).toBe(true);
    for (const raw of [undefined, null, "", "list", "CALENDAR", "달력", [], ["list"]] as const) {
      expect(isRecordsCalendarViewParam(raw as string | string[] | null | undefined), String(raw)).toBe(false);
    }
  });

  /**
   * 재적용 규율(라운드 51 C-#11 · 라운드 52 QA P1-1/P2-1과 같은 계약): 기록 탭은 한 번 열리면
   * 계속 마운트된 채로 남으므로, 가드가 없으면 재렌더·뒤로가기·아이 전환마다 사용자가 방금 고른
   * 리스트를 달력으로 되돌린다. 라운드 57 QA(P1-1): 그 가드가 boolean이면 이번에는 **반대쪽**이
   * 깨진다 — 두 번째 탭부터 아무 일도 일어나지 않는다. 그래서 회차 단위 가드다.
   */
  it("기록 탭은 view 착지를 회차 단위로 적용한다 (재렌더는 되돌리지 않고, 다시 누르면 다시 간다)", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    // 앱 실행당 1회로 굳던 예전 모양은 남아 있지 않다.
    expect(recordsSource).not.toContain("const appliedViewParamRef = useRef(false);");
    expect(recordsSource).toContain("const appliedViewNonceRef = useRef<string | null | undefined>(undefined);");
    const effectStart = recordsSource.indexOf("if (!isRecordsCalendarViewParam(viewParam)) return;");
    expect(effectStart).toBeGreaterThan(0);
    // 라운드 99 F5 핀 이관: 종전에는 여기서 320바이트 창을 잘랐는데, 그 창은 effect 본문의
    // 길이를 바이트로 못박는 셈이라 기록 탭 소유 트랙이 착지 오버라이드 해제 한 줄을 더한
    // 순간 이 계약과 무관한 이유로 빨개졌다. 창의 끝을 effect의 deps 줄(모양)로 잡는다 —
    // 묻는 것은 그대로다: 회차 가드·적용·deps가 한 effect 안에 있는가.
    const effectDeps = "}, [viewParam, viewNonceParam, setRecordsViewMode]);";
    const effectEnd = recordsSource.indexOf(effectDeps, effectStart);
    expect(effectEnd, "view 착지 effect의 deps 줄").toBeGreaterThan(effectStart);
    const effect = recordsSource.slice(effectStart, effectEnd + effectDeps.length);
    expect(effect).toContain("if (appliedViewNonceRef.current === viewNonceParam) return;");
    expect(effect).toContain("appliedViewNonceRef.current = viewNonceParam;");
    expect(effect).toContain("setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);");
    // 회차가 deps에 있어야 같은 화면이 마운트된 채로도 두 번째 탭이 effect를 깨운다.
    expect(effect).toContain("}, [viewParam, viewNonceParam, setRecordsViewMode]);");
    // 소모 표시가 적용보다 **먼저** 서야 한 커밋에서 두 번 돌아도 한 번만 적용된다.
    expect(effect.indexOf("appliedViewNonceRef.current = viewNonceParam;")).toBeLessThan(
      effect.indexOf("setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);")
    );
  });

  /**
   * 재탭 시나리오를 **값으로** 고정한다: 화면의 effect 가드를 그대로 흉내 내어(초기값 undefined
   * + 회차 비교) 두 번째·세 번째 탭이 실제로 다시 적용되는지 본다. 소스 검사만으로는 "회차가
   * 매번 달라지는가"(링크 쪽)와 "달라지면 다시 적용하는가"(화면 쪽)가 맞물리는 순간을 잡을 수 없다.
   */
  it("같은 알림을 세 번 눌러도 매번 달력으로 착지한다 (예전 판은 첫 탭에서만 동작했다)", () => {
    const entry = { type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" } as const;
    // 기록 탭 effect의 가드를 그대로 옮긴 미니 모델.
    let appliedNonce: string | null | undefined = undefined;
    const applyLanding = (route: ReturnType<typeof notificationTapRoute>): boolean => {
      if (typeof route === "string") return false;
      // 라운드 66 E(#8)로 목적지 유니온에 리포트 달 착지가 합류해 객체 목적지가 둘이 됐다 --
      // 기록 탭의 effect도 자기 화면의 파라미터만 보므로, 미니 모델도 같은 자리에서 좁힌다.
      if (route.pathname !== "/(tabs)/records") return false;
      if (!isRecordsCalendarViewParam(route.params[RECORDS_VIEW_PARAM])) return false;
      const nonce = resolveRecordsViewNonceParam(route.params[RECORDS_VIEW_NONCE_PARAM]);
      if (appliedNonce === nonce) return false;
      appliedNonce = nonce;
      return true;
    };

    const landings = [1, 2, 3].map(() => applyLanding(notificationTapRoute(entry, nextRecordsViewNonce())));
    expect(landings).toEqual([true, true, true]);

    // 같은 회차의 재렌더(파라미터가 그대로 다시 흘러 들어옴)는 사용자의 선택을 되돌리지 않는다.
    const sameNonce = nextRecordsViewNonce();
    expect(applyLanding(notificationTapRoute(entry, sameNonce))).toBe(true);
    expect(applyLanding(notificationTapRoute(entry, sameNonce))).toBe(false);
  });

  /** 회차가 없는 링크(구 빌드·수기 딥링크)는 **첫 진입 1회**로 예전과 똑같이 동작한다. */
  it("회차 없는 링크는 첫 진입에서 한 번만 적용된다 (예전 가드 그대로)", () => {
    const entry = { type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" } as const;
    let appliedNonce: string | null | undefined = undefined;
    const applyLanding = (): boolean => {
      const route = notificationTapRoute(entry);
      if (typeof route === "string") return false;
      if (route.pathname !== "/(tabs)/records") return false;
      const nonce = resolveRecordsViewNonceParam(route.params[RECORDS_VIEW_NONCE_PARAM]);
      if (appliedNonce === nonce) return false;
      appliedNonce = nonce;
      return true;
    };
    expect([applyLanding(), applyLanding(), applyLanding()]).toEqual([true, false, false]);
  });

  it("DSN-053 기록 탭 디자인 불변: 달 내비 48dp·비활성 opacity와 세그먼트 배선이 그대로다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("minHeight: theme.touchTarget, minWidth: theme.touchTarget");
    expect(recordsSource).toContain("opacity: canGoNextMonth ? 1 : 0.35");
    expect(recordsSource).toContain("<SegmentedControl options={RECORDS_VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />");
    expect(recordsSource).toContain('const RECORDS_VIEW_LIST = "리스트"');
    expect(recordsSource).toContain('const RECORDS_VIEW_CALENDAR = "달력"');
  });
});

/**
 * 라운드 99 F5(M-2) — record_gap 착지는 **이번 달**을 함께 싣는다.
 *
 * ⚠️ 두 시점: 종전에는 view=calendar+viewNonce만 실었다. 이 알림이 단언하는 공백("마지막 기록이
 * N일 전이에요")은 서울 오늘 기준이라 이번 달의 사실인데, 기록 탭은 사용자가 옮겨 둔 과거 달에
 * 잔류하므로 착지가 다른 달의 달력을 보여줬다 — monthly_wrapup이 정확히 같은 이유로 달을 싣는
 * 것(위 라운드 66 E)과 같은 판단이다. 달은 호출부가 주입한 todayIso에서만 나온다(모듈은 시계를
 * 읽지 않는다).
 */
describe("라운드 99 F5(M-2) record_gap 이번 달 착지", () => {
  const gap = { type: "record_gap", dedupeKey: "record_gap:child-1:2026-W36" } as const;

  it("record_gap은 이번 달(month=YYYY-MM)을 기존 규약(RECORDS_MONTH_PARAM)으로 함께 싣는다", () => {
    expect(notificationTapRoute(gap, 7, "2026-09-05")).toEqual({
      pathname: "/(tabs)/records",
      params: {
        [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW,
        [RECORDS_MONTH_PARAM]: "2026-09",
        [RECORDS_VIEW_NONCE_PARAM]: "7"
      }
    });
    // 키 이름은 기록 탭의 기존 month 규약 그대로다(가져오기 착지·드릴다운과 같은 단일 소스).
    expect(RECORDS_MONTH_PARAM).toBe("month");
  });

  it("실은 달은 규약 파서로 되읽으면 이번 달(오프셋 0)이다 — 왕복", () => {
    const todayIso = "2026-09-05";
    const route = notificationTapRoute(gap, 1, todayIso);
    expect(typeof route).not.toBe("string");
    if (typeof route === "string") return;
    // 기록 탭이 같은 파라미터를 읽는 그 파서(resolveInitialMonthOffset)로 왕복한다: 과거 달에
    // 잔류하던 화면도 이 값으로 이번 달(오프셋 0)에 선다.
    expect(
      resolveInitialMonthOffset({ monthParam: route.params[RECORDS_MONTH_PARAM], todayIso })
    ).toBe(0);
  });

  it("오늘을 모르거나 형식이 어긋나면 달 키를 아예 싣지 않는다 (구 빌드 호출과 같은 모양)", () => {
    for (const bad of [undefined, "", "2026-9-5", "2026-13-01", "2026-09", "abc", "2026-09-32"]) {
      expect(notificationTapRoute(gap, 3, bad as string | undefined), String(bad)).toEqual({
        pathname: "/(tabs)/records",
        params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW, [RECORDS_VIEW_NONCE_PARAM]: "3" }
      });
    }
  });

  it("달이 다른 종류로 번지지 않는다 — weekly_summary는 여전히 문자열 목적지다", () => {
    expect(notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W36" }, 4, "2026-09-05")).toBe(
      "/(tabs)/records"
    );
  });

  it("링크를 만드는 화면(알림함)은 서울 오늘을 이미 주입하고 있다 (getSeoulToday — 직접 시계 없음)", () => {
    // M-2가 새 인자를 요구하지 않는 근거: monthly_wrapup의 달 착지(라운드 66 E)가 이미 세운
    // 주입이다. 이 모듈이 Date.now를 직접 읽지 않는다는 시계 규율도 함께 잡는다.
    const notificationsSource = source("app/notifications.tsx");
    expect(notificationsSource).toContain("router.push(notificationTapRoute(entry, nextRecordsViewNonce(), getSeoulToday()));");
    const routeSource = source("src/notifications/notification-route.ts");
    expect(routeSource).not.toContain("Date.now()");
  });
});

/**
 * 라운드 62 트랙 B(#2) — 알림은 **그 알림의 아이**로 데려가야 한다.
 *
 * 목적지 넷은 전부 "지금 선택된 아이"로 그려지는 화면인데, 알림 행 제목은 R20-C 이후 다른 아이의
 * 태명을 접두로 달고 있다. 그래서 "튼튼이 · 이번 달 예산의 80%를 사용했어요"를 누른 사람에게
 * **다온이의 예산 수정 화면**이 열렸고, 그 화면의 저장은 다온이의 예산을 덮었다(되돌릴 수 없다).
 *
 * 판정의 핵심은 "모르면 전환하지 않는다"다 — 지어낸 전환은 이 항목이 고치려는 오기록을 다른
 * 모양으로 만들 뿐이다.
 */
describe("라운드 62 B(#2) 알림 탭이 데려갈 아이", () => {
  const children = [
    { id: "child-1", nickname: "다온이" },
    { id: "child-2", nickname: "튼튼이" }
  ];

  it("알림이 아는 아이가 목록에 있으면 그 아이(전환 한 벌이 쓸 태명까지)를 돌려준다", () => {
    expect(resolveNotificationTapChild({ childId: "child-2" }, children)).toEqual({
      id: "child-2",
      nickname: "튼튼이"
    });
  });

  it("지금 선택된 아이의 알림도 그 아이를 그대로 돌려준다 (no-op 판정은 applyChildSwitch의 몫)", () => {
    // 이 판정은 "누구인가"만 말한다. "같은 아이면 아무 일도 하지 않는다"는 규칙은 planChildSwitch
    // 한 곳에 있고(따뜻한 캐시를 날리지 않는다), 여기서 다시 적으면 규칙이 두 벌이 된다.
    expect(resolveNotificationTapChild({ childId: "child-1" }, children)).toEqual(children[0]);
  });

  it("childId가 없는 옛 저장본은 전환하지 않는다 (지금 아이로 소급 배정하지 않는다)", () => {
    expect(resolveNotificationTapChild({}, children)).toBeNull();
    expect(resolveNotificationTapChild({ childId: undefined }, children)).toBeNull();
  });

  it("목록에 없는 아이(삭제된 아이)·목록이 아직 없을 때는 전환하지 않는다 — 이동은 종전 그대로", () => {
    expect(resolveNotificationTapChild({ childId: "child-gone" }, children)).toBeNull();
    expect(resolveNotificationTapChild({ childId: "child-1" }, undefined)).toBeNull();
    expect(resolveNotificationTapChild({ childId: "child-1" }, null)).toBeNull();
    expect(resolveNotificationTapChild({ childId: "child-1" }, [])).toBeNull();
  });

  it("아이가 하나뿐인 가구에서도 판정은 같다 (표시 게이트를 빌려 오지 않는다)", () => {
    // 태명 접두는 2명 이상일 때만 붙지만(notification-child-label.ts), 전환은 인원수가 아니라
    // "이 알림이 다른 아이의 것인가"라는 사실 문제다. 한 명이면 그 한 명이 이미 선택돼 있어
    // applyChildSwitch가 아무 일도 하지 않는다.
    const solo = [{ id: "child-1", nickname: "다온이" }];
    expect(resolveNotificationTapChild({ childId: "child-1" }, solo)).toEqual(solo[0]);
    expect(resolveNotificationTapChild({ childId: "child-2" }, solo)).toBeNull();
  });

  it("태명이 비어 있어도 전환한다 — 문구보다 목적지의 정확함이 먼저다", () => {
    const blank = [{ id: "child-1", nickname: "다온이" }, { id: "child-2", nickname: "  " }];
    expect(resolveNotificationTapChild({ childId: "child-2" }, blank)).toEqual(blank[1]);
  });

  /**
   * 화면 배선 계약: 전환은 **이동보다 먼저**, 그리고 아이 관리 화면·헤더 시트와 **같은 한 벌**로.
   * 무효화 키나 안내 문구를 이 화면이 손으로 다시 적기 시작하면, 한 벌이 무효화를 빠뜨리는 날
   * 아이 A의 캐시가 아이 B 화면에 남는다(라운드 28의 A→B 캐시 오염, HOME-138 주석).
   */
  it("알림함은 전환 한 벌(applyChildSwitch)을 push 앞에 태운다", () => {
    const screenSource = source("app/notifications.tsx");
    expect(screenSource).toContain('import { applyChildSwitch } from "../src/children/child-switch";');
    expect(screenSource).toContain("  resolveNotificationTapChild");
    expect(screenSource).toContain("const child = resolveNotificationTapChild(entry, householdChildren);");
    expect(screenSource).toContain("applyChildSwitch(selectedChildId, child, {");
    // 전환 한 벌의 세 부수효과는 그 함수가 든다 -- 화면은 바깥 세계만 꽂는다.
    expect(screenSource).toContain("setSelectedChildId,");
    expect(screenSource).toContain("invalidateQueries: (input) => queryClient.invalidateQueries(input),");
    expect(screenSource).toContain("announce: announceForA11y");
    // 키 목록·안내 문구를 화면이 다시 적지 않는다(child-switch.test.ts의 계약과 같은 요지).
    expect(screenSource).not.toContain("plan.invalidateKeys");
    expect(screenSource).not.toContain("CHILD_SCOPED_QUERY_KEY_PREFIXES");
    expect(screenSource).not.toContain("(으)로 전환했어요");
    // 순서: 착지 화면은 지금 선택된 아이로 그려지므로 전환이 push보다 앞서야 한다.
    const tapHandler = screenSource.slice(
      screenSource.indexOf("markRead(entry.id);"),
      screenSource.indexOf("router.push(notificationTapRoute(entry, nextRecordsViewNonce(), getSeoulToday()));")
    );
    expect(tapHandler).toContain("switchToNotificationChild(entry);");
  });

  /** 새 쿼리를 만들지 않는다: 전환에 쓰는 목록은 태명 접두가 이미 읽고 있는 그 캐시 하나뿐이다. */
  it("전환 대상 목록은 태명 접두와 같은 [\"children\"] 캐시를 쓴다 (요청 수 그대로)", () => {
    const screenSource = source("app/notifications.tsx");
    expect(screenSource).toContain("resolveNotificationChildLabel(entry.childId, householdChildren)");
    expect(screenSource.match(/useQuery\(\{/g)?.length ?? 0).toBe(1);
  });
});
