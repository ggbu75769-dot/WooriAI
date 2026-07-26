import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import {
  createInvite,
  listHouseholdMembers,
  listMyHouseholds,
  LOCAL_HOUSEHOLD_ID,
  fixtureSessionToken,
  leaveHousehold,
  LOCAL_USER_ID,
  removeHouseholdMember,
  transferHouseholdOwnership,
  isApiErrorCode,
  type InviteRole
} from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { resolveAuthorizedHouseholdScope } from "../../src/households/authorization";
import { AppIcon, AppScreen, Card, EmptyStateCard, SampleDataBanner, StatusBadge } from "../../src/design-system";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
// release5v-source-quality-exception: FamilyAvatarGroup remains a family-domain visualization; owner=mobile-design-system; review=2026-10-01.
import { FamilyAvatarGroup } from "../../src/ui";
import { FamilyPixelStyles } from "../../src/pixelLock/styles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";

const previewMembers = [
  { id: "preview-mom", avatar: "엄", displayName: "엄마 (나)", role: "owner", status: "active" },
  { id: "preview-dad", avatar: "아", displayName: "아빠", role: "co_parent", status: "active" },
  { id: "preview-grandma", avatar: "할", displayName: "할머니", role: "viewer", status: "pending" }
] as const;

const familyReferenceScreenId = pixelEvidenceId("FAM-001 FAM-001");
const isPixelLockMode = isPixelLockBuild();
const staleAuthorityCodes = [
  "OWNERSHIP_CHANGED",
  "OWNER_TRANSFER_TARGET_CHANGED",
  "HOUSEHOLD_MEMBER_NOT_FOUND",
  "HOUSEHOLD_NOT_FOUND"
] as const;
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
  { icon: "link-variant", title: "링크로 초대", value: "" },
  { icon: "content-copy", title: "초대 코드 공유", value: "초대 링크에서 확인" }
] as const;

function FamilyInviteRow({ icon, title, value, onPress }: { icon: "link-variant" | "content-copy"; title: string; value?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress} style={familyInviteRowStyle}>
      <View style={familyInviteIconStyle}><AppIcon color={theme.colors.coral[600]} name={icon} size={22} /></View>
      <Text style={familyInviteTitleStyle}>{title}</Text>
      {value ? <Text style={familyInviteValueStyle}>{value}</Text> : null}
      <View style={familyInviteChevronStyle}><AppIcon color={theme.colors.gray600} name="chevron-right" size={22} /></View>
    </Pressable>
  );
}

