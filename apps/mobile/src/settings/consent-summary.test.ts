import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildConsentSummaryLines, consentStatusText } from "./consent-summary";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 45 UX-AA(후보 3): 약관 및 개인정보 화면은 부제에 "동의 내역과 삭제 · 탈퇴를 관리해요"라고
 * 적어 두고 동의 내역을 한 줄도 보여주지 않았다. 서버 GET /settings/privacy는 진작부터 consents를
 * 함께 내려주고 있었으므로(onboarding-core.service.ts) 새 요청 없이 그 값을 그린다.
 */
describe("consentStatusText (동의 내역 한 줄)", () => {
  it("동의한 항목은 동의일을 기록 행과 같은 형식으로 말한다", () => {
    expect(consentStatusText({ title: "서비스 이용약관", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" })).toBe(
      "7월 6일 동의"
    );
  });

  it("동의하지 않은 항목은 동의일을 지어내지 않는다", () => {
    expect(consentStatusText({ title: "소식 알림 동의", accepted: false, acceptedAt: null })).toBe("동의 안 함");
    // 서버가 accepted=false에도 시각을 실어 보내는 (있어서는 안 될) 경우까지 "동의"로 말하지 않는다.
    expect(consentStatusText({ title: "소식 알림 동의", accepted: false, acceptedAt: "2026-07-06T05:00:00.000Z" })).toBe(
      "동의 안 함"
    );
  });

  it("시각이 없거나 날짜로 읽히지 않으면 날짜 없이 동의 사실만 말한다", () => {
    for (const acceptedAt of [null, undefined, "", "언젠가", "2026-ab-cd"] as const) {
      expect(consentStatusText({ title: "개인정보 처리 동의", accepted: true, acceptedAt })).toBe("동의함");
    }
  });
});

describe("buildConsentSummaryLines", () => {
  it("서버가 준 순서 그대로 세 줄을 만든다", () => {
    const lines = buildConsentSummaryLines([
      { title: "서비스 이용약관", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" },
      { title: "개인정보 처리 동의", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" },
      { title: "소식 알림 동의", accepted: false, acceptedAt: null }
    ]);

    expect(lines).toEqual([
      { title: "서비스 이용약관", statusText: "7월 6일 동의" },
      { title: "개인정보 처리 동의", statusText: "7월 6일 동의" },
      { title: "소식 알림 동의", statusText: "동의 안 함" }
    ]);
  });

  it("응답에 consents가 없거나(구 서버·실패) 이름 없는 항목은 줄을 만들지 않는다 -- 화면은 카드를 생략한다", () => {
    for (const empty of [undefined, null, []] as const) {
      expect(buildConsentSummaryLines(empty)).toEqual([]);
    }
    expect(buildConsentSummaryLines([{ title: "   ", accepted: true, acceptedAt: null }])).toEqual([]);
  });
});

describe("SET-003 동의 내역 카드 wiring (source contract -- 화면은 vitest에서 렌더되지 않는다)", () => {
  const privacySource = source("app/settings/privacy.tsx");

  it("이미 받아 둔 privacy 응답의 consents만 쓰고, 없으면 카드를 그리지 않는다", () => {
    expect(privacySource).toContain("buildConsentSummaryLines(privacy.data?.consents)");
    expect(privacySource).toContain("consentLines.length > 0 ?");
    // 동의 내역을 위해 새 요청을 만들지 않는다(GET /settings/privacy 하나로 끝난다).
    expect(privacySource).not.toContain("listConsents");
  });

  it("계정 삭제 카드가 30일 재가입 제한을 사실대로 한 줄 덧붙인다", () => {
    expect(privacySource).toContain("삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.");
  });
});
