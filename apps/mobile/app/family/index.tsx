import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  cancelHouseholdInvite,
  createInvite,
  listHouseholdInvites,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  LOCAL_USER_ID,
  removeHouseholdMember,
  type InviteRole
} from "../../src/api/client";
import {
  INVITE_CREATE_FAILED_ALERT_TITLE,
  INVITE_OWNER_ONLY_CAPTION,
  inviteCreateErrorMessage,
  isInviteEntryPointLocked
} from "../../src/family/invite-permissions";
import { formatInviteExpiry, memberBadge, memberRoleLabel } from "../../src/family/memberLabels";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, EmptyStateCard, FamilyAvatarGroup, StatusBadge } from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { resolveScreenPhase } from "../../src/screen-phase";
import { FamilyPixelStyles } from "../../src/pixelLock/styles";

const previewMembers = [
  { id: "preview-mom", avatar: "엄", displayName: "엄마 (나)", role: "owner", status: "active" },
  { id: "preview-dad", avatar: "아", displayName: "아빠", role: "co_parent", status: "active" },
  { id: "preview-grandma", avatar: "할", displayName: "할머니", role: "viewer", status: "pending" }
] as const;

const familyReferenceScreenId = "pixel-screen-FAM-001 FAM-001";
function familyReferenceFrameStyle() {
  return {
    gap: 16,
    transform: [
      { translateX: FamilyPixelStyles.horizontalOffset },
      { translateY: FamilyPixelStyles.topOffset },
      { scale: FamilyPixelStyles.scale }
    ]
  } as const;
}
const familyInviteRows = [
  { icon: "↗", title: "링크로 초대", value: "" },
  { icon: "□", title: "초대 코드 공유", value: "DAON2025" }
] as const;

/**
 * UX-Q(A): `onPress` 없이 `caption`만 받으면 비활성 행이 된다 — app/(tabs)/more.tsx의
 * MoreMenuRow가 쓰는 "캡션이 › 자리를 대신하고 Pressable은 disabled" 관례 그대로다. 캡션도
 * onPress도 없던 예전 호출부(비로그인 미리보기 = FAM-001 픽셀락 캡처)는 아래 분기가 모두
 * 예전 가지로 떨어져 같은 노드를 그린다.
 */
function FamilyInviteRow({
  icon,
  title,
  value,
  caption,
  onPress
}: {
  icon: string;
  title: string;
  value?: string;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      // 비활성 이유는 힌트로 따라 읽힌다(라벨은 A11Y-101이 고정한 형태 그대로 둔다).
      accessibilityHint={caption}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={familyInviteRowStyle}
    >
      <Text style={familyInviteIconStyle}>{icon}</Text>
      <Text style={familyInviteTitleStyle}>{title}</Text>
      {value ? <Text style={familyInviteValueStyle}>{value}</Text> : null}
      {caption ? (
        <Text style={familyInviteCaptionStyle}>{caption}</Text>
      ) : (
        <Text accessible={false} style={familyInviteChevronStyle}>›</Text>
      )}
    </Pressable>
  );
}

