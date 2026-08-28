import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OnboardingProgress } from "../api/client";
import {
  fetchOnboardingProgressForSelectedChild,
  isChildScopeRejection,
  type OnboardingProgressFetch
} from "./onboarding-progress-scope";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * FIX-119B/F5 (R19 L-1) — 삭제된/비-UUID selectedChildId로 인한 온보딩 오리다이렉트.
 *
 * 재현 조건: 온보딩을 이미 끝낸 실사용자 세션인데 persisted selectedChildId가 서버에서 무효다
 * (다른 기기에서 아이 삭제 / 가구 이동 / 예전 버전이 남긴 비-UUID). app/index.tsx의 아이 스코프
 * 진행도 조회가 404·403·400으로 실패하고, 예전 구현은 그 실패를 catch가 통째로 삼켜 "진행도 없음"
 * 으로 처리 -> ONB-001로 되돌아갔다(그리고 무효 childId가 남아 매 실행마다 반복).
 */

function progress(overrides: Partial<OnboardingProgress> = {}): OnboardingProgress {
  return {
    completed: true,
    nextStep: "home",
    canRestart: true,
    summary: {
      consentsAccepted: true,
      child: null,
      preparedItemsCount: 3,
      budget: { yearMonth: "2026-08", amountKrw: 300_000 }
    },
    ...overrides
  };
}

/** client.ts의 requestJson이 비-2xx에서 던지는 정확한 모양: JSON.stringify된 서버 오류 봉투. */
function apiError(code: string, message = "..."): Error {
  return new Error(JSON.stringify({ error: { code, message, requestId: "req-1" } }));
}

/** 호출 인자를 기록하는 가짜 GET /onboarding/status. */
function recordingFetch(behavior: (childId: string | undefined, callIndex: number) => Promise<OnboardingProgress>) {
  const calls: Array<string | undefined> = [];
  const fetchProgress: OnboardingProgressFetch = (_token, childId) => {
    calls.push(childId);
    return behavior(childId, calls.length - 1);
  };
  return { fetchProgress, calls };
}

describe("FIX-119B/F5 isChildScopeRejection", () => {
  it("아이 스코프 실패(404/403/400)만 골라낸다", () => {
    expect(isChildScopeRejection(apiError("CHILD_NOT_FOUND"))).toBe(true);
    expect(isChildScopeRejection(apiError("NOT_FOUND"))).toBe(true);
    expect(isChildScopeRejection(apiError("FORBIDDEN"))).toBe(true);
    expect(isChildScopeRejection(apiError("VALIDATION_ERROR"))).toBe(true);
  });

  it("그 밖의 실패(네트워크·타임아웃·401·5xx)는 폴백 대상이 아니다 -- 오프라인 관용 동작 불변", () => {
    expect(isChildScopeRejection(new Error("Network request failed"))).toBe(false);
    expect(isChildScopeRejection(new Error("요청 시간이 초과되었어요(10초)"))).toBe(false);
    expect(isChildScopeRejection(apiError("UNAUTHORIZED"))).toBe(false);
    expect(isChildScopeRejection(apiError("INTERNAL_SERVER_ERROR"))).toBe(false);
    expect(isChildScopeRejection(null)).toBe(false);
    expect(isChildScopeRejection(new Error("{}"))).toBe(false);
    expect(isChildScopeRejection(new Error('{"error":{"code":123}}'))).toBe(false);
  });
});

