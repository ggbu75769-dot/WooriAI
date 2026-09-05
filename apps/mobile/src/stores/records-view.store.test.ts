import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  effectiveRecordsViewMode,
  sanitizeRecordsViewMode,
  useRecordsViewStore,
  RECORDS_VIEW_MODE_CALENDAR,
  RECORDS_VIEW_MODE_DEFAULT,
  RECORDS_VIEW_MODE_LIST
} from "./records-view.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 56 트랙 D(#10 덤) — 리스트/달력 선택을 세션 간 기억한다.
 *
 * 예전에는 화면 안 useState라 앱을 다시 열 때마다 리스트로 돌아갔다. 달력으로 훑는 것이 습관인
 * 사용자는 같은 토글을 매번 다시 눌러야 했다.
 */
describe("useRecordsViewStore", () => {
  beforeEach(() => {
    // 트랙 B: 정렬 상태도 같은 스토어에 얹혔다 — 매 테스트를 기본 상태(최신순·무접촉)에서 시작한다.
    useRecordsViewStore.setState({ mode: RECORDS_VIEW_MODE_DEFAULT, touched: false, sort: "latest", sortTouched: false });
  });

  it("기본값은 리스트다 (기록 탭의 기본 동작은 '방금 적은 것을 확인하는 목록')", () => {
    expect(RECORDS_VIEW_MODE_DEFAULT).toBe(RECORDS_VIEW_MODE_LIST);
    expect(useRecordsViewStore.getState().mode).toBe(RECORDS_VIEW_MODE_LIST);
  });

  it("고른 보기를 들고 있고, 저장 값은 화면 라벨이 아니다", () => {
    useRecordsViewStore.getState().setMode(RECORDS_VIEW_MODE_CALENDAR);
    expect(useRecordsViewStore.getState().mode).toBe("calendar");
    useRecordsViewStore.getState().setMode(RECORDS_VIEW_MODE_LIST);
    expect(useRecordsViewStore.getState().mode).toBe("list");
    // 한국어 라벨을 저장하면 문구를 다듬는 순간 옛 저장본이 통째로 무효가 된다.
    expect(RECORDS_VIEW_MODE_LIST).toBe("list");
    expect(RECORDS_VIEW_MODE_CALENDAR).toBe("calendar");
  });

  it("모르는 저장본은 기본값으로 떨어진다", () => {
    for (const broken of [undefined, null, "", "달력", "CALENDAR", 3, {}]) {
      expect(sanitizeRecordsViewMode(broken), String(broken)).toBe(RECORDS_VIEW_MODE_LIST);
    }
    expect(sanitizeRecordsViewMode("calendar")).toBe(RECORDS_VIEW_MODE_CALENDAR);
  });

  /**
   * persist는 저장본을 읽고 나서 상태를 **통째로 교체**한다. 기록 리마인더 알림이
   * `view=calendar`로 착지시킨 직후 그 교체가 끝나면, 사용자가 방금 도착한 달력이 저장본의
   * "리스트"로 조용히 되감긴다.
   */
  it("하이드레이션이 이미 바뀐 보기를 되감지 않는다 (딥링크 착지 보호)", () => {
    const merge = useRecordsViewStore.persist.getOptions().merge!;

    // 아직 아무도 손대지 않았으면 저장본이 이긴다(= 세션 간 기억).
    const fresh = merge({ mode: "calendar" }, { ...useRecordsViewStore.getState(), touched: false }) as {
      mode: string;
    };
    expect(fresh.mode).toBe("calendar");

    // 이미 이 실행에서 보기가 정해졌으면 현재 값이 이긴다.
    const touched = merge({ mode: "list" }, {
      ...useRecordsViewStore.getState(),
      mode: RECORDS_VIEW_MODE_CALENDAR,
      touched: true
    }) as { mode: string };
    expect(touched.mode).toBe("calendar");
  });

  it("런타임 플래그는 저장하지 않는다 (다음 실행에는 의미가 없는 값)", () => {
    const partialize = useRecordsViewStore.persist.getOptions().partialize!;
    // 트랙 B: 저장본에는 값 둘(mode·sort)만 남는다 — touched/sortTouched는 이 실행의 것이다.
    expect(partialize({ ...useRecordsViewStore.getState(), touched: true, sortTouched: true })).toEqual({
      mode: "list",
      sort: "latest"
    });
  });

  /**
   * 기능 라운드 1 트랙 B — 정렬 선택(최신순 ↔ 금액 큰 순)도 보기 선택과 같은 규칙으로 남는다.
   * 값·sanitize의 단일 소스는 src/expenses/records-sort.ts이고, 여기서는 persist 왕복만 문다.
   */
  it("트랙 B: 정렬 기본값은 최신순이고, 고른 정렬은 화면 라벨이 아닌 값으로 남는다", () => {
    expect(useRecordsViewStore.getState().sort).toBe("latest");
    useRecordsViewStore.getState().setSort("amount");
    expect(useRecordsViewStore.getState().sort).toBe("amount");
    useRecordsViewStore.getState().setSort("latest");
    expect(useRecordsViewStore.getState().sort).toBe("latest");
  });

  it("트랙 B: persist 왕복 — 저장(partialize)→복원(merge)이 정렬을 그대로 되살린다", () => {
    const options = useRecordsViewStore.persist.getOptions();
    useRecordsViewStore.getState().setSort("amount");
    const saved = options.partialize!({ ...useRecordsViewStore.getState() });
    expect(saved).toEqual({ mode: "list", sort: "amount" });
    // 다음 실행(무접촉 상태)에서 저장본이 그대로 이긴다.
    const restored = options.merge!(saved, {
      ...useRecordsViewStore.getState(),
      sort: "latest",
      sortTouched: false,
      touched: false
    }) as { sort: string };
    expect(restored.sort).toBe("amount");
  });

  it("트랙 B: 정렬 필드가 없는 옛 저장본·손상 값은 최신순으로 떨어진다 (migrate/merge sanitize)", () => {
    const options = useRecordsViewStore.persist.getOptions();
    // 트랙 B 이전 저장본에는 sort가 아예 없다 — 버전을 올리지 않고 sanitize가 기본값을 채운다.
    expect(options.migrate!({ mode: "calendar" }, 1)).toEqual({ mode: "calendar", sort: "latest" });
    for (const broken of [undefined, null, "", "금액 큰 순", "AMOUNT", 3, {}]) {
      const merged = options.merge!({ mode: "list", sort: broken }, {
        ...useRecordsViewStore.getState(),
        sortTouched: false
      }) as { sort: string };
      expect(merged.sort, String(broken)).toBe("latest");
    }
  });

  it("트랙 B: 하이드레이션이 이미 바뀐 정렬을 되감지 않고, 플래그는 필드별이다", () => {
    const merge = useRecordsViewStore.persist.getOptions().merge!;
    // 이 실행에서 정렬을 이미 바꿨으면 현재 값이 이긴다 — 그리고 **보기는 저장본이 그대로
    // 이긴다**(플래그를 하나로 합치면 정렬만 만진 실행에서 보기 저장본까지 무효가 된다).
    const merged = merge({ mode: "calendar", sort: "latest" }, {
      ...useRecordsViewStore.getState(),
      sort: "amount",
      sortTouched: true,
      touched: false
    }) as { mode: string; sort: string };
    expect(merged.sort).toBe("amount");
    expect(merged.mode).toBe("calendar");
    // 반대 방향도 같다: 보기만 만진 실행에서 정렬 저장본은 그대로 산다.
    const reverse = merge({ mode: "list", sort: "amount" }, {
      ...useRecordsViewStore.getState(),
      mode: RECORDS_VIEW_MODE_CALENDAR,
      touched: true,
      sortTouched: false
    }) as { mode: string; sort: string };
    expect(reverse.mode).toBe("calendar");
    expect(reverse.sort).toBe("amount");
  });

  it("기록 탭이 이 스토어 한 곳만 본다 (화면 안 useState로 되돌아가지 않는다)", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('from "../../src/stores/records-view.store"');
    expect(recordsSource).toContain("const setRecordsViewMode = useRecordsViewStore((state) => state.setMode);");
    expect(recordsSource).not.toContain("useState<string>(RECORDS_VIEW_LIST)");
    // 세그먼트 배선(UX-D 계약)은 그대로다.
    expect(recordsSource).toContain(
      "<SegmentedControl options={RECORDS_VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />"
    );
    // ⚠️ 라운드 99 F3 M-2(두 시점 · 핀 이관): 종전 마지막 단언은 `setViewMode(RECORDS_VIEW_LIST);`
    // — 달력 칸 탭이 persist를 덮어쓰던 그 호출의 존재 증명이었다. 그 호출은 비저장 착지
    // 오버라이드로 대체됐고(아래 M-2 스위트), 화면에 남은 setViewMode는 세그먼트 onChange
    // 하나뿐이다 — 저장 경로가 "사용자의 보기 토글 명시 조작"으로만 좁혀졌다는 사실이 새 핀이다.
    expect(recordsSource).not.toContain("setViewMode(RECORDS_VIEW_LIST);");
  });

  /**
   * 라운드 99 F3 M-2 — 달력 날짜 착지는 보기 persist를 건드리지 않는다.
   *
   * 정렬 쪽 리뷰 M-4(records-sort.ts `effectiveRecordsSortMode`)와 대칭인 판정·배선 계약이다:
   * 착지 동안만 리스트를 얹고, persist 값은 0바이트, 명시 조작(보기 토글)·달 이동이 걷는다.
   */
  describe("M-2: 달력 날짜 착지의 비저장 보기 오버라이드", () => {
    it("착지 중에는 리스트를 보여 주고, 아니면 저장된 취향 그대로다", () => {
      expect(effectiveRecordsViewMode({ mode: RECORDS_VIEW_MODE_CALENDAR, calendarDateLanding: true })).toBe(
        RECORDS_VIEW_MODE_LIST
      );
      expect(effectiveRecordsViewMode({ mode: RECORDS_VIEW_MODE_CALENDAR, calendarDateLanding: false })).toBe(
        RECORDS_VIEW_MODE_CALENDAR
      );
      expect(effectiveRecordsViewMode({ mode: RECORDS_VIEW_MODE_LIST, calendarDateLanding: true })).toBe(
        RECORDS_VIEW_MODE_LIST
      );
      expect(effectiveRecordsViewMode({ mode: RECORDS_VIEW_MODE_LIST, calendarDateLanding: false })).toBe(
        RECORDS_VIEW_MODE_LIST
      );
    });

    it("화면 표시가 이 판정을 지나고, 착지 콜백에는 persist setter가 없다", () => {
      const recordsSource = source("app/(tabs)/records.tsx");
      expect(recordsSource).toContain(
        "effectiveRecordsViewMode({ mode: persistedRecordsViewMode, calendarDateLanding: calendarDateViewLanding })"
      );
      const selectAt = recordsSource.indexOf("const handleSelectCalendarDate = useCallback(");
      const selectEndAt = recordsSource.indexOf("const handleRecordForCalendarDate = useCallback(", selectAt);
      expect(selectAt).toBeGreaterThan(-1);
      expect(selectEndAt).toBeGreaterThan(selectAt);
      const selectBlock = recordsSource.slice(selectAt, selectEndAt);
      expect(selectBlock).toContain("setCalendarDateViewLanding(true);");
      expect(selectBlock).not.toContain("setRecordsViewMode(");
      expect(selectBlock).not.toContain("setViewMode(");
    });

    it("해제는 정렬 오버라이드와 대칭이다 — 보기 토글 명시 조작·달 이동·알림 달력 착지가 걷는다", () => {
      const recordsSource = source("app/(tabs)/records.tsx");
      // ① 보기 토글 수동 조작(setViewMode)이 두 오버라이드를 걷고 나서야 저장한다.
      const setViewModeAt = recordsSource.indexOf("const setViewMode = useCallback(");
      expect(setViewModeAt).toBeGreaterThan(-1);
      const setViewModeBlock = recordsSource.slice(setViewModeAt, recordsSource.indexOf("[setRecordsViewMode]", setViewModeAt));
      expect(setViewModeBlock).toContain("setCalendarDateViewLanding(false);");
      expect(setViewModeBlock).toContain("setCalendarDateLanding(false);");
      expect(setViewModeBlock.indexOf("setCalendarDateViewLanding(false);")).toBeLessThan(
        setViewModeBlock.indexOf("setRecordsViewMode(")
      );
      // ② 달 이동은 상태 하나(monthOffset)를 보는 effect가 걷는다 — 화살표·시트·딥링크 공통.
      expect(recordsSource).toContain("  useEffect(() => {\n    setCalendarDateViewLanding(false);\n    setCalendarDateLanding(false);\n  }, [monthOffset]);");
      // ③ 알림의 달력 착지(view=calendar)도 오버라이드를 걷어야 약속한 달력이 실제로 선다.
      const nonceAt = recordsSource.indexOf("appliedViewNonceRef.current = viewNonceParam;");
      expect(nonceAt).toBeGreaterThan(-1);
      const nonceBlock = recordsSource.slice(nonceAt, recordsSource.indexOf("}, [viewParam, viewNonceParam, setRecordsViewMode]);", nonceAt));
      expect(nonceBlock).toContain("setCalendarDateViewLanding(false);");
      expect(nonceBlock).toContain("setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);");
    });
  });
});