export default function FamilyScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionUserId = useSessionStore((state) => state.userId);
  const userId = sessionUserId ?? (isTestSession ? LOCAL_USER_ID : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const queryClient = useQueryClient();
  const hasSession = Boolean(authToken && householdId);
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: hasSession,
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  // FAM-121B: owner-only. Computed before the loading/error early-returns below so the
  // pending-invite query's `enabled` flag can depend on it without breaking hook order.
  const myRole = hasSession ? members.data?.members.find((member) => member.userId === userId)?.role : undefined;
  const canManageMembers = hasSession && myRole === "owner";
  const pendingInvites = useQuery({
    queryKey: ["household-invites", householdId],
    enabled: canManageMembers,
    queryFn: () => listHouseholdInvites(authToken!, householdId!)
  });
  // UX-Q(A): 초대 진입점(`+`·"링크로 초대"·"가족 초대하기")은 서버와 같은 기준으로만 눌린다.
  // 판정은 src/family/invite-permissions.ts가 지고, 여기서는 그 결과만 읽는다.
  //
  // canManageMembers(= owner일 때 true)의 부정을 쓰지 않는 것이 핵심이다: 비로그인 미리보기는
  // canManageMembers가 false라, 그 값으로 가리면 FAM-001 픽셀락 캡처가 찍는 화면에서 초대 행이
  // 통째로 사라져 락이 깨진다. 잠금은 "실세션인데 owner가 아닐 때"만이다.
  const inviteLocked = isInviteEntryPointLocked({ hasSession, myRole });
  const quickInvite = useMutation({
    mutationFn: (role: InviteRole) => createInvite(authToken!, householdId!, role, "link"),
    // 종전에는 onError가 아예 없어서, 공동부모가 초대 버튼을 누르면 요청이 403으로 죽고 화면은
    // 아무 말도 하지 않았다(무반응). 이제 잠금이 먼저 막지만, 잠금이 못 잡는 경우(초대 직후
    // 역할 강등 등 구성원 캐시와 서버가 갈리는 순간)에도 실패를 반드시 말한다.
    onError: (error) => {
      Alert.alert(INVITE_CREATE_FAILED_ALERT_TITLE, inviteCreateErrorMessage(error));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      await queryClient.invalidateQueries({ queryKey: ["household-invites"] });
      router.push("/family/invite");
    }
  });
  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeHouseholdMember(authToken!, householdId!, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
    }
  });
  // UX-R(M): 이 화면은 앱에서 유일하게 **서버가 지금 말하는 내 역할**을 읽는 자리다(구성원
  // 목록). 로그인·초대 수락 때 담아 둔 세션 스토어의 역할 표를 여기서 최신화해, 역할이 바뀐
  // 뒤(보기 전용 → 공동부모 승격 등)에도 기록 진입점 판정이 서버와 같은 값을 본다.
  // 새 요청은 없다 — 이미 이 화면이 부르는 members 응답을 그대로 옮길 뿐이다. 비로그인
  // 미리보기(previewMembers)는 hasSession이 false라 여기까지 오지 않으므로 FAM-001 픽셀락
  // 캡처와 무관하고, 데모 세션의 나는 owner라(src/api/local-fixtures.ts) 담아도 아무것도
  // 잠기지 않는다.
  const setHouseholdRole = useSessionStore((state) => state.setHouseholdRole);
  useEffect(() => {
    if (!hasSession || !householdId || !myRole) return;
    setHouseholdRole(householdId, myRole);
  }, [hasSession, householdId, myRole, setHouseholdRole]);
  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) => cancelHouseholdInvite(authToken!, householdId!, inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-invites"] });
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
    }
  });

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const membersPhase = resolveScreenPhase({
    isPending: members.isPending,
    isError: members.isError,
    hasData: Boolean(members.data)
  });

  if (hasSession && membersPhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onPress={() => members.refetch()}
        />
      </AppScreen>
    );
  }

  if (hasSession && membersPhase === "loading") {
    // MOB-119 (UX-5B-5 후속, D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    // 가족계정 카드 1장 + 멤버 행 실루엣으로 본 화면 형태를 따라간다.
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </AppScreen>
    );
  }

  const visibleMembers = hasSession ? members.data!.members : previewMembers;
  const avatarNames = visibleMembers.map((member) => ("avatar" in member ? member.avatar : member.displayName));
  const openInvite = () => {
    if (!(authToken && householdId)) {
      router.push("/family/invite");
      return;
    }
    Alert.alert("어떤 역할로 초대할까요?", "함께할 역할을 선택해 주세요.", [
      { text: "취소", style: "cancel" },
      { text: "공동부모", onPress: () => quickInvite.mutate("co_parent") },
      { text: "보기 전용", onPress: () => quickInvite.mutate("viewer") }
    ]);
  };
  const confirmCancelInvite = (inviteId: string, roleLabel: string) => {
    Alert.alert(`${roleLabel} 초대를 취소할까요?`, "이미 보낸 초대 링크는 바로 사용할 수 없게 돼요.", [
      { text: "그대로 둘게요", style: "cancel" },
      { text: "초대 취소", style: "destructive", onPress: () => cancelInvite.mutate(inviteId) }
    ]);
  };
  const confirmRemoveMember = (memberId: string, memberDisplayName: string) => {
    Alert.alert(`${memberDisplayName}님을 삭제할까요?`, "가족 구성원에서 삭제해요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          Alert.alert("정말 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
            { text: "취소", style: "cancel" },
            { text: "삭제할게요", style: "destructive", onPress: () => removeMember.mutate(memberId) }
          ]);
        }
      }
    ]);
  };

  return (
    <AppScreen>
      <View testID={familyReferenceScreenId} style={familyReferenceFrameStyle()}>
        <View style={familyHeaderRowStyle}>
          <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Text style={familyBackStyle}>‹</Text>
          </Pressable>
          <Text style={familyTitleStyle}>가족과 함께</Text>
        </View>

        <View style={familyAvatarRowStyle}>
          <FamilyAvatarGroup names={avatarNames} />
          {/* 진입점 ①: 아바타 줄의 `+`. 아이콘 버튼이라 캡션을 놓을 자리가 없으므로, 잠기면
              글리프를 회색으로 낮춰 눈으로 알리고 이유는 accessibilityHint로 읽힌다(같은 문장이
              바로 아래 "초대하기" 행의 캡션으로도 보인다). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="가족 초대하기"
            accessibilityHint={inviteLocked ? INVITE_OWNER_ONLY_CAPTION : undefined}
            accessibilityState={{ disabled: inviteLocked }}
            disabled={inviteLocked}
            onPress={inviteLocked ? undefined : openInvite}
            style={familyPlusButtonStyle}
          >
            <Text style={inviteLocked ? familyPlusDisabledTextStyle : familyPlusTextStyle}>+</Text>
          </Pressable>
        </View>

        <Card style={familyProfileCardStyle}>
          <Text style={familyProfileTitleStyle}>우리아이 가족계정</Text>
          <View style={familyProfileBodyStyle}>
            <FamilyAvatarGroup names={hasSession ? avatarNames : ["다"]} />
            <View>
              <Text style={familyProfileNameStyle}>{hasSession ? "우리 가족" : "다온이 패밀리"}</Text>
              <Text style={familyProfileMetaStyle}>
                {hasSession ? visibleMembers.map((member) => member.displayName).join(" · ") : "엄마 · 아빠 · 할머니"}
              </Text>
            </View>
          </View>
        </Card>

        <Text style={familySectionTitleStyle}>초대하기</Text>
        <View style={familyInviteGroupStyle}>
          {/* 진입점 ②: "링크로 초대" 행. 잠기면 › 자리에 캡션이 들어오고 행 자체가 disabled가
              된다(more.tsx의 비활성 행 관례). 미리보기에서는 caption/onPress 모두 예전 그대로다. */}
          {(hasSession ? familyInviteRows.filter((row) => row.title !== "초대 코드 공유") : familyInviteRows).map((row) => (
            <FamilyInviteRow
              key={row.title}
              icon={row.icon}
              title={row.title}
              value={row.value}
              caption={inviteLocked ? INVITE_OWNER_ONLY_CAPTION : undefined}
              onPress={inviteLocked ? undefined : openInvite}
            />
          ))}
        </View>

        <Text style={familySectionTitleStyle}>멤버 관리</Text>
        <View style={familyMemberGroupStyle}>
          {visibleMembers.map((member) => (
            <View key={member.id} style={familyMemberRowStyle}>
              <FamilyAvatarGroup names={["avatar" in member ? member.avatar : member.displayName]} />
              <Text style={familyMemberNameStyle}>{member.displayName}</Text>
              {/*
                FAM-121B (E3): a real session gets the four domain role labels plus an
                explicit 수락 대기 marker. The non-session preview keeps the FAM-001
                reference image's two-badge wording (관리자/멤버) verbatim — that preview
                is exactly what the pixel-lock capture renders, so it must not drift.
              */}
              {hasSession ? (
                <StatusBadge {...memberBadge(member.role, member.status)} />
              ) : (
                <StatusBadge label={member.role === "owner" ? "관리자" : "멤버"} tone={member.role === "owner" ? "warning" : "neutral"} />
              )}
              {canManageMembers && "userId" in member && member.userId !== userId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${member.displayName} 삭제`}
                  disabled={removeMember.isPending}
                  onPress={() => confirmRemoveMember(member.id, member.displayName)}
                  hitSlop={8}
                >
                  <Text style={familyMemberDeleteStyle}>삭제</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {/*
          FAM-121B: 대기 중인 초대. Owner-only and session-only, so the non-session
          FAM-001 pixel-lock capture renders nothing extra here.
        */}
        {canManageMembers ? (
          <>
            <Text style={familySectionTitleStyle}>대기 중인 초대</Text>
            {pendingInvites.isLoading ? (
              <SkeletonRow />
            ) : pendingInvites.isError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="대기 중인 초대 다시 불러오기"
                onPress={() => pendingInvites.refetch()}
              >
                <Text style={familyInviteErrorStyle}>대기 중인 초대를 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
              </Pressable>
            ) : (pendingInvites.data?.invites.length ?? 0) === 0 ? (
              <Text style={familyInviteHintStyle}>대기 중인 초대가 없어요.</Text>
            ) : (
              <View style={familyMemberGroupStyle}>
                {pendingInvites.data!.invites.map((invite) => {
                  const roleLabel = memberRoleLabel(invite.role);
                  return (
                    <View key={invite.id} style={familyPendingInviteRowStyle}>
                      <View style={{ flex: 1 }}>
                        <Text style={familyMemberNameStyle}>{roleLabel} 초대</Text>
                        <Text style={familyPendingInviteMetaStyle}>{formatInviteExpiry(invite.expiresAt)}</Text>
                      </View>
                      <StatusBadge label="수락 대기" tone="neutral" />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${roleLabel} 초대 취소`}
                        disabled={cancelInvite.isPending}
                        onPress={() => confirmCancelInvite(invite.id, roleLabel)}
                        hitSlop={8}
                      >
                        <Text style={familyMemberDeleteStyle}>취소</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
            {/*
              Honesty note, not a placeholder: invite tokens are stored hashed on the
              server, so a link can never be shown again after the create screen. The
              only real recovery is cancel + create a new invite, and we say exactly that.
            */}
            {(pendingInvites.data?.invites.length ?? 0) > 0 ? (
              <Text style={familyInviteHintStyle}>보낸 링크는 보안을 위해 다시 볼 수 없어요. 링크를 잃어버렸다면 취소하고 새로 만들어 주세요.</Text>
            ) : null}
          </>
        ) : null}

        {/* 진입점 ③: 화면 맨 아래 "가족 초대하기". 잠기면 버튼을 지우지 않고 비활성으로 남긴
            뒤 바로 아래에 이유를 적는다 -- 버튼이 통째로 사라지면 "왜 나만 못 하지"라는 다른
            혼란이 생기고, 눌리는 채로 두면 예전의 무반응으로 돌아간다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="가족 초대하기"
          accessibilityHint={inviteLocked ? INVITE_OWNER_ONLY_CAPTION : undefined}
          accessibilityState={{ disabled: inviteLocked }}
          disabled={inviteLocked}
          onPress={inviteLocked ? undefined : openInvite}
          style={familyInviteButtonStyle}
        >
          <Text style={inviteLocked ? familyInviteButtonDisabledTextStyle : familyInviteButtonTextStyle}>가족 초대하기</Text>
        </Pressable>
        {inviteLocked ? <Text style={familyInviteHintStyle}>{INVITE_OWNER_ONLY_CAPTION}</Text> : null}
      </View>
    </AppScreen>
  );
}

const familyHeaderRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 4
} as const;

const familyBackStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "900"
} as const;

const familyTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30
} as const;

const familyAvatarRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const familyPlusButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.10)",
  borderRadius: 22,
  borderWidth: 1,
  height: 44,
  justifyContent: "center",
  width: 44,
  ...theme.shadows.card
} as const;

const familyPlusTextStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "700"
} as const;

// 비활성 상태의 글리프 색만 낮춘다(치수·배경은 그대로 -- 버튼이 어디 있었는지는 유지).
// 새 hex를 만들지 않고 앱이 이미 비활성 텍스트에 쓰는 gray300을 그대로 쓴다.
const familyPlusDisabledTextStyle = {
  color: theme.colors.gray300,
  fontSize: 24,
  fontWeight: "700"
} as const;

const familyProfileCardStyle = {
  gap: 14,
  paddingVertical: 18
} as const;

const familyProfileTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const familyProfileBodyStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12
} as const;

const familyProfileNameStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800",
  lineHeight: 22
} as const;

const familyProfileMetaStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const familySectionTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 15,
  fontWeight: "800",
  marginTop: 2
} as const;

const familyInviteGroupStyle = {
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: 18,
  borderWidth: 1,
  overflow: "hidden"
} as const;

const familyInviteRowStyle = {
  alignItems: "center",
  borderBottomColor: "rgba(74, 63, 53, 0.08)",
  borderBottomWidth: 1,
  flexDirection: "row",
  gap: 10,
  minHeight: 52,
  paddingHorizontal: 14
} as const;

const familyInviteIconStyle = {
  color: theme.colors.gray600,
  fontSize: 15,
  width: 18
} as const;

const familyInviteTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "800"
} as const;

const familyInviteValueStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;

// 비활성 행에서 ›를 대신하는 캡션. more.tsx의 moreMenuCaptionStyle과 같은 레시피에, 문장이
// 길어 좁은 폭에서 줄바꿈될 수 있으므로 flexShrink만 더한다.
const familyInviteCaptionStyle = {
  color: theme.colors.gray600,
  flexShrink: 1,
  fontSize: 12,
  fontWeight: "700",
  textAlign: "right"
} as const;

const familyInviteChevronStyle = {
  color: theme.colors.gray600,
  fontSize: 18,
  fontWeight: "700"
} as const;

const familyMemberGroupStyle = {
  gap: 8
} as const;

const familyMemberRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: "row",
  gap: 10,
  minHeight: 52,
  paddingHorizontal: 12,
  ...theme.shadows.card
} as const;

const familyMemberNameStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "800"
} as const;

const familyMemberDeleteStyle = {
  color: theme.colors.danger,
  fontSize: 13,
  fontWeight: "700"
} as const;

const familyPendingInviteRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: "row",
  gap: 10,
  minHeight: 56,
  paddingHorizontal: 12,
  paddingVertical: 8,
  ...theme.shadows.card
} as const;

const familyPendingInviteMetaStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  marginTop: 2
} as const;

const familyInviteHintStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const familyInviteErrorStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 18
} as const;

const familyInviteButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.12)",
  borderRadius: 16,
  borderWidth: 1,
  height: 52,
  justifyContent: "center"
} as const;

const familyInviteButtonTextStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;

const familyInviteButtonDisabledTextStyle = {
  color: theme.colors.gray300,
  fontSize: 14,
  fontWeight: "800"
} as const;
