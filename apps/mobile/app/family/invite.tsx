import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Share, Text, View } from "react-native";
import {
  createInvite,
  listChildren,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  type InviteRole
} from "../../src/api/client";
import {
  collectKnownHouseholdIds,
  describeHouseholdScope,
  householdScopeInviteNotice,
  householdScopePhrase,
  isChildrenSettled,
  resolveManagedHouseholdId
} from "../../src/family/household-scope";
import {
  DEFAULT_INVITE_ROLE,
  INVITE_HOUSEHOLD_PARAM,
  INVITE_ROLE_CHOICES,
  INVITE_ROLE_PARAM,
  parseInviteHouseholdParam,
  parseInviteRoleParam
} from "../../src/family/invite-flow";
import { inviteCreateErrorMessage } from "../../src/family/invite-permissions";
import { formatInviteExpiry } from "../../src/family/memberLabels";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";

// 라운드 52 C-04: 역할 표는 src/family/invite-flow.ts가 단일 소스다 -- 이 화면의 라디오 목록과
// 가족 화면의 역할 Alert이 같은 표를 읽는다(문구·순서는 여기 있던 것 그대로다).

// UX-Q(A): 실패 문구는 src/family/invite-permissions.ts가 단일 소스다. 일반 재시도 문구
// (INVITE_CREATE_FAILED_MESSAGE)와 403(가족 초대는 관리자만) 전용 문구가 갈라져 있고, 초대 생성이
// 일어나는 자리가 이 화면 하나뿐이므로 두 문구가 나가는 자리도 아래 에러 줄 하나다 --
// 권한이 없어서 막힌 사람에게 "다시 시도해 주세요"는 거짓말이다.

