import { CHILD_STAGE_MODES, isChildStageCode } from "@wooriai/domain";
import { createChild, LOCAL_SESSION_TOKEN, updateChild } from "../api/client";

/**
 * 온보딩 ONB-002가 보내는 아이 생성 입력 — 실서버 `POST /children` 바디와 같은 모양이고,
 * src/children/child-form.ts의 `buildCreateChildBody`가 돌려주는 값을 그대로 받는다.
 */
export type OnboardingChildInput = {
  householdId: string;
  nickname: string;
  stageMode: string;
  dueDate?: string;
  birthDate?: string;
  manualStage?: string | null;
};

/**
 * 실기기 피드백 1: 아이를 만드는 **단 하나의** 온보딩 경로.
 *
 * 실세션에서는 예전과 정확히 같다 — `POST /children` 한 번(같은 Idempotency-Key로 재시도까지
 * 그대로). 요청이 하나도 늘지 않는다.
 *
 * 데모(로컬) 세션에서만 `PATCH /children/:id`에 해당하는 호출이 한 번 더 붙는다. 이유는
 * src/api/client.ts의 로컬 분기가 생성 바디에서 **별명만** 로컬 백엔드로 넘기기 때문이다
 * (`localBackend.createChild({ nickname })`). 그래서 로컬 백엔드의 아이는 단계 미설정 상태로
 * 만들어지고, 나머지 단계 입력(임신 중/태어남/직접 선택 + 예정일·출생일·수동 단계)을 여기서
 * 곧바로 채운다 — 그 값들이야말로 사용자가 온보딩에서 직접 입력한 "아이 정보"이므로 하나도
 * 잃어버리면 안 된다. 두 호출 모두 로컬 스토어 쓰기라 네트워크는 오가지 않는다.
 */
export async function createOnboardingChild(
  token: string,
  input: OnboardingChildInput,
  idempotencyKey?: string
): Promise<{ id: string }> {
  const created = await createChild(
    token,
    {
      householdId: input.householdId,
      nickname: input.nickname,
      stageMode: input.stageMode,
      dueDate: input.dueDate,
      birthDate: input.birthDate,
      manualStage: input.manualStage ?? undefined
    },
    idempotencyKey
  );
  if (token !== LOCAL_SESSION_TOKEN) {
    return created;
  }
  // 형식만 좁힌다(값 자체는 ONB-001/ONB-002가 이미 고른 것이다). 알 수 없는 모드는 조용히
  // 넘기지 않고 실패시킨다 -- 단계 미설정 아이가 남으면 온보딩이 끝나도 홈이 열리지 않는다.
  const stageMode = CHILD_STAGE_MODES.find((mode) => mode === input.stageMode);
  if (!stageMode) {
    throw new Error("아이 단계를 선택해 주세요.");
  }
  await updateChild(token, created.id, {
    stageMode,
    dueDate: input.dueDate,
    birthDate: input.birthDate,
    manualStage: isChildStageCode(input.manualStage) ? input.manualStage : undefined
  });
  return created;
}
