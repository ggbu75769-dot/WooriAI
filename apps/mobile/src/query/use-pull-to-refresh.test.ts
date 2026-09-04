import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshSpinnerTimer, PULL_TO_REFRESH_TIMEOUT_MS } from "./use-pull-to-refresh";

/**
 * T10(토스급) — 당겨서 새로고침 스피너 타이머의 단위 계약.
 *
 * 왜 팩토리를 무는가: vitest에는 react-native 렌더가 없어(refresh-wiring-contract.test.ts
 * 머리말) 훅 자체는 세울 수 없다. 그래서 타이머 규칙은 순수 팩토리로 뽑혀 있고
 * (createRefreshSpinnerTimer), 훅이 그 팩토리를 쓰는 배선은 소스 계약이 본다.
 *
 * 무는 규칙 셋:
 *  ① **최소 표시 450ms** — 캐시가 신선해 refresh가 수십 ms에 끝나도 스피너는 450ms를
 *     채우고 닫힌다(깜빡 종료가 "아무 일도 없었다"로 읽히는 것을 막는다). 450ms보다 늦게
 *     settle되면 종전과 같은 시점(=settle 즉시)에 닫힌다 — 지연을 더하지 않는다.
 *  ② **10초 안전밸브 보존** — settle이 영영 오지 않아도 밸브가 스피너를 닫는다(FIX-118A).
 *  ③ **clear()는 타이머를 정리하되 onStop을 부르지 않는다** — 언마운트 뒤 깨어난 타이머가
 *     사라진 화면에 setState를 걸지 않게 한다.
 */
describe("createRefreshSpinnerTimer (T10 최소 표시 450ms + FIX-118A 밸브)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("빠른 settle은 450ms 경계를 채우고 닫힌다 (449ms에는 안 닫힌다)", () => {
    const onStop = vi.fn();
    const timer = createRefreshSpinnerTimer(onStop);
    timer.start();
    // 캐시가 신선해 50ms 만에 settle.
    vi.advanceTimersByTime(50);
    timer.settle();
    expect(onStop).not.toHaveBeenCalled();
    // 449ms 시점: 아직 최소 표시가 안 찼다.
    vi.advanceTimersByTime(399);
    expect(onStop).not.toHaveBeenCalled();
    // 450ms 시점: 닫힌다 — 정확히 한 번.
    vi.advanceTimersByTime(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    // 남은 밸브 타이머가 정리됐다: 10초를 다 보내도 두 번째 호출이 없다.
    vi.advanceTimersByTime(PULL_TO_REFRESH_TIMEOUT_MS);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("느린 settle(450ms 이후)은 settle 즉시 닫힌다 — 지연을 더하지 않는다", () => {
    const onStop = vi.fn();
    const timer = createRefreshSpinnerTimer(onStop);
    timer.start();
    vi.advanceTimersByTime(2_000);
    expect(onStop).not.toHaveBeenCalled();
    timer.settle();
    expect(onStop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PULL_TO_REFRESH_TIMEOUT_MS);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("settle이 영영 없어도 10초 밸브가 닫는다 (FIX-118A 보존)", () => {
    const onStop = vi.fn();
    const timer = createRefreshSpinnerTimer(onStop);
    timer.start();
    vi.advanceTimersByTime(PULL_TO_REFRESH_TIMEOUT_MS - 1);
    expect(onStop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    // 뒤늦게 settle이 와도 밸브가 이미 닫았으므로 상태가 요동하지 않는다(멱등).
    timer.settle();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("clear()는 걸린 타이머를 전부 정리하고 onStop을 부르지 않는다 (언마운트 정리)", () => {
    const onStop = vi.fn();
    const timer = createRefreshSpinnerTimer(onStop);
    timer.start();
    timer.clear();
    vi.advanceTimersByTime(PULL_TO_REFRESH_TIMEOUT_MS * 2);
    expect(onStop).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("start()를 다시 부르면 이전 사이클의 타이머가 겹쳐 남지 않는다", () => {
    const onStop = vi.fn();
    const timer = createRefreshSpinnerTimer(onStop);
    timer.start();
    vi.advanceTimersByTime(200);
    // 두 번째 당김(RefreshControl은 보통 막지만, 겹쳐도 안전해야 한다).
    timer.start();
    // 첫 사이클 기준 450ms(=재시작 후 250ms)에는 닫히지 않는다 — 사이클이 리셋됐다.
    timer.settle();
    vi.advanceTimersByTime(250);
    expect(onStop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("밸브 리터럴·훅 배선은 소스 그대로다 (refresh-wiring-contract와 같은 사실의 좁은 재확인)", () => {
    const hookSource = readFileSync(join(process.cwd(), "src/query/use-pull-to-refresh.ts"), "utf8");
    expect(PULL_TO_REFRESH_TIMEOUT_MS).toBe(10_000);
    expect(hookSource).toContain("PULL_TO_REFRESH_TIMEOUT_MS = 10_000");
    expect(hookSource).toContain("setTimeout(stopSpinner, PULL_TO_REFRESH_TIMEOUT_MS)");
    expect(hookSource).toContain("const PULL_TO_REFRESH_MIN_VISIBLE_MS = 450;");
    // 훅이 팩토리를 통해서만 타이머를 걸고, 언마운트 cleanup에서 정리한다.
    expect(hookSource).toContain("spinnerTimerRef.current?.clear();");
    expect(hookSource).toContain("spinnerTimerRef.current?.settle();");
    // 시계 직접 읽기 0건(주입 규율) — 타이머만 쓴다.
    expect(hookSource).not.toContain("Date.now(");
  });
});
