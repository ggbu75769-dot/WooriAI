import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_SESSION_TOKEN } from "../api/client";
import * as localBackend from "../api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_HOUSEHOLD_ID } from "../api/local-fixtures";
import { buildCreateChildBody } from "../children/child-form";
import { createOnboardingChild } from "./child-create";

/**
 * 실기기 피드백 1: 온보딩 ONB-002가 입력받은 **아이 정보가 하나도 유실되지 않는다**는 계약.
 *
 * 데모(로컬) 세션에서 특히 중요하다 -- client.ts의 로컬 분기가 생성 바디에서 별명만 넘기므로,
 * 단계·예정일·출생일·수동 단계는 이어지는 updateChild가 채워야 한다.
 */
describe("createOnboardingChild", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("데모 세션: 임신 중 아이의 예정일까지 그대로 저장한다", async () => {
    const created = await createOnboardingChild(
      LOCAL_SESSION_TOKEN,
      buildCreateChildBody(LOCAL_HOUSEHOLD_ID, "pregnant", {
        nickname: " 튼튼이 ",
        dateText: "2999-05-05",
        manualStage: null
      })
    );

    expect(created.id).toBe(LOCAL_CHILD_ID);
    const [child] = localBackend.listChildren().children;
    expect(child).toMatchObject({
      nickname: "튼튼이",
      stageMode: "pregnant",
      dueDate: "2999-05-05",
      birthDate: null,
      manualStage: null
    });
  });

  it("데모 세션: 태어난 아이의 출생일까지 그대로 저장한다", async () => {
    await createOnboardingChild(
      LOCAL_SESSION_TOKEN,
      buildCreateChildBody(LOCAL_HOUSEHOLD_ID, "born", {
        nickname: "여정이",
        dateText: "2025-03-02",
        manualStage: null
      })
    );

    expect(localBackend.listChildren().children[0]).toMatchObject({
      nickname: "여정이",
      stageMode: "born",
      birthDate: "2025-03-02",
      dueDate: null
    });
  });

  it("데모 세션: 수동 단계 선택도 그대로 저장한다", async () => {
    await createOnboardingChild(
      LOCAL_SESSION_TOKEN,
      buildCreateChildBody(LOCAL_HOUSEHOLD_ID, "manual", {
        nickname: "우리아이",
        dateText: "",
        manualStage: "infant_4_6"
      })
    );

    expect(localBackend.listChildren().children[0]).toMatchObject({
      stageMode: "manual",
      manualStage: "infant_4_6"
    });
    expect(localBackend.listChildren().children[0].currentStage).toBe("infant_4_6");
  });

  it("실세션: 요청은 예전 그대로 POST /children 한 번이다(보정 호출이 붙지 않는다)", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        return new Response(JSON.stringify({ id: "server-child-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    const created = await createOnboardingChild(
      "live-access-token",
      buildCreateChildBody("household-1", "born", { nickname: "서버아이", dateText: "2025-03-02", manualStage: null }),
      "onb-child-key-1"
    );

    expect(created.id).toBe("server-child-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/children");
    expect(calls[0].url).not.toContain("/children/");
  });
});
