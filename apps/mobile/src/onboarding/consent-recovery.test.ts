import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApiHttpError } from "../api/api-error";
import {
  isOnboardingConsentRequired,
  ONBOARDING_CONSENT_REQUIRED_MESSAGE,
  ONBOARDING_CONSENT_RETRY_ACTION_LABEL,
  saveWithConsentRecovery
} from "./consent-recovery";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 서버 봉투 그대로의 403 CONSENT_REQUIRED(apps/api/src/onboarding/onboarding-core.service.ts). */
const consentRequired = () =>
  new ApiHttpError(403, { error: { code: "CONSENT_REQUIRED", message: "필수 약관과 개인정보 동의가 필요해요." } });

/** 같은 403이지만 권한 부족 — 복구 경로가 다르다. */
const forbidden = () =>
  new ApiHttpError(403, { error: { code: "FORBIDDEN", message: "권한이 없어요." } });

/**
 * 라운드 65 후속(#1) — 동의 저장 실패가 만든 **복구 불가 온보딩 막다른 길**의 회귀 고정.
 *
 * 로그인은 성공했는데 동의 PUT만 실패한 계정은 ONB-002의 `POST /children`에서 403
 * CONSENT_REQUIRED로 막히고, 앱에는 동의를 다시 올릴 길이 하나도 없었다(ONB-006은
 * `consentsAccepted`를 먼저 보고, SET-003은 온보딩을 마쳐야 열리는 탭 안에 있다).
 */
describe("라운드 65 후속(#1) 동의 미저장 판정", () => {
  it("CONSENT_REQUIRED만 참이다 — 같은 403이라도 FORBIDDEN은 아니다", () => {
    expect(isOnboardingConsentRequired(consentRequired())).toBe(true);
    expect(isOnboardingConsentRequired(forbidden())).toBe(false);
    // 네트워크 실패(봉투 없음)·아무 값도 판정을 흔들지 않는다.
    expect(isOnboardingConsentRequired(new Error("Network request failed"))).toBe(false);
    expect(isOnboardingConsentRequired(null)).toBe(false);
    expect(isOnboardingConsentRequired(undefined)).toBe(false);
  });

  it("문구는 해요체이고, 재시도가 아니라 **재동의**를 안내한다", () => {
    expect(ONBOARDING_CONSENT_REQUIRED_MESSAGE).toContain("필수 동의");
    expect(ONBOARDING_CONSENT_REQUIRED_MESSAGE).toContain("다시 동의");
    // 네트워크 문구와 섞이지 않는다 — 연결은 멀쩡한 실패다.
    expect(ONBOARDING_CONSENT_REQUIRED_MESSAGE).not.toContain("네트워크");
    expect(ONBOARDING_CONSENT_REQUIRED_MESSAGE.trim().endsWith("요.")).toBe(true);
    // 버튼 라벨은 "재시도"가 아니라 무슨 일이 일어나는지를 말한다.
    expect(ONBOARDING_CONSENT_RETRY_ACTION_LABEL).toBe("다시 동의하고 저장");
    expect(ONBOARDING_CONSENT_RETRY_ACTION_LABEL).not.toBe("재시도");
  });
});