export default function FamilyInviteScreen() {
  // 가족 화면에서 고른 역할을 그대로 이어받는다. 딥링크로 무엇이든 들어올 수 있으므로 아는
  // 값만 통과시키고(parseInviteRoleParam), 아니면 종전 기본값으로 선다.
  const params = useLocalSearchParams<{ role?: string | string[]; householdId?: string | string[] }>();
  const [role, setRole] = useState<InviteRole>(() => parseInviteRoleParam(params[INVITE_ROLE_PARAM]) ?? DEFAULT_INVITE_ROLE);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  /**
   * 라운드 60 A — 초대는 **보고 있는 아이의 가구**로 만든다.
   *
   * 종전에는 세션의 `defaultHouseholdId`였다. 다른 가구 초대를 수락하면 그 값이 영구히 바뀌므로
   * (app/family/accept/[token].tsx), 수락한 사용자가 원래 가구로 배우자를 부르려 해도 링크는
   * 늘 **새로 들어간 가구**로 만들어졌다 -- 가족 화면(대기 초대 목록)과도 다른 가구를 보게 된다.
   * 판정과 폴백 규칙은 src/family/household-scope.ts 한 곳에 있고, 아이 목록은 다른 화면들과
   * 같은 `["children"]` 캐시라 대개 새 요청이 없다.
   */
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  // 세션이 없으면 기다릴 조회 자체가 없다(쿼리가 disabled라 영원히 pending이다).
  const childrenSettled = isChildrenSettled({
    authToken,
    isSuccess: childrenQuery.isSuccess,
    isError: childrenQuery.isError
  });
  const scopedHouseholdId = resolveManagedHouseholdId({
    children: childrenQuery.data?.children,
    childId: selectedChildId,
    fallbackHouseholdId,
    childrenSettled
  });
  /**
   * 라운드 61 #3 — 가족 화면이 **가구를 전환한 채로** 보냈다면 그 가구로 초대를 만든다.
   *
   * 전환은 가족 화면의 지역 상태라 이 화면에서는 보이지 않는다(app/family/index.tsx의
   * `viewedHouseholdId`). 그래서 아이가 아직 없는 가구를 보며 [초대하기]를 누른 사람이 여기서
   * 아이 기준 판정으로 되돌아가, **다른 가구**로 부르는 링크를 만들고 있었다 — 그 초대는 돌아간
   * 가족 화면의 대기 목록에도 없다(C-04 재발: 링크를 잃었을 때의 유일한 복구 경로가 그 목록이다).
   *
   * 파라미터는 **아는 가구일 때만** 통과한다. 화이트리스트는 이 앱이 이미 "이 계정이 아는
   * 가구"로 세고 있는 그 목록이고(collectKnownHouseholdIds — 아이의 가구 · 서버가 말한 목록 ·
   * 기본 가구), 모르는 값은 조용히 무시하고 종전 판정으로 떨어진다(딥링크·수동 URL 방어).
   *
   * 매 렌더에서 다시 검증한다(effect로 상태를 만들지 않는다 — 가족 화면의 전환 검증과 같은
   * 형태다): 아이 목록이 늦게 도착해 화이트리스트가 넓어지면 그때 통과하고, 탈퇴 등으로 목록에서
   * 사라지면 즉시 아이 기준 판정으로 되돌아간다.
   */
  const requestedHouseholdId = parseInviteHouseholdParam(
    params[INVITE_HOUSEHOLD_PARAM],
    collectKnownHouseholdIds({
      children: childrenQuery.data?.children,
      knownHouseholdIds,
      fallbackHouseholdId
    })
  );
  const householdId = requestedHouseholdId ?? scopedHouseholdId;
  // 다가구 계정에서만 붙는 한 줄. 1가구 계정에서는 null이라 화면이 종전 그대로다.
  const householdNotice = householdScopeInviteNotice(
    householdScopePhrase(
      describeHouseholdScope({
        householdId,
        children: childrenQuery.data?.children,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    )
  );

  /**
   * 라운드 52 QA P2-2 — 만든 초대가 "대기 중인 초대"에 곧바로 뜨게 한다.
   *
   * 대기 목록은 가족 화면의 `["household-invites", householdId]` 쿼리다(app/family/index.tsx).
   * 이 화면이 초대를 **만들고도** 그 캐시를 건드리지 않아서, 뒤로 가면 목록은 초대 전 상태
   * 그대로였다 — 사용자에게는 "링크는 받았는데 목록에는 없는" 상태로 보이고, 잃어버린 링크의
   * 유일한 복구 경로(그 목록에서 취소하고 다시 만들기)를 그 자리에서 쓸 수 없다.
   *
   * 취소 뮤테이션이 이미 같은 키를 무효화하고 있으므로(같은 화면의 cancelInvite), 생성 쪽에도
   * 같은 규칙을 둔다: **초대 목록을 바꾸는 자리는 목록 무효화를 동반한다.** 무효화 범위는
   * 가족 화면의 취소 경로와 같게 `["household-invites"]` 접두 하나다 — 구성원 목록은 초대를
   * 만든다고 달라지지 않으므로(수락해야 구성원이 된다) 건드리지 않는다.
   */
  const queryClient = useQueryClient();
  const invite = useMutation({
    mutationFn: () => createInvite(authToken!, householdId!, role, "link"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-invites"] });
    }
  });

  const handleShare = async () => {
    if (!invite.data) return;
    try {
      await Share.share({ message: `우리아이 가족 초대 링크: ${invite.data.inviteUrl}` });
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <AppScreen>
      <View testID="screen-FAM-002" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="가족 관리"
          title="가족 초대"
          subtitle="함께할 역할을 선택하고 초대 링크를 만들어요"
          onBack={() => router.back()}
        />

        {/* 라운드 60 A: 이 링크가 어느 가구로 부르는지 -- 다가구 계정에서만 나타난다. */}
        {householdNotice ? <Text style={mutedTextStyle}>{householdNotice}</Text> : null}

        <Card style={{ gap: 8 }}>
          {INVITE_ROLE_CHOICES.map((option) => (
            <Pressable
              key={option.role}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}, ${option.description}`}
              accessibilityState={{ selected: role === option.role }}
              disabled={invite.isPending}
              onPress={() => setRole(option.role)}
              style={[roleRowStyle, role === option.role ? roleRowSelectedStyle : null]}
            >
              <View style={{ flex: 1 }}>
                <Text style={role === option.role ? roleLabelSelectedStyle : roleLabelStyle}>{option.label}</Text>
                <Text style={roleDescriptionStyle}>{option.description}</Text>
              </View>
              {role === option.role ? <Text style={roleCheckStyle}>✓</Text> : null}
            </Pressable>
          ))}
        </Card>

        {/* 라운드 60 A: 아이 목록을 기다리는 동안에는 아직 "가구 정보가 없다"고 단정하지 않는다
            -- 조회가 끝났는데도 가구를 못 찾은 경우에만 종전 문구를 그대로 말한다. */}
        {childrenSettled && !householdId ? (
          <Text style={mutedTextStyle}>가구 정보가 없어서 초대를 만들 수 없어요.</Text>
        ) : null}

        <PrimaryButton
          label={invite.isPending ? "링크 만드는 중..." : "초대 링크 만들기"}
          disabled={!authToken || !householdId || invite.isPending}
          onPress={() => invite.mutate()}
        />

        {invite.isError ? (
          <Text style={{ color: theme.colors.danger }}>{inviteCreateErrorMessage(invite.error)}</Text>
        ) : null}

        {invite.data ? (
          <Card style={{ gap: 10 }}>
            <Text style={inviteSuccessTitleStyle}>초대 링크가 준비됐어요</Text>
            {/*
              FAM-121B: `selectable` gives a real copy affordance (길게 눌러 복사) without
              adding a clipboard dependency — expo-clipboard is not in apps/mobile's
              dependencies and this ticket doesn't introduce new ones, so Share stays the
              one-tap path and long-press-to-copy covers "copy the link" natively.
            */}
            <Text
              selectable
              accessibilityHint="길게 눌러서 링크를 복사할 수 있어요"
              style={inviteLinkStyle}
            >
              {invite.data.inviteUrl}
            </Text>
            <Text style={inviteExpiryStyle}>{formatInviteExpiry(invite.data.expiresAt)}</Text>
            <SecondaryButton label="링크 공유하기" onPress={handleShare} />
            {/*
              Honest warning, matching how the server stores invites: only a sha256 hash
              of the token is kept, so this link can never be shown again. 가족 화면의
              "대기 중인 초대"에서 취소하고 새로 만드는 것이 유일한 복구 경로다.
            */}
            <Text style={mutedTextStyle}>
              이 링크는 지금 화면에서만 볼 수 있어요. 지금 공유하거나 길게 눌러 복사해 두세요. 잃어버리면 가족 화면의 “대기 중인 초대”에서 취소하고 새로 만들 수 있어요.
            </Text>
            {isTestSession ? (
              <Text style={mutedTextStyle}>테스트 모드예요. 이 초대 링크는 실제로 전송되지 않아요.</Text>
            ) : null}
          </Card>
        ) : null}
      </View>
    </AppScreen>
  );
}

const roleRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.small,
  borderWidth: 1,
  flexDirection: "row",
  gap: 10,
  paddingHorizontal: 14,
  paddingVertical: 12
} as const;

const roleRowSelectedStyle = {
  backgroundColor: theme.colors.primary100,
  borderColor: theme.colors.mainCoral
} as const;

const roleLabelStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "700"
} as const;

const roleLabelSelectedStyle = {
  color: theme.colors.mainCoral,
  fontSize: 14,
  fontWeight: "800"
} as const;

const roleDescriptionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  marginTop: 2
} as const;

const roleCheckStyle = {
  color: theme.colors.mainCoral,
  fontSize: 16,
  fontWeight: "800"
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 12
} as const;

const inviteSuccessTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;

const inviteLinkStyle = {
  color: theme.colors.mainCoral,
  fontSize: 13,
  fontWeight: "700"
} as const;

const inviteExpiryStyle = {
  color: theme.colors.gray600,
  fontSize: 12
} as const;