describe("FIX-119B/F5 fetchOnboardingProgressForSelectedChild", () => {
  it("정상 경로: 고른 아이가 있으면 그 아이 스코프로 한 번만 물어본다 (R19-C(F1) 계약 불변)", async () => {
    const { fetchProgress, calls } = recordingFetch(async () => progress());
    const result = await fetchOnboardingProgressForSelectedChild("token", "child-1", fetchProgress);

    expect(calls).toEqual(["child-1"]);
    expect(result.childScopeRejected).toBe(false);
    expect(result.progress.completed).toBe(true);
  });

  it("고른 아이가 없으면 예전처럼 파라미터 없이(=첫째 기준) 한 번만 물어본다", async () => {
    const { fetchProgress, calls } = recordingFetch(async () => progress());
    const result = await fetchOnboardingProgressForSelectedChild("token", null, fetchProgress);

    expect(calls).toEqual([undefined]);
    expect(result.childScopeRejected).toBe(false);
  });

  for (const code of ["CHILD_NOT_FOUND", "FORBIDDEN", "VALIDATION_ERROR"]) {
    it(`무효 childId(${code}) -> childId 없이 정확히 1회 재시도하고 무효 사실을 알린다`, async () => {
      const { fetchProgress, calls } = recordingFetch(async (childId) => {
        if (childId) throw apiError(code);
        return progress();
      });

      const result = await fetchOnboardingProgressForSelectedChild("token", "child-gone", fetchProgress);

      expect(calls).toEqual(["child-gone", undefined]);
      expect(result.childScopeRejected).toBe(true);
      // 핵심: 진행도를 실제로 받아왔으므로 호출자는 온보딩 완료를 알아채고 /(tabs)로 간다.
      expect(result.progress.completed).toBe(true);
    });
  }

  it("네트워크 오류는 삼키지도 재시도하지도 않는다 -- 그대로 던져 기존 오프라인 폴백에 맡긴다", async () => {
    const networkError = new Error("Network request failed");
    const { fetchProgress, calls } = recordingFetch(async () => {
      throw networkError;
    });

    await expect(fetchOnboardingProgressForSelectedChild("token", "child-1", fetchProgress)).rejects.toBe(
      networkError
    );
    expect(calls).toEqual(["child-1"]);
  });

  it("폴백 호출까지 실패하면 그 오류가 그대로 올라간다 (재시도는 1회뿐, 루프 없음)", async () => {
    const offline = new Error("Network request failed");
    const { fetchProgress, calls } = recordingFetch(async (childId) => {
      if (childId) throw apiError("CHILD_NOT_FOUND");
      throw offline;
    });

    await expect(fetchOnboardingProgressForSelectedChild("token", "child-gone", fetchProgress)).rejects.toBe(offline);
    expect(calls).toEqual(["child-gone", undefined]);
  });
});

describe("FIX-119B/F5 app/index.tsx 배선 (source verification -- ui-wiring.test.ts 관례)", () => {
  const indexSource = () => source("app/index.tsx");

  it("진행도 조회를 폴백 래퍼로 태우고, 무효로 판명된 selectedChildId를 지운다", () => {
    const indexSourceText = indexSource();
    expect(indexSourceText).toContain(
      'import { fetchOnboardingProgressForSelectedChild } from "../src/onboarding/onboarding-progress-scope";'
    );
    // 라운드 51 #2: 인자가 `accessToken`에서 `progressToken`으로 바뀌었다 -- 데모 세션은
    // 실토큰이 없어 LOCAL_SESSION_TOKEN을 넘긴다(app/index.tsx의 progressToken 주석 참고).
    // 래퍼를 타는 것과 무효 childId를 지우는 계약 자체는 그대로다.
    expect(indexSourceText).toContain("fetchOnboardingProgressForSelectedChild(progressToken, selectedChildId)");
    expect(indexSourceText).toContain("if (childScopeRejected) {");
    expect(indexSourceText).toContain("clearSelectedChildId();");
    // 예전의 직접 호출은 남아 있지 않다(그 경로가 실패를 catch로 흘려보내던 자리다).
    expect(indexSourceText).not.toContain("getOnboardingProgress(accessToken, selectedChildId ?? undefined)");
  });

  it("clear 이후는 MOB-116 복구가 이어받는다 -- 그 배선이 그대로 남아 있어야 한다", () => {
    const indexSourceText = indexSource();
    expect(indexSourceText).toContain("const clearSelectedChildId = useSelectedChildStore((state) => state.clearSelectedChildId);");
    expect(indexSourceText).toContain("if (shouldAttemptSelectedChildRecovery(childRecoveryInput))");
  });
});
