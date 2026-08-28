import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_SESSION_TOKEN, upsertConsents, setConsentAccepted, getPrivacySettings } from "../api/client";
import * as localBackend from "../api/local-backend";
import {
  consentAcceptance,
  hasPendingRequiredConsents,
  optionalConsents,
  pendingRequiredConsents,
  requiredConsentAcceptances
} from "./consent-definitions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const serverDefinitions = [
  { type: "terms", version: "2026-07-06", required: true, title: "서비스 이용약관", accepted: false, acceptedAt: null },
  {
    type: "privacy",
    version: "2026-07-06",
    required: true,
    title: "개인정보 처리 동의",
    accepted: false,
    acceptedAt: null
  },
  { type: "marketing", version: "2026-07-06", required: false, title: "소식 알림 동의", accepted: false, acceptedAt: null }
];

describe("동의 정의 판정 (라운드 65 B #4 -- 버전의 단일 소스는 서버다)", () => {
  it("필수 항목만, 서버가 준 버전 그대로 되돌려준다", () => {
    expect(requiredConsentAcceptances(serverDefinitions)).toEqual([
      { type: "terms", version: "2026-07-06", accepted: true },
      { type: "privacy", version: "2026-07-06", accepted: true }
    ]);
  });

  /**
   * 개정 시나리오: 서버가 새 버전을 요구하면 앱은 **그 버전**을 되돌려준다. 종전에는 앱에 박힌
   * 옛 버전 리터럴만 보냈기 때문에, 개정 순간 전 사용자가 미동의로 뒤집힌 채 되돌릴 길이 없었다.
   */
  it("약관이 개정되면 새 버전이 그대로 실려 나간다(앱 재배포 없이)", () => {
    const revised = serverDefinitions.map((definition) => ({ ...definition, version: "2027-01-01" }));
    expect(requiredConsentAcceptances(revised)).toEqual([
      { type: "terms", version: "2027-01-01", accepted: true },
      { type: "privacy", version: "2027-01-01", accepted: true }
    ]);
    expect(hasPendingRequiredConsents(revised)).toBe(true);
  });

  it("이미 동의된 필수 항목은 다시 보내지 않는다(동의한 날짜가 오늘로 밀리지 않게)", () => {
    const accepted = serverDefinitions.map((definition) =>
      definition.required ? { ...definition, accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" } : definition
    );
    expect(requiredConsentAcceptances(accepted)).toEqual([]);
    expect(hasPendingRequiredConsents(accepted)).toBe(false);
  });

  it("선택 항목은 required가 false라고 **명시된** 것만이다 -- 모르면 스위치를 만들지 않는다", () => {
    expect(optionalConsents(serverDefinitions).map((definition) => definition.type)).toEqual(["marketing"]);
    // 구 서버(required 없음)는 필수도 선택도 아니다: 화면이 종전 그대로다.
    const legacy = [{ type: "terms", version: "2026-07-06", title: "서비스 이용약관", accepted: true }];
    expect(optionalConsents(legacy)).toEqual([]);
    expect(pendingRequiredConsents(legacy)).toEqual([]);
  });

  it("type·version이 없는 항목은 되돌려 보낼 수 없으므로 후보에서 뺀다", () => {
    const broken = [
      { type: "", version: "2026-07-06", required: true, title: "이름 없는 동의", accepted: false },
      { type: "terms", version: "", required: true, title: "버전 없는 동의", accepted: false }
    ];
    expect(pendingRequiredConsents(broken)).toEqual([]);
    expect(requiredConsentAcceptances(broken)).toEqual([]);
  });

  it("한 항목의 동의/철회는 정의의 버전을 그대로 싣는다", () => {
    expect(consentAcceptance({ type: "marketing", version: "2026-07-06" }, true)).toEqual({
      type: "marketing",
      version: "2026-07-06",
      accepted: true
    });
    expect(consentAcceptance({ type: "marketing", version: "2026-07-06" }, false)).toEqual({
      type: "marketing",
      version: "2026-07-06",
      accepted: false
    });
  });

  it("빈 응답·null에도 아무것도 만들지 않는다", () => {
    for (const empty of [undefined, null, []] as const) {
      expect(requiredConsentAcceptances(empty)).toEqual([]);
      expect(optionalConsents(empty)).toEqual([]);
      expect(hasPendingRequiredConsents(empty)).toBe(false);
    }
  });
});

describe("버전 리터럴 단일 소스 (source contract)", () => {
  /**
   * 라운드 65 B(#4ⓐ): `{ type: "terms", version: "2026-07-06" }` 리터럴은 네 벌 있었다 --
   * client.ts의 PUT 본문 두 줄, local-backend.ts의 데모 upsert 두 줄, 그리고 데모 정의. 이제
   * 앱에 남은 동의 버전 문자열은 **데모 백엔드의 정의 한 벌**뿐이다(그것이 데모의 "서버"다).
   */
  it("client.ts에는 동의 버전 리터럴이 없다", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).not.toMatch(/type:\s*"(terms|privacy|marketing)"/);
    expect(clientSource).not.toMatch(/version:\s*"\d{4}-\d{2}-\d{2}"/);
    expect(clientSource).toContain('listConsentDefinitions(token: string)');
    expect(clientSource).toContain("const pending = requiredConsentAcceptances(consents);");
  });

  it("local-backend.ts의 동의 버전은 데모 정의 한 벌에만 있다", () => {
    const localSource = source("src/api/local-backend.ts");
    const versionLiterals = localSource.match(/version:\s*"2026-07-06"/g) ?? [];
    expect(versionLiterals).toHaveLength(3); // LOCAL_CONSENT_DEFINITIONS의 세 항목뿐
    expect(localSource).toContain("export function listConsents()");
  });
});

