import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ONB-105 onboarding step progress indicator + save-failure retry contract.
// Like src/onboarding-flow.test.ts and src/child-profile-manual-stage-and-date-guard.test.ts,
// these are raw-source contract checks: the screens (and the shared step-ui component) import
// "react-native" transitively, whose untranspiled Flow syntax Vitest cannot parse.
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const stepScreens: Array<[string, string]> = [
  ["app/(onboarding)/child-status.tsx", "ONB-001"],
  ["app/(onboarding)/child-profile.tsx", "ONB-002"],
  ["app/(onboarding)/prepared-items.tsx", "ONB-003"],
  ["app/(onboarding)/budget.tsx", "ONB-004"]
];

const savingStepScreens = [
  "app/(onboarding)/child-profile.tsx",
  "app/(onboarding)/prepared-items.tsx",
  "app/(onboarding)/budget.tsx"
];

describe("ONB-105 step progress indicator", () => {
  it("ships one shared indicator component derived from the pinned onboardingSteps list", () => {
    const stepUiPath = "src/onboarding/step-ui.tsx";
    expect(existsSync(join(mobileRoot, stepUiPath)), `${stepUiPath} should exist`).toBe(true);

    const stepUiSource = source(stepUiPath);
    expect(stepUiSource).toContain("export function OnboardingStepProgress");
    // Step number and total must come from src/onboarding/steps.ts, not hardcoded per screen.
    expect(stepUiSource).toContain('from "./steps"');
    expect(stepUiSource).toContain("onboardingSteps.findIndex");
    expect(stepUiSource).toContain("onboardingSteps.length");
    // A11y: announced as "온보딩 4단계 중 N단계" with a progressbar role.
    expect(stepUiSource).toContain("accessibilityLabel={`온보딩 ${totalSteps}단계 중 ${stepNumber}단계`}");
    expect(stepUiSource).toContain('accessibilityRole="progressbar"');
    // Visual: dot bar + "N/4" text, colored with theme tokens (no raw hex literals).
    expect(stepUiSource).toContain("{stepNumber}/{totalSteps}");
    expect(stepUiSource).toContain("theme.colors.mainCoral");
    expect(stepUiSource).toContain("theme.colors.gray300");
    expect(stepUiSource).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  });

  it("renders the indicator with the right screenId on all four onboarding steps", () => {
    for (const [relativePath, screenId] of stepScreens) {
      const screenSource = source(relativePath);
      expect(screenSource, `${relativePath} should import the shared step-ui`).toContain(
        "../../src/onboarding/step-ui"
      );
      expect(screenSource, `${relativePath} should render its step indicator`).toContain(
        `<OnboardingStepProgress screenId="${screenId}" />`
      );
    }
  });

  it("(steps contract) the indicator's source list still has exactly the four ONB step screens", async () => {
    const { onboardingSteps } = await import("./onboarding/steps");
    expect(onboardingSteps.map((step) => step.screenId)).toEqual(["ONB-001", "ONB-002", "ONB-003", "ONB-004"]);
  });
});