export default function FamilyScreen() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const sessionUserId = useSessionStore((state) => state.userId);
  const userId = sessionUserId ?? (isTestSession ? LOCAL_USER_ID : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const requestedHouseholdId = Array.isArray(params.householdId) ? params.householdId[0] : params.householdId;
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clearSession);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const authorizedHouseholds = useQuery({
    queryKey: ["me", "households"],
    enabled: Boolean(authToken),
    queryFn: () => listMyHouseholds(authToken!)
  });
  const authorizedScope = resolveAuthorizedHouseholdScope({
    requestedHouseholdId,
    defaultHouseholdId: sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null),
    authorizedHouseholdIds: authorizedHouseholds.data?.households.map((household) => household.id) ?? []
  });
  const householdId = authorizedScope.householdId;
  const hasSession = Boolean(authToken && householdId && authorizedHouseholds.data);
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: hasSession,
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const quickInvite = useMutation({
    mutationFn: (role: InviteRole) => createInvite(authToken!, householdId!, role, "link"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      router.push("/family/invite");
    }
  });
  const recoverAuthorityState = async (error: unknown, message: string) => {
    if (!isApiErrorCode(error, ...staleAuthorityCodes)) return false;
    setSelectedOwnerUserId(null);
    setRecoveryMessage(message);
    await queryClient.invalidateQueries({ queryKey: ["household-members", householdId] });
    return true;
  };
  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeHouseholdMember(authToken!, householdId!, memberId),
    onSuccess: async () => {
      setRecoveryMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["household-members", householdId] });
    },
    onError: async (error) => {
      const recovered = await recoverAuthorityState(error, "가족 정보가 변경되어 최신 구성원을 다시 불러왔어요.");
      Alert.alert(
        "구성원을 삭제하지 못했어요",
        recovered ? "최신 가족 정보를 확인한 뒤 다시 시도해 주세요." : "현재 권한과 구성원 상태를 확인해 주세요."
      );
    }
  });
  const transferOwner = useMutation({
    mutationFn: (targetUserId: string) => transferHouseholdOwnership(authToken!, householdId!, targetUserId),
    onSuccess: async () => {
      setSelectedOwnerUserId(null);
      setRecoveryMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["household-members", householdId] });
    },
    onError: async (error) => {
      const recovered = await recoverAuthorityState(error, "가족 정보가 변경되어 소유권 대상을 다시 확인해 주세요.");
      Alert.alert(
        "소유권을 이전하지 못했어요",
        recovered
          ? "가족 정보가 먼저 변경됐어요. 최신 구성원을 다시 확인해 주세요."
          : "대상 구성원의 역할과 현재 가족 상태를 확인해 주세요."
      );
    }
  });
  const leave = useMutation({
    mutationFn: () => leaveHousehold(authToken!, householdId!),
    onSuccess: () => {
      queryClient.clear();
      clearSession();
      router.replace("/");
    },
    onError: async (error) => {
      if (isApiErrorCode(error, "OWNER_TRANSFER_REQUIRED")) {
        Alert.alert(
          "먼저 가족 소유권을 이전해 주세요",
          "가족 소유자는 바로 나갈 수 없어요. 기록 가능 구성원에게 소유권을 이전한 뒤 다시 시도해 주세요."
        );
        return;
      }
      const recovered = await recoverAuthorityState(error, "가족 정보가 변경되어 최신 상태를 다시 불러왔어요.");
      Alert.alert(
        "가족을 나가지 못했어요",
        recovered ? "최신 가족 정보에서 소유권과 권한을 확인해 주세요." : "현재 권한과 가족 상태를 다시 확인해 주세요."
      );
    }
  });

  if (!authToken && !isPixelLockMode) {
    return <Redirect href="/launch-animation" />;
  }

  if (authToken && authorizedHouseholds.isError) {
    return (
      <AppScreen>
        <EmptyStateCard
          title="접근 가능한 가족을 확인하지 못했어요."
          actionLabel="다시 시도"
          onPress={() => authorizedHouseholds.refetch()}
        />
      </AppScreen>
    );
  }

  if (authToken && (authorizedHouseholds.isLoading || !authorizedHouseholds.data)) {
    return (
      <AppScreen>
        <EmptyStateCard title="접근 가능한 가족을 확인하고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (authToken && !householdId) {
    return (
      <AppScreen>
        <EmptyStateCard title="참여 중인 가족이 없어요." actionLabel="홈으로" onPress={() => router.replace("/")} />
      </AppScreen>
    );
  }

  if (hasSession && members.isError) {
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

  if (hasSession && (members.isLoading || !members.data)) {
    return (
      <AppScreen>
        <EmptyStateCard title="가족 정보를 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  const visibleMembers = hasSession ? members.data!.members : previewMembers;
  const avatarNames = visibleMembers.map((member) => ("avatar" in member ? member.avatar : member.displayName));
  const myRole = hasSession ? visibleMembers.find((member) => "userId" in member && member.userId === userId)?.role : undefined;
  const canManageMembers = hasSession && myRole === "owner";
  const eligibleOwners = hasSession
    ? visibleMembers.filter((member) => "userId" in member && member.status === "active" && member.role === "co_parent" && member.userId !== userId)
    : [];
  const openInvite = () => {
    if (!(authToken && householdId)) {
      router.push("/family/invite");
      return;
    }
    Alert.alert("어떤 역할로 초대할까요?", "함께할 역할을 선택해 주세요.", [
      { text: "취소", style: "cancel" },
      { text: "기록 가능", onPress: () => quickInvite.mutate("co_parent") },
      { text: "보기 전용", onPress: () => quickInvite.mutate("viewer") }
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
  const confirmOwnerTransfer = () => {
    const target = eligibleOwners.find((member) => "userId" in member && member.userId === selectedOwnerUserId);
    if (!target || !("userId" in target)) return;
    Alert.alert(
      `${target.displayName}님에게 소유권을 이전할까요?`,
      "소유권을 이전하면 선택한 구성원이 가족 설정과 구성원 관리를 담당합니다. 이전 후에는 현재 권한이 기록 가능으로 변경됩니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "소유권 이전", onPress: () => transferOwner.mutate(target.userId) }
      ]
    );
  };
  const confirmLeave = () => {
    if (myRole === "owner") {
      Alert.alert(
        "먼저 소유권을 이전해 주세요",
        eligibleOwners.length > 0
          ? "다른 기록 가능 구성원이 있어요. 아래에서 새 관리자를 정한 뒤 가족을 나갈 수 있습니다."
          : "현재 소유권을 넘길 기록 가능 구성원이 없어요. 먼저 가족을 초대해 기록 가능 역할을 부여하거나, 이 가족을 유지한 채 계정을 사용해 주세요."
      );
      return;
    }
    Alert.alert("가족을 나갈까요?", "나간 뒤에는 이 가족의 준비 정보와 비용을 볼 수 없습니다.", [
      { text: "취소", style: "cancel" },
      { text: "가족 나가기", style: "destructive", onPress: () => leave.mutate() }
    ]);
  };

  return (
    <AppScreen>
      <View accessibilityLabel={familyReferenceScreenId} style={isPixelLockMode ? familyReferenceFrameStyle() : { gap: 16 }}>
        {isTestSession ? <SampleDataBanner /> : null}
        {recoveryMessage ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 14, fontWeight: "700" }}>
            {recoveryMessage}
          </Text>
        ) : null}
        {authorizedScope.rejectedRequestedHousehold ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 14, fontWeight: "700" }}>
            요청한 가족에 접근할 수 없어 참여 중인 가족을 열었어요.
          </Text>
        ) : null}
        <View style={familyHeaderRowStyle}>
          <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" hitSlop={12} onPress={() => router.back()} style={{ alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48 }}>
            <AppIcon name="chevron-left" size={26} />
          </Pressable>
          <Text style={familyTitleStyle}>가족과 함께</Text>
        </View>

        <View style={familyAvatarRowStyle}>
          <FamilyAvatarGroup names={avatarNames} />
          <Pressable
            accessibilityLabel="가족 초대하기"
            accessibilityRole="button"
            hitSlop={2}
            onPress={openInvite}
            style={familyPlusButtonStyle}
          >
            <Text style={familyPlusTextStyle}>+</Text>
          </Pressable>
        </View>

        <Card style={familyProfileCardStyle}>
          <Text style={familyProfileTitleStyle}>우리아이 가족계정</Text>
          <View style={familyProfileBodyStyle}>
            <FamilyAvatarGroup names={hasSession ? avatarNames : ["우"]} />
            <View>
              <Text style={familyProfileNameStyle}>{hasSession ? "우리 가족" : "샘플 가족"}</Text>
              <Text style={familyProfileMetaStyle}>
                {hasSession ? visibleMembers.map((member) => member.displayName).join(" · ") : "엄마 · 아빠 · 할머니"}
              </Text>
            </View>
          </View>
        </Card>

        <Text style={familySectionTitleStyle}>초대하기</Text>
        <View style={familyInviteGroupStyle}>
          {(hasSession ? familyInviteRows.filter((row) => row.title !== "초대 코드 공유") : familyInviteRows).map((row) => (
            <FamilyInviteRow key={row.title} icon={row.icon} title={row.title} value={row.value} onPress={openInvite} />
          ))}
        </View>

        <Text style={familySectionTitleStyle}>멤버 관리</Text>
        <View style={familyMemberGroupStyle}>
          {visibleMembers.map((member) => (
            <View key={member.id} style={familyMemberRowStyle}>
              <FamilyAvatarGroup names={["avatar" in member ? member.avatar : member.displayName]} />
              <Text style={familyMemberNameStyle}>{member.displayName}</Text>
              <StatusBadge label={member.role === "owner" ? "관리자" : member.role === "co_parent" ? "기록 가능" : member.role === "viewer" ? "보기 전용" : "선물 참여"} tone={member.role === "owner" ? "warning" : "neutral"} />
              {canManageMembers && "userId" in member && member.userId !== userId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${member.displayName} 삭제`}
                  disabled={removeMember.isPending}
                  onPress={() => confirmRemoveMember(member.id, member.displayName)}
                  hitSlop={8}
                  style={{ alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48 }}
                >
                  <Text style={familyMemberDeleteStyle}>삭제</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {canManageMembers && eligibleOwners.length > 0 ? (
          <Card style={{ gap: 12 }}>
            <Text style={familyProfileTitleStyle}>소유권 이전</Text>
            <Text style={familyProfileMetaStyle}>활성 기록 가능 구성원 한 명을 새 관리자로 선택하세요. 보기 전용과 선물 참여자는 선택할 수 없습니다.</Text>
            <View accessibilityLabel="새 가족 관리자 선택" accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {eligibleOwners.map((member) => "userId" in member ? (
                <Pressable
                  accessibilityLabel={`${member.displayName} 새 소유자로 선택`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedOwnerUserId === member.userId }}
                  key={member.id}
                  onPress={() => setSelectedOwnerUserId(member.userId)}
                  style={{
                    alignItems: "center",
                    borderColor: selectedOwnerUserId === member.userId ? theme.colors.mainCoral : theme.colors.gray300,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 10,
                    minHeight: 48,
                    paddingHorizontal: 12
                  }}
                >
                  <AppIcon color={selectedOwnerUserId === member.userId ? theme.colors.mainCoral : theme.colors.gray600} name={selectedOwnerUserId === member.userId ? "radiobox-marked" : "radiobox-blank"} size={22} />
                  <Text style={familyMemberNameStyle}>{member.displayName}</Text>
                  <Text style={familyProfileMetaStyle}>기록 가능</Text>
                </Pressable>
              ) : null)}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedOwnerUserId || transferOwner.isPending }}
              disabled={!selectedOwnerUserId || transferOwner.isPending}
              onPress={confirmOwnerTransfer}
              style={[familyInviteButtonStyle, { opacity: !selectedOwnerUserId || transferOwner.isPending ? 0.5 : 1 }]}
            >
              <Text style={familyInviteButtonTextStyle}>{transferOwner.isPending ? "이전 중..." : "선택한 구성원에게 소유권 이전"}</Text>
            </Pressable>
          </Card>
        ) : null}

        <Pressable onPress={openInvite} style={familyInviteButtonStyle}>
          <Text style={familyInviteButtonTextStyle}>가족 초대하기</Text>
        </Pressable>
        {hasSession ? (
          <Pressable accessibilityRole="button" disabled={leave.isPending} onPress={confirmLeave} style={{ alignItems: "center", justifyContent: "center", minHeight: 48 }}>
            <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: "800" }}>{leave.isPending ? "처리 중..." : "가족 나가기"}</Text>
          </Pressable>
        ) : null}
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
  borderRadius: 24,
  borderWidth: 1,
  height: 48,
  justifyContent: "center",
  width: 48,
  ...theme.shadows.card
} as const;

const familyPlusTextStyle = {
  color: theme.colors.gray900,
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
  alignItems: "center",
  width: 24
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

const familyInviteChevronStyle = {
  alignItems: "center",
  width: 24
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
