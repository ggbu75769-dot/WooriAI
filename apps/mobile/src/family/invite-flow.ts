/**
 * 라운드 52 C-04/C-06 — 가족 초대 "역할 선택 → 링크 생성 → 전달"의 계약 단일 소스.
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 가족 화면(app/family/index.tsx)의 빠른 초대는 이렇게 동작했다.
 *
 * 1. 역할 Alert에서 공동부모/보기 전용 중 하나를 고르면 **그 자리에서 서버에 초대를 만들고**
 * 2. 응답(`inviteUrl`)을 **버린 채** 빈 초대 폼(`/family/invite`)으로 이동했다.
 *
 * 서버는 초대 토큰을 sha256 해시로만 보관하므로(households/household-runtime.service.ts) 그
 * 링크는 그 응답 말고는 어디에서도 다시 볼 수 없다. 즉 첫 초대는 **만들어지자마자 영영 유실**됐고,
 * 사용자에게 남는 것은 "대기 중인 초대"에 뜬 정체불명의 유령 행뿐이었다. 게다가 이동한 초대
 * 화면은 Alert에서 고른 역할을 모른 채 늘 기본값(공동부모)으로 서 있어서, 거기서 [초대 링크
 * 만들기]를 누르면 **고른 것과 다른 역할**의 초대가 하나 더 만들어졌다. 선물 참여는 초대 화면에는
 * 있는데 Alert에는 없어(2역할) 빠른 초대로는 도달할 수도 없었다.
 *
 * ## 이 모듈이 고정하는 세 가지
 *
 * 1. **역할 선택은 생성 전에** — 역할은 링크를 만들기 전에 정해진다(Alert 또는 초대 화면의 선택).
 * 2. **결과는 반드시 표시되는 곳에서만 만든다** — `createInvite` 호출은 응답의 `inviteUrl`을
 *    화면에 그려 공유/복사까지 내주는 초대 화면 한 곳뿐이다.
 * 3. **전달하지 못할 거면 만들지 않는다** — 링크를 보여 줄 자리가 없는 화면(가족 화면)은 초대를
 *    생성하지 않고 초대 화면으로 역할만 넘긴다.
 *
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 판정·문구는 여기서 단위 테스트하고, 배선은
 * 소스 grep 계약 테스트가 맡는다(invite-flow.test.ts) — invite-permissions.ts와 같은 관례.
 */

import type { InviteRole } from "../api/client";

export type InviteRoleChoice = {
  role: InviteRole;
  label: string;
  description: string;
};

/**
 * 초대할 수 있는 세 역할과 그 설명. 원래 app/family/invite.tsx의 `roleOptions`에만 있던 표를
 * 그대로 올렸다(문구 변경 없음) — 이제 초대 화면의 라디오 목록과 가족 화면의 역할 Alert이 **같은
 * 표**를 읽는다. 두 자리가 각자 목록을 들고 있던 것이 "Alert에는 선물 참여가 없다"의 원인이었다.
 *
 * 순서도 초대 화면이 쓰던 순서 그대로다(공동부모 → 보기 전용 → 선물 참여).
 */
export const INVITE_ROLE_CHOICES: ReadonlyArray<InviteRoleChoice> = [
  { role: "co_parent", label: "공동부모", description: "지출 기록과 예산을 함께 관리할 수 있어요" },
  { role: "viewer", label: "보기 전용", description: "기록만 확인할 수 있어요" },
  { role: "gift_participant", label: "선물 참여", description: "선물 준비 목록만 함께 볼 수 있어요" }
];

/** 초대 화면이 아무것도 넘겨받지 못했을 때 서 있는 역할 — 종전 화면의 초기값 그대로다. */
export const DEFAULT_INVITE_ROLE: InviteRole = "co_parent";

/** 가족 화면 → 초대 화면으로 고른 역할을 넘길 때 쓰는 쿼리 파라미터 이름. */
export const INVITE_ROLE_PARAM = "role";

export const INVITE_ROLE_PROMPT_TITLE = "어떤 역할로 초대할까요?";
export const INVITE_ROLE_PROMPT_CANCEL_LABEL = "취소";

