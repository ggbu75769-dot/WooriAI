import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLD_START_HOLD_COPY,
  COLD_START_HOLD_TITLE,
  coldStartHoldReason,
  type ColdStartHoldInput,
  type ColdStartHoldReason
} from "./cold-start-hold";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/** 콜드 스타트의 시작점: 아직 아무 저장소도 올라오지 않았고 세션 여부도 모른다. */
const coldStart: ColdStartHoldInput = {
  pixelLockMode: false,
  hydrated: false,
  loggedOut: false,
  childRecoveryPending: false,
  onboardingProgressPending: false
};

/**
 * 라운드 52 C-09 — 콜드 스타트 백지.
 *
 * app/index.tsx는 리다이렉트가 정해질 때까지 `return null`이었다 = 스플래시가 내려간 뒤의 흰
 * 화면(두 개의 3초 안전 밸브가 겹치면 6초 가까이). 라우팅 판정은 그대로 두고, "그 순간 무엇을
 * 그리는가"만 값으로 고정한다.
 */
describe("라운드 52 C-09 콜드 스타트 홀딩 판정", () => {
  it("rehydrate 대기 -> hydration", () => {
    expect(coldStartHoldReason(coldStart)).toBe("hydration");
  });

  it("아이 복구 진행 중 -> child-recovery (에러는 재시도 카드라 홀딩이 아니다)", () => {
    expect(coldStartHoldReason({ ...coldStart, hydrated: true, childRecoveryPending: true })).toBe(
      "child-recovery"
    );
    // 에러 상태는 호출부가 childRecoveryPending=false로 넘긴다 -- 그때는 재시도 버튼이 있는
    // 카드를 그린다(빈 화면도, 홀딩도 아니다).
    expect(coldStartHoldReason({ ...coldStart, hydrated: true })).toBeNull();
  });

  it("서버 진행도 조회 대기 -> onboarding-progress ('idle'도 대기다 -- FIX-118A)", () => {
    expect(
      coldStartHoldReason({ ...coldStart, hydrated: true, onboardingProgressPending: true })
    ).toBe("onboarding-progress");
  });

  it("로그아웃 상태는 홀딩하지 않는다(스플래시/로그인으로 곧장 리다이렉트한다)", () => {
    expect(
      coldStartHoldReason({
        ...coldStart,
        hydrated: true,
        loggedOut: true,
        childRecoveryPending: true,
        onboardingProgressPending: true
      })
    ).toBeNull();
  });

  it("픽셀락 캡처 경로는 이 뷰를 지나지 않는다(맨 위 분기)", () => {
    expect(coldStartHoldReason({ ...coldStart, pixelLockMode: true })).toBeNull();
    expect(
      coldStartHoldReason({ ...coldStart, pixelLockMode: true, hydrated: true, childRecoveryPending: true })
    ).toBeNull();
  });

  it("판정이 정해진 렌더에서는 null이다(리다이렉트가 나간다)", () => {
    expect(coldStartHoldReason({ ...coldStart, hydrated: true })).toBeNull();
  });
});

describe("라운드 52 C-09 홀딩 문구", () => {
  const reasons: ColdStartHoldReason[] = ["hydration", "child-recovery", "onboarding-progress"];

  it("세 이유가 모두 문구를 갖고, 제목은 하나로 통일돼 있다", () => {
    for (const reason of reasons) {
      const copy = COLD_START_HOLD_COPY[reason];
      expect(copy.title, reason).toBe(COLD_START_HOLD_TITLE);
      expect(copy.body.length, reason).toBeGreaterThan(0);
      // DNC-018 해요체.
      expect(copy.body.endsWith("요."), reason).toBe(true);
    }
    // 이유마다 "지금 무엇을 하고 있는지"가 다르다(세 자리가 같은 문장을 돌려쓰지 않는다).
    expect(new Set(reasons.map((reason) => COLD_START_HOLD_COPY[reason].body)).size).toBe(reasons.length);
  });

  it("모르는 사실을 말하지 않는다 -- 아이 이름·금액·예산 같은 자리 채움이 없다", () => {
    const moduleSource = source("src/onboarding/cold-start-hold.ts");
    for (const forbidden of ["원", "예산", "태명", "%"]) {
      for (const reason of reasons) {
        expect(COLD_START_HOLD_COPY[reason].body, `${reason}: ${forbidden}`).not.toContain(forbidden);
      }
    }
    // 문구에 값을 끼워 넣는 템플릿 자체가 없다.
    expect(moduleSource).not.toContain("${");
  });
});

describe("라운드 52 C-09 배선 (source verification -- 화면은 vitest에서 렌더하지 않는 관례)", () => {
  const indexSource = () => source("app/index.tsx");

  it("세 개의 `return null` 자리가 모두 공통 홀딩 뷰가 됐다", () => {
    const screenSource = indexSource();
    expect(screenSource).toContain('<ColdStartHoldView reason="hydration" />');
    expect(screenSource).toContain('<ColdStartHoldView reason="child-recovery" />');
    expect(screenSource).toContain('<ColdStartHoldView reason="onboarding-progress" />');
    // 스플래시 종료 후의 백지가 다시 들어오지 않는다.
    expect(screenSource).not.toContain("return null;");
  });

  it("문구는 공용 모듈에서 오고, 화면은 D6 스켈레톤을 재사용한다", () => {
    const screenSource = indexSource();
    expect(screenSource).toContain(
      'import { COLD_START_HOLD_COPY, type ColdStartHoldReason } from "../src/onboarding/cold-start-hold";'
    );
    expect(screenSource).toContain('import { SkeletonCard } from "../src/ui/Skeleton";');
    expect(screenSource).toContain("<SkeletonCard />");
    // 스켈레톤은 자체 "불러오는 중" 라벨을 갖고 있어 문구와 겹친다 -- 기록 탭과 같은 관례로
    // 접근성 트리에서 감춘다.
    expect(screenSource).toContain('importantForAccessibility="no-hide-descendants"');
  });

  it("픽셀락 분기가 여전히 맨 위라 캡처 경로의 렌더가 한 노드도 바뀌지 않는다", () => {
    const screenSource = indexSource();
    const pixelLockIndex = screenSource.indexOf('process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
    expect(pixelLockIndex).toBeGreaterThan(-1);
    expect(pixelLockIndex).toBeLessThan(screenSource.indexOf("<ColdStartHoldView"));
  });

  it("라우팅 판정 자체는 그대로다(대기 조건·리다이렉트 목적지 무변경)", () => {
    const screenSource = indexSource();
    expect(screenSource).toContain("if (!hydrated) {");
    expect(screenSource).toContain("if (shouldAttemptSelectedChildRecovery(childRecoveryInput))");
    expect(screenSource).toContain('if (progressToken && progressFetch !== "done")');
    expect(screenSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
  });
});