describe("ONB-105 save-failure recovery", () => {
  it("ships a shared inline error card with an explicit 재시도 button", () => {
    const stepUiSource = source("src/onboarding/step-ui.tsx");
    expect(stepUiSource).toContain("export function OnboardingSaveErrorCard");
    expect(stepUiSource).toContain('accessibilityRole="alert"');
    expect(stepUiSource).toContain('label="재시도"');
    expect(stepUiSource).toContain("저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    expect(stepUiSource).toContain("onRetry");
  });

  it("wires the error card to retry the save mutation on every server-saving step", () => {
    for (const relativePath of savingStepScreens) {
      const screenSource = source(relativePath);
      // 라운드 60 #3: 카드가 실패 종류를 알아야(error) 403을 네트워크 문구와 갈라낼 수 있다.
      // 라운드 65 후속(#1): ONB-002만 [다시 동의하고 저장]을 하나 더 받으므로(onReconsent)
      // 한 줄 리터럴 대신 카드·error·onRetry 세 조각으로 본다 -- 셋은 세 화면 모두 같다.
      expect(screenSource, `${relativePath} should show the retry card on save failure`).toContain(
        "save.isError ? "
      );
      expect(screenSource, `${relativePath} should pass the failure to the card`).toContain(
        "<OnboardingSaveErrorCard"
      );
      expect(screenSource, `${relativePath} should let the card branch on the error kind`).toContain(
        "error={save.error}"
      );
      expect(screenSource, `${relativePath} should retry the same mutation`).toContain(
        "onRetry={() => save.mutate()}"
      );
      // The passive error toast is replaced by the actionable card -- it must not linger.
      expect(screenSource, `${relativePath} should not keep the passive error Toast`).not.toContain("<Toast");
    }
  });

  it("un-sticks ONB-001 when the user navigates back after choosing a stage", () => {
    const childStatusSource = source("app/(onboarding)/child-status.tsx");
    expect(childStatusSource).toContain("useFocusEffect");
    expect(childStatusSource).toContain("setIsNavigating(false)");
  });

  /**
   * 라운드 60 #3: 온보딩 저장 실패는 지금까지 종류를 가리지 않고 "네트워크 연결을 확인한 뒤
   * 다시 시도해 주세요"였다. 보기 전용으로 초대를 수락한 사람이 온보딩에 들어오면 ONB-002의
   * `POST /children`이 403으로 막히는데(서버 @RequireHouseholdRoles("owner","co_parent")),
   * 그 벽 앞에서 연결을 확인하라 하고 재시도를 권한 셈이다 -- 무한 재시도의 입구였다.
   */
  describe("라운드 60 #3: 403(권한) 실패를 네트워크 문구와 분리한다", () => {
    const stepUiSource = source("src/onboarding/step-ui.tsx");

    it("권한 실패 전용 문구가 따로 있고, 네트워크 문구와 같지 않다", () => {
      expect(stepUiSource).toContain("export const ONBOARDING_SAVE_FORBIDDEN_MESSAGE");
      expect(stepUiSource).toContain("권한이 없어 저장하지 못했어요. 가족 관리자에게 아이 등록을 부탁해 주세요.");
      expect(stepUiSource).toContain("저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    });

    it("권한 문구는 재시도를 권하지 않는다 (INVITE_FORBIDDEN_MESSAGE 선례, 해요체)", () => {
      const forbidden = stepUiSource.split("ONBOARDING_SAVE_FORBIDDEN_MESSAGE =")[1]?.split(";")[0] ?? "";
      expect(forbidden).not.toContain("다시 시도");
      expect(forbidden).not.toContain("네트워크");
      expect(forbidden).toContain("관리자");
      // 같은 규율의 선례가 실제로 살아 있는지도 함께 본다 -- 두 문구가 같은 규칙을 따른다.
      const inviteSource = source("src/family/invite-permissions.ts");
      expect(inviteSource).toContain("export const INVITE_FORBIDDEN_MESSAGE");
      expect(inviteSource.split("INVITE_FORBIDDEN_MESSAGE =")[1]?.split(";")[0]).not.toContain("다시 시도");
    });

    it("판정은 서버 봉투의 코드 하나로 한다 (message 문자열 부분 검색 금지)", () => {
      expect(stepUiSource).toContain('import { hasApiErrorCode } from "../api/api-error";');
      expect(stepUiSource).toContain('hasApiErrorCode(error, "FORBIDDEN")');
    });

    it("403이면 [재시도] 버튼 자체를 내린다 (다시 눌러도 결과가 같은 자리)", () => {
      expect(stepUiSource).toContain("const forbidden = isOnboardingSaveForbidden(error);");
      // 라운드 65 후속(#1): 같은 자리에 CONSENT_REQUIRED 갈래가 하나 더 생겼다 -- 권한 실패는
      // 종전 그대로 버튼이 없고(`forbidden ? null`), 그 뒤 기본 갈래만 [재시도]다.
      expect(stepUiSource).toContain(") : forbidden ? null : (");
      expect(stepUiSource).toContain('<SecondaryButton accessibilityLabel="저장 재시도" label="재시도" onPress={onRetry} />');
    });
  });

  it("keeps the MOB-101 child-create idempotency wiring intact across the retry path", () => {
    const childProfileSource = source("app/(onboarding)/child-profile.tsx");
    // A retried createChild must reuse the same Idempotency-Key (cleared only on success), so
    // tapping 재시도 can never create a duplicate child.
    expect(childProfileSource).toContain("getOrCreateChildCreateIdempotencyKey()");
    expect(childProfileSource).toContain("clearChildCreateIdempotencyKey()");
  });
});

/**
 * 라운드 60 #9: 온보딩 단계 이탈 계측.
 *
 * 이벤트 9종에 온보딩 관련은 `onboarding_completed` 하나뿐이라, 어드민 퍼널의 1단이 이미
 * "완료"였다 -- 그 앞의 이탈은 어떤 데이터로도 답할 수 없었다. 발화 배선은 화면/RN 컴포넌트에
 * 있어(vitest에서 import 불가) 여기서 소스 대조로 고정한다.
 */
describe("라운드 60 #9 온보딩 단계 진입 계측", () => {
  const stepUiSource = source("src/onboarding/step-ui.tsx");
  const contractsSource = readFileSync(join(mobileRoot, "../../packages/contracts/src/analytics.ts"), "utf8");

  function contractLiterals(exportName: string): string[] {
    const block = contractsSource.split(`export const ${exportName} = [`)[1]?.split("] as const;")[0] ?? "";
    return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  }

  it("계약 레지스트리에 append-only로 등록돼 있다 (죽은 계측 금지 — 수집 엔드포인트가 레지스트리로 검증한다)", () => {
    expect(contractsSource).toContain('eventName: "onboarding_step_viewed", eventVersion: 1');
    // 맨 뒤에 붙는다: 이 배열의 순서가 어드민 요약의 byName 순서 계약이다.
    const registryBlock = contractsSource.split("export const analyticsEventRegistry")[1]?.split("];")[0] ?? "";
    const names = [...registryBlock.matchAll(/eventName: "([a-z_]+)"/g)].map((match) => match[1]);
    expect(names[names.length - 1]).toBe("onboarding_step_viewed");
    expect(names.slice(0, 6)).toEqual([
      "app_opened",
      "onboarding_completed",
      "expense_recorded",
      "expense_synced",
      "item_status_changed",
      "affiliate_link_clicked"
    ]);
    // 모바일 유니온에도 같은 이름이 있어야 발사가 타입을 통과한다.
    expect(source("src/analytics/client.ts")).toContain('| "onboarding_step_viewed"');
  });

  it("페이로드는 단계 enum + 정수뿐이다 (PII-lint 규칙: 자유 문자열·금액 금지)", () => {
    const payloadBlock = contractsSource.split("const onboardingStepViewedV1Payload")[1]?.split(".strict();")[0] ?? "";
    expect(payloadBlock).toContain("step: onboardingStepSchema");
    expect(payloadBlock).toContain("stepNumber: z.number().int()");
    // 아이 애칭·예정일·예산은 이 네 화면에 모두 있지만 하나도 실리지 않는다.
    for (const forbidden of ["nickname", "birthDate", "dueDate", "amountKrw", "childName", "z.string()"]) {
      expect(payloadBlock).not.toContain(forbidden);
    }
  });

  it("단계 리터럴이 앱의 고정 단계 순서(ONB-001..004)와 1:1로 맞는다", () => {
    expect(contractLiterals("ONBOARDING_STEPS")).toEqual([
      "child_status",
      "child_profile",
      "prepared_items",
      "budget"
    ]);
    const mirror = stepUiSource.split("ONBOARDING_STEP_ANALYTICS_IDS")[1]?.split("};")[0] ?? "";
    for (const [screenId, step] of [
      ["ONB-001", "child_status"],
      ["ONB-002", "child_profile"],
      ["ONB-003", "prepared_items"],
      ["ONB-004", "budget"]
    ]) {
      expect(mirror).toContain(`"${screenId}": "${step}"`);
    }
    // stepNumber는 진행 표시와 같은 단일 소스(steps.ts)에서 센다 -- "2/4"와 계측이 갈리지 않는다.
    expect(stepUiSource).toContain("onboardingSteps.findIndex((step) => step.screenId === screenId)");
  });

  it("발화 관례를 재사용한다: 동의 게이트를 먼저 보고, 실행당 1회만 센다", () => {
    expect(stepUiSource).toContain('eventName: "onboarding_step_viewed"');
    expect(stepUiSource).toContain('import { trackAndFlushAnalyticsEvent } from "../analytics/client";');
    // ANA-102 동의 게이트를 **먼저** 본 뒤 발사한 경우에만 억제 Set에 넣는다(라운드 27 L-3).
    expect(stepUiSource).toContain("if (!analyticsConsent) return;");
    const consentIndex = stepUiSource.indexOf("if (!analyticsConsent) return;");
    const addIndex = stepUiSource.indexOf("trackedOnboardingStepsThisLaunch.add(screenId);");
    expect(consentIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeGreaterThan(consentIndex);
    // app_opened / item_detail_viewed와 같은 모듈 레벨 Set 관례.
    expect(stepUiSource).toContain("const trackedOnboardingStepsThisLaunch = new Set<OnboardingScreenId>();");
    expect(stepUiSource).toContain("if (trackedOnboardingStepsThisLaunch.has(screenId)) return;");
  });

  it("네 온보딩 화면이 모두 자기 단계로 발화한다 (한 단계라도 빠지면 이탈이 안 보인다)", () => {
    for (const [relativePath, screenId] of stepScreens) {
      const screenSource = source(relativePath);
      expect(screenSource, `${relativePath} should fire its step event`).toContain(
        `useOnboardingStepAnalytics("${screenId}")`
      );
    }
  });
});