describe("데모 세션 왕복 (local backend = 데모의 서버)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("로그인 경로는 정의가 준 버전으로 필수 동의를 저장한다", async () => {
    const before = await getPrivacySettings(LOCAL_SESSION_TOKEN);
    expect(before.consents?.every((consent) => !consent.accepted)).toBe(true);

    expect(await upsertConsents(LOCAL_SESSION_TOKEN)).toEqual({ success: true });

    const after = await getPrivacySettings(LOCAL_SESSION_TOKEN);
    const accepted = (after.consents ?? []).filter((consent) => consent.accepted);
    expect(accepted.map((consent) => consent.type)).toEqual(["terms", "privacy"]);
    expect(accepted.every((consent) => typeof consent.acceptedAt === "string")).toBe(true);
    // 선택 동의는 사용자가 켠 적이 없으므로 그대로 "동의 안 함"이다(지어내지 않는다).
    expect((after.consents ?? []).find((consent) => consent.type === "marketing")?.accepted).toBe(false);
  });

  it("선택 동의 스위치는 그 항목만 켜고 끈다 -- 필수 동의를 지우지 않는다", async () => {
    await upsertConsents(LOCAL_SESSION_TOKEN);
    const marketing = (await getPrivacySettings(LOCAL_SESSION_TOKEN)).consents!.find(
      (consent) => consent.type === "marketing"
    )!;

    await setConsentAccepted(LOCAL_SESSION_TOKEN, marketing, true);
    let consents = (await getPrivacySettings(LOCAL_SESSION_TOKEN)).consents!;
    expect(consents.find((consent) => consent.type === "marketing")?.accepted).toBe(true);
    expect(consents.filter((consent) => consent.required).every((consent) => consent.accepted)).toBe(true);

    await setConsentAccepted(LOCAL_SESSION_TOKEN, marketing, false);
    consents = (await getPrivacySettings(LOCAL_SESSION_TOKEN)).consents!;
    const revoked = consents.find((consent) => consent.type === "marketing")!;
    expect(revoked.accepted).toBe(false);
    // 철회한 항목은 동의일을 남기지 않는다(동의 내역 줄이 "동의 안 함"이어야 한다).
    expect(revoked.acceptedAt).toBeNull();
    expect(consents.filter((consent) => consent.required).every((consent) => consent.accepted)).toBe(true);
  });

  it("이미 동의를 마친 세션에서 다시 로그인해도 동의일이 밀리지 않는다", async () => {
    await upsertConsents(LOCAL_SESSION_TOKEN);
    const first = (await getPrivacySettings(LOCAL_SESSION_TOKEN)).consents!.find(
      (consent) => consent.type === "terms"
    )!.acceptedAt;

    await new Promise((resolve) => setTimeout(resolve, 2));
    await upsertConsents(LOCAL_SESSION_TOKEN);

    const second = (await getPrivacySettings(LOCAL_SESSION_TOKEN)).consents!.find(
      (consent) => consent.type === "terms"
    )!.acceptedAt;
    expect(second).toBe(first);
  });
});