describe("라운드 65 후속(#1) saveWithConsentRecovery", () => {
  it("성공하는 저장에는 아무것도 하지 않는다 — 재동의 요청 0건", async () => {
    const save = vi.fn().mockResolvedValue({ id: "child-1" });
    const reconsent = vi.fn().mockResolvedValue({ success: true });

    await expect(saveWithConsentRecovery(save, reconsent)).resolves.toEqual({ id: "child-1" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(reconsent).not.toHaveBeenCalled();
  });

  it("CONSENT_REQUIRED가 아닌 실패는 손대지 않는다 (403 권한·네트워크 모두)", async () => {
    for (const error of [forbidden(), new Error("Network request failed")]) {
      const save = vi.fn().mockRejectedValue(error);
      const reconsent = vi.fn().mockResolvedValue({ success: true });

      await expect(saveWithConsentRecovery(save, reconsent)).rejects.toBe(error);
      expect(save).toHaveBeenCalledTimes(1);
      expect(reconsent).not.toHaveBeenCalled();
    }
  });

  it("CONSENT_REQUIRED면 동의를 다시 올린 뒤 같은 저장을 1회 재시도하고, 그 재시도가 성공한다", async () => {
    const order: string[] = [];
    const save = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push("save");
        throw consentRequired();
      })
      .mockImplementationOnce(async () => {
        order.push("save");
        return { id: "child-1" };
      });
    const reconsent = vi.fn().mockImplementation(async () => {
      order.push("reconsent");
      return { success: true };
    });

    await expect(saveWithConsentRecovery(save, reconsent)).resolves.toEqual({ id: "child-1" });
    // 순서가 계약이다 — 동의가 서버에 먼저 닿아야 두 번째 저장이 통과한다.
    expect(order).toEqual(["save", "reconsent", "save"]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(reconsent).toHaveBeenCalledTimes(1);
  });

  it("재동의 자체가 실패하면 **원래 CONSENT_REQUIRED**를 그대로 던진다 (문구가 네트워크로 바뀌지 않는다)", async () => {
    const original = consentRequired();
    const save = vi.fn().mockRejectedValue(original);
    const reconsent = vi.fn().mockRejectedValue(new Error("Network request failed"));

    await expect(saveWithConsentRecovery(save, reconsent)).rejects.toBe(original);
    // 재동의가 실패했으므로 저장을 다시 보내지 않는다(의미 없는 요청을 늘리지 않는다).
    expect(save).toHaveBeenCalledTimes(1);
    // 그리고 화면이 그 오류로 고르는 문구는 여전히 재동의를 안내하는 쪽이다.
    expect(isOnboardingConsentRequired(original)).toBe(true);
  });

  it("자동 복구는 정확히 1회다 — 재시도가 또 CONSENT_REQUIRED여도 다시 돌지 않는다", async () => {
    const second = consentRequired();
    const save = vi.fn().mockRejectedValueOnce(consentRequired()).mockRejectedValueOnce(second);
    const reconsent = vi.fn().mockResolvedValue({ success: true });

    await expect(saveWithConsentRecovery(save, reconsent)).rejects.toBe(second);
    expect(save).toHaveBeenCalledTimes(2);
    expect(reconsent).toHaveBeenCalledTimes(1);
  });
});

/**
 * 화면 배선은 소스 계약으로 본다(.tsx는 react-native를 끌고 와 vitest에서 실행되지 않는다 --
 * onboarding-step-progress.test.ts와 같은 관례).
 */
describe("라운드 65 후속(#1) 화면 배선", () => {
  it("ONB-002 저장이 이 복구를 탄다 — 재동의는 같은 upsertConsents 한 곳에서 온다", () => {
    const screen = source("app/(onboarding)/child-profile.tsx");
    expect(screen).toContain('import { saveWithConsentRecovery } from "../../src/onboarding/consent-recovery";');
    expect(screen).toContain("mutationFn: () => saveWithConsentRecovery(submitChild, () => upsertConsents(authToken!))");
    // 재시도가 같은 Idempotency-Key를 재사용한다는 MOB-101 계약이 복구 경로의 전제다.
    expect(screen).toContain("getOrCreateChildCreateIdempotencyKey()");
  });

  it("실패 카드에 [다시 동의하고 저장]이 배선돼 있다", () => {
    const screen = source("app/(onboarding)/child-profile.tsx");
    expect(screen).toContain("onReconsent={() => save.mutate()}");
    const stepUi = source("src/onboarding/step-ui.tsx");
    expect(stepUi).toContain("const consentRequired = isOnboardingConsentRequired(error);");
    expect(stepUi).toContain("label={ONBOARDING_CONSENT_RETRY_ACTION_LABEL}");
    // 문구·판정은 이 모듈에서 온다 -- 화면 파일에 문구를 다시 적지 않는다.
    expect(stepUi).toContain('} from "./consent-recovery";');
    expect(screen).not.toContain(ONBOARDING_CONSENT_REQUIRED_MESSAGE);
  });

  /**
   * 종전 주석이 근거로 들던 두 재제출 경로가 **실제로는 이 상황에 닿지 않는다**는 사실을 못
   * 박아 둔다. 그 전제가 되살아나면(예: resume 판정에서 consentsAccepted 조건이 사라지면)
   * 이 테스트가 먼저 빨개져서 복구 경로를 다시 셈하게 만든다.
   */
  it("ONB-006 이어하기는 동의 없는 계정을 받지 않는다 (그래서 복구를 ONB-002에 둔다)", () => {
    const resume = source("src/onboarding/resume.ts");
    expect(resume).toContain("if (!progress.summary.consentsAccepted) return false;");
    // 로그인 화면의 주석도 그 사실대로 정정돼 있다.
    const login = source("app/(auth)/login.tsx");
    expect(login).toContain("hasResumeWorthyProgress");
    expect(login).not.toContain("실패했을 때의 재제출 경로는 이미 있다");
  });
});
