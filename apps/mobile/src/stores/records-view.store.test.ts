import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
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
    useRecordsViewStore.setState({ mode: RECORDS_VIEW_MODE_DEFAULT, touched: false });
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
    expect(partialize({ ...useRecordsViewStore.getState(), touched: true })).toEqual({ mode: "list" });
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
    expect(recordsSource).toContain("setViewMode(RECORDS_VIEW_LIST);");
  });
});