/**
 * Alert 본문. 라벨만 나열하면 "보기 전용"과 "선물 참여"의 차이를 고르는 순간에는 알 수 없어,
 * 초대 화면이 이미 쓰고 있던 설명문을 같은 표에서 그대로 가져와 함께 읽힌다.
 */
export const INVITE_ROLE_PROMPT_MESSAGE = INVITE_ROLE_CHOICES.map(
  (choice) => `${choice.label} · ${choice.description}`
).join("\n");

/**
 * react-native의 Android Alert은 버튼을 **3개까지만** 그린다 — 네이티브 AlertDialog에
 * positive/negative/neutral 세 자리밖에 없어서, RN이 `buttons.slice(0, 3)`으로 자르고 나머지는
 * 조용히 버린다(react-native/Libraries/Alert/Alert.js). 이 앱의 배포 대상은 Android다(app.json).
 */
const ANDROID_ALERT_BUTTON_LIMIT = 3;

export type InviteRolePrompt = {
  title: string;
  message: string;
  roles: ReadonlyArray<InviteRoleChoice>;
  /** 취소 버튼을 버튼 목록에 넣어도 역할이 잘리지 않는가. */
  showsCancelButton: boolean;
  /** 취소 버튼이 없을 때 바깥 탭/뒤로가기로 닫을 수 있어야 한다(Android 기본값은 false). */
  cancelable: boolean;
};

/**
 * 역할 Alert의 구성. 플랫폼을 인자로 받는 순수 함수다(호출부가 `Platform.OS`를 넘긴다 —
 * src/export/share-csv.ts와 같은 관례).
 *
 * Android에서 "취소 + 세 역할"을 그대로 넘기면 **네 번째 버튼이 잘려 나간다.** 어떤 순서로 두든
 * 하나는 사라지므로, 잘리는 쪽이 역할이 되면 이 라운드가 고치려는 바로 그 문제(선물 참여에 도달할
 * 수 없음)가 그대로 재발한다. 그래서 상한을 넘는 플랫폼에서는 **역할 셋을 모두 남기고** 취소
 * 버튼을 빼는 대신 다이얼로그를 닫을 수 있게 만든다(`cancelable`) — 아무것도 고르지 않고 빠져
 * 나가는 길은 남고, 세 역할은 모두 눌린다.
 */
export function inviteRolePrompt(platform: string): InviteRolePrompt {
  const buttonCountWithCancel = INVITE_ROLE_CHOICES.length + 1;
  const showsCancelButton = platform !== "android" || buttonCountWithCancel <= ANDROID_ALERT_BUTTON_LIMIT;
  return {
    title: INVITE_ROLE_PROMPT_TITLE,
    message: INVITE_ROLE_PROMPT_MESSAGE,
    roles: INVITE_ROLE_CHOICES,
    showsCancelButton,
    cancelable: !showsCancelButton
  };
}

const INVITE_ROLES: ReadonlyArray<InviteRole> = INVITE_ROLE_CHOICES.map((choice) => choice.role);

/** 문자열이 우리가 아는 세 역할 중 하나인가. */
export function isInviteRole(value: unknown): value is InviteRole {
  return typeof value === "string" && (INVITE_ROLES as ReadonlyArray<string>).includes(value);
}

/**
 * 초대 화면이 받은 `role` 파라미터를 방어적으로 읽는다.
 *
 * expo-router의 `useLocalSearchParams`는 같은 이름이 여러 번 오면 배열을 준다. 딥링크·수동 URL로
 * 무엇이든 들어올 수 있으므로 아는 값만 통과시키고, 나머지는 `null`이다(호출부는 기본 역할로
 * 떨어진다) — 모르는 값을 그대로 서버에 보내면 400이 되고, 사용자는 자기가 고르지도 않은 역할
 * 때문에 실패를 본다.
 */
export function parseInviteRoleParam(value: unknown): InviteRole | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isInviteRole(candidate) ? candidate : null;
}

/**
 * 초대 화면으로 가는 목적지. 역할을 쿼리로 실어 보내 화면이 그 역할로 서 있게 한다
 * (app/(tabs)/records.tsx의 `router.push({ pathname, params })`와 같은 형태).
 */
export function inviteScreenHref(role: InviteRole): {
  pathname: "/family/invite";
  params: Record<string, string>;
} {
  return { pathname: "/family/invite", params: { [INVITE_ROLE_PARAM]: role } };
}
