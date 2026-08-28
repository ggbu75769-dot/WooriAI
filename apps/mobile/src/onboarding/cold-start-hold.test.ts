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

/**
 * 라운드 52 QA P3-4 — 판정표가 **두 벌**이던 자리.
 *
 * C-09는 판정을 이 모듈에 값으로 고정해 두었지만 화면은 그 함수를 부르지 않고 세 자리에 이유
 * 리터럴을 직접 적었다. 즉 모듈은 배선이 아니라 문서였고, 두 표가 갈려도 아무 테스트가 깨지지
 * 않았다. 아래 두 describe는 (1) 모듈이 화면의 분기 순서를 그대로 재현하는지, (2) 화면이 실제로
 * 그 함수를 부르는지를 각각 고정한다.
 */
describe("라운드 52 QA P3-4 분기 순서 재현", () => {
  /** app/index.tsx가 위에서부터 검사하는 순서 그대로: 픽셀락 → rehydrate → 로그아웃 → 복구 → 진행도. */
  const cases: Array<{ name: string; input: ColdStartHoldInput; expected: ColdStartHoldReason | null }> = [
    {
      name: "픽셀락은 무엇이 걸려 있든 맨 위에서 리다이렉트한다",
      input: { pixelLockMode: true, hydrated: false, loggedOut: true, childRecoveryPending: true, onboardingProgressPending: true },
      expected: null
    },
    {
      name: "rehydrate 대기는 로그아웃 여부보다 먼저다(아직 세션을 모른다)",
      input: { pixelLockMode: false, hydrated: false, loggedOut: true, childRecoveryPending: true, onboardingProgressPending: true },
      expected: "hydration"
    },
    {
      name: "로그아웃은 아래 두 대기보다 먼저 리다이렉트한다",
      input: { pixelLockMode: false, hydrated: true, loggedOut: true, childRecoveryPending: true, onboardingProgressPending: true },
      expected: null
    },
    {
      name: "아이 복구가 진행도 조회보다 먼저다",
      input: { pixelLockMode: false, hydrated: true, loggedOut: false, childRecoveryPending: true, onboardingProgressPending: true },
      expected: "child-recovery"
    },
    {
      name: "복구가 끝나면 진행도 조회 대기가 남는다",
      input: { pixelLockMode: false, hydrated: true, loggedOut: false, childRecoveryPending: false, onboardingProgressPending: true },
      expected: "onboarding-progress"
    },
    {
      name: "아무것도 기다리지 않으면 리다이렉트다",
      input: { pixelLockMode: false, hydrated: true, loggedOut: false, childRecoveryPending: false, onboardingProgressPending: false },
      expected: null
    }
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(coldStartHoldReason(input)).toBe(expected);
    });
  }
});

describe("라운드 52 C-09 배선 (source verification -- 화면은 vitest에서 렌더하지 않는 관례)", () => {
  const indexSource = () => source("app/index.tsx");

  it("세 개의 `return null` 자리가 모두 공통 홀딩 뷰가 됐다", () => {
    const screenSource = indexSource();
    // QA P3-4: 이유는 이제 리터럴이 아니라 판정 함수의 결과다(아래 배선 테스트 참고).
    expect(screenSource.match(/<ColdStartHoldView reason=\{holdReason\} \/>/g) ?? []).toHaveLength(3);
    expect(screenSource).not.toContain('<ColdStartHoldView reason="');
    // 스플래시 종료 후의 백지가 다시 들어오지 않는다.
    expect(screenSource).not.toContain("return null;");
  });

  it("QA P3-4: 화면이 판정 함수를 실제로 부르고, 세 자리가 그 결과를 쓴다", () => {
    const screenSource = indexSource();
    expect(screenSource).toContain(
      'import { COLD_START_HOLD_COPY, coldStartHoldReason, type ColdStartHoldReason } from "../src/onboarding/cold-start-hold";'
    );
    expect(screenSource).toContain("const holdReason = coldStartHoldReason({");
    // 인자는 화면이 이미 들고 있는 값 그대로다(새 판정을 여기서 만들지 않는다).
    expect(screenSource).toContain("pixelLockMode,");
    expect(screenSource).toContain("hydrated,");
    expect(screenSource).toContain("loggedOut: !accessToken && !isTestSession,");
    expect(screenSource).toContain('childRecoveryPending: childRecoveryNeeded && childRecovery.status !== "error",');
    expect(screenSource).toContain(
      'onboardingProgressPending: !hasReachedHome && Boolean(progressToken) && progressFetch !== "done"'
    );
    // 세 자리 모두 그 결과로 분기한다.
    expect(screenSource).toContain('if (holdReason === "hydration") {');
    expect(screenSource).toContain('if (holdReason === "child-recovery") {');
    expect(screenSource).toContain('if (holdReason === "onboarding-progress") {');
  });

  it("문구는 공용 모듈에서 오고, 화면은 D6 스켈레톤을 재사용한다", () => {
    const screenSource = indexSource();
    expect(screenSource).toContain("COLD_START_HOLD_COPY");
    expect(screenSource).toContain('from "../src/onboarding/cold-start-hold";');
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
    // 조건식은 그대로 남아 판정 함수의 인자가 됐다(위 테스트가 인자를 고정한다).
    expect(screenSource).toContain("const childRecoveryNeeded = shouldAttemptSelectedChildRecovery(childRecoveryInput);");
    expect(screenSource).toContain("if (!hasReachedHome) {");
    expect(screenSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    // 복구 에러는 여전히 홀딩이 아니라 재시도 카드다(그 분기가 홀딩보다 먼저 온다).
    const errorIndex = screenSource.indexOf('testID="screen-child-recovery-error"');
    const childHoldIndex = screenSource.indexOf('if (holdReason === "child-recovery") {');
    expect(errorIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeLessThan(childHoldIndex);
    // 순서: rehydrate → 로그아웃 → 아이 복구 → 진행도 조회.
    expect(screenSource.indexOf('if (holdReason === "hydration") {')).toBeLessThan(
      screenSource.indexOf("if (!accessToken && !isTestSession) {")
    );
    expect(screenSource.indexOf("if (!accessToken && !isTestSession) {")).toBeLessThan(childHoldIndex);
    expect(childHoldIndex).toBeLessThan(screenSource.indexOf('if (holdReason === "onboarding-progress") {'));
  });
});
