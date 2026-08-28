import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import {
  cancelHouseholdInvite,
  listChildren,
  listHouseholdInvites,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  LOCAL_USER_ID,
  removeHouseholdMember
} from "../../src/api/client";
import {
  collectKnownHouseholdIds,
  describeHouseholdScope,
  HOUSEHOLD_SCOPE_SWITCH_LABEL,
  householdScopeManageNotice,
  householdScopePhrase,
  isChildrenSettled,
  listHouseholdSwitchOptions,
  resolveManagedHouseholdId
} from "../../src/family/household-scope";
import {
  INVITE_ROLE_PROMPT_CANCEL_LABEL,
  inviteRolePrompt,
  inviteScreenHref
} from "../../src/family/invite-flow";
import { INVITE_OWNER_ONLY_CAPTION, isInviteEntryPointLocked } from "../../src/family/invite-permissions";
import {
  memberMutationAlertTitle,
  memberMutationErrorMessage,
  type FamilyMemberMutationKind
} from "../../src/family/member-mutation-messages";
import { formatInviteExpiry, memberBadge, memberRoleLabel } from "../../src/family/memberLabels";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
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
// PIX-133: 보정 변환은 FAM-001 캡처 빌드 전용(기본값은 항등이지만 튜닝 값 유출을 구조적으로 차단).
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function familyReferenceFrameStyle() {
  if (!isPixelLockCalibration) return { gap: 16 } as const;
  return {
    gap: 16,
    transform: [
      { translateX: FamilyPixelStyles.horizontalOffset },
      { translateY: FamilyPixelStyles.topOffset },
      { scale: FamilyPixelStyles.scale }
    ]
  } as const;
}
/**
 * D1 후속(실기기 피드백 2): 행 아이콘을 텍스트 글리프(↗ □)에서 탭바와 같은 Ionicons
 * outlined 계열로 바꿨다 -- 글리프는 기기 폰트에 따라 굵기·크기가 제각각이라 "예전 아이콘"
 * 처럼 보였다. 문구·행 구성·순서는 그대로다.
 */
const familyInviteRows = [
  { icon: "link-outline", title: "링크로 초대", value: "" },
  { icon: "copy-outline", title: "초대 코드 공유", value: "DAON2025" }
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
  icon: keyof typeof Ionicons.glyphMap;
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
      <Ionicons name={icon} size={familyInviteIconStyle.fontSize} color={familyInviteIconStyle.color} style={{ width: familyInviteIconStyle.width }} />
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
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  /**
   * 라운드 60 A — 이 화면이 관리하는 가구는 **보고 있는 아이의 가구**다.
   *
   * 종전에는 세션의 `defaultHouseholdId` 하나였다. 그 값은 다른 가구 초대를 수락하는 순간
   * 영구히 바뀌므로(app/family/accept/[token].tsx), 수락한 사용자는 원래 가구의 구성원 관리·
   * 초대·대기 초대 취소에 **앱 안에서 도달할 방법이 없었다** -- 아이를 전환해도 이 화면만
   * 다른 가구를 보고 있었다. 아이 목록은 아이 관리·설정·기록 탭과 같은 `["children"]` 캐시라
   * 대개 이미 채워져 있어 새 요청이 나가지 않는다.
   */
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const scopedHouseholdId = resolveManagedHouseholdId({
    children: childrenQuery.data?.children,
    childId: selectedChildId,
    fallbackHouseholdId,
    childrenSettled: isChildrenSettled({
      authToken,
      isSuccess: childrenQuery.isSuccess,
      isError: childrenQuery.isError
    })
  });
  /**
   * 라운드 60 리뷰(P1-3) — 이 화면에서만 유효한 **가구 보기 전환**.
   *
   * 왜 필요한가: 위 판정은 "보고 있는 아이의 가구"라 **아이가 하나도 없는 가구를 영영 가리킬 수
   * 없다**. 초대를 수락해 새로 들어간 가구가 대개 그렇고(아이는 관리자가 나중에 등록한다),
   * 그 가구의 구성원 관리·초대·대기 초대 취소는 이 화면 말고는 어디에도 없다.
   *
   * 왜 세션 상태가 아니라 화면 지역 상태인가: 이 전환은 **보는 대상**을 바꾸는 것이지 계정의
   * 기본값을 바꾸는 것이 아니다. `defaultHouseholdId`를 다시 갈아 끼우면 초대 수락이 저지른
   * 그 소실(P1-3)을 이번엔 사용자 손으로 되풀이하게 된다. 화면을 벗어나면 판정은 다시 아이
   * 기준으로 돌아간다 -- 되돌리는 데 아무 조작도 필요 없는 것이 이 형태의 이점이다.
   */
  const [viewedHouseholdId, setViewedHouseholdId] = useState<string | null>(null);
  /**
   * 전환은 **아는 가구**로만 간다. 목록에서 사라진 가구(탈퇴·초대 취소 뒤 갱신)를 계속 붙들고
   * 있으면 그 가구의 구성원 조회가 403/404로만 답하므로, 검증에 실패하면 조용히 아이 기준
   * 판정으로 되돌아간다(상태를 지우는 effect 없이 매 렌더에서 다시 검증한다).
   */
  const knownHouseholdIdList = collectKnownHouseholdIds({
    children: childrenQuery.data?.children,
    knownHouseholdIds,
    fallbackHouseholdId
  });
  const householdId =
    viewedHouseholdId && knownHouseholdIdList.includes(viewedHouseholdId) ? viewedHouseholdId : scopedHouseholdId;
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
  // 라운드 52 C-05: 두 파괴적 동작(구성원 삭제·초대 취소)의 실패를 반드시 말한다. 실패한 그
  // 순간에 연결을 한 번 확인해(오프라인이면 "잠시 후 다시"가 거짓말이 된다) 문구를 고른다 —
  // 판정·문구는 src/family/member-mutation-messages.ts 한 곳에 있다.
  const alertMutationFailure = (kind: FamilyMemberMutationKind, error: unknown) => {
    void isCurrentlyOnline().then((isOnline) => {
      Alert.alert(memberMutationAlertTitle(kind), memberMutationErrorMessage(kind, error, { isOnline }));
    });
  };
  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeHouseholdMember(authToken!, householdId!, memberId),
    onError: (error) => alertMutationFailure("remove_member", error),
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
    onError: (error) => alertMutationFailure("cancel_invite", error),
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

  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 -- 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(members.isError);

  /**
   * 라운드 60 A: 어느 가구인지 아직 정해지지 않은 창(= `["children"]` 조회 진행 중).
   *
   * 이때 기본 가구로 메우면 다가구 계정에서 **다른 가구의 구성원 목록과 삭제 버튼**이 잠깐
   * 그려진다. 반대로 그냥 두면 로그인한 사용자에게 비로그인 미리보기 픽스처("다온이 패밀리")가
   * 보인다 -- 둘 다 허위 표시라, 아래 스켈레톤으로 덮는다. 조회가 끝나면 householdScope가
   * 아이의 가구(또는 기본 가구)로 확정되므로 이 창은 캐시가 따뜻하면 아예 생기지 않는다.
   */
  const householdScopePending = Boolean(authToken) && !householdId && childrenQuery.isPending;
  // 다가구 계정에서만 붙는 한 줄 -- 1가구 계정과 비로그인 미리보기(FAM-001 픽셀락)에서는 null이라
  // 화면이 종전과 한 노드도 달라지지 않는다.
  const householdNotice = householdScopeManageNotice(
    householdScopePhrase(
      describeHouseholdScope({
        householdId,
        children: childrenQuery.data?.children,
        members: members.data?.members,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    )
  );
  /**
   * 라운드 60 리뷰(P1-3): 전환 후보. 1가구(또는 몇인지 모르는) 계정에서는 빈 배열이라 아래
   * 행 자체가 그려지지 않는다 -- FAM-001 픽셀락 캡처(비로그인)도 종전 그대로다.
   */
  const householdSwitchOptions = hasSession
    ? listHouseholdSwitchOptions({
        currentHouseholdId: householdId,
        children: childrenQuery.data?.children,
        members: members.data?.members,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    : [];

  if (hasSession && membersPhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title={loadErrorCopy.title}
          actionLabel={loadErrorCopy.actionLabel}
          onPress={() => members.refetch()}
        />
      </AppScreen>
    );
  }

  if (householdScopePending || (hasSession && membersPhase === "loading")) {
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
  /**
   * 라운드 52 C-04/C-06: 여기서는 **초대를 만들지 않는다.**
   *
   * 종전에는 역할을 고르는 즉시 서버에 초대를 만들고 응답(inviteUrl)을 버린 채 빈 초대 폼으로
   * 이동했다. 토큰은 서버에 해시로만 남아 그 링크는 두 번 다시 볼 수 없으므로, 첫 초대는
   * 만들어지는 순간 유실되고 "대기 중인 초대"에는 정체를 알 수 없는 행만 남았다. 고른 역할도
   * 전달되지 않아 초대 화면은 늘 공동부모로 서 있었다(= 고른 것과 다른 역할이 하나 더 만들어짐).
   *
   * 이제 이 화면은 **역할만 정해 초대 화면으로 넘긴다.** 링크 생성은 결과를 그 자리에서 보여
   * 주고 공유·복사까지 내주는 초대 화면 한 곳에서만 일어난다(src/family/invite-flow.ts).
   * 선택지도 그 화면과 같은 표를 읽어 세 역할이 모두 나온다(선물 참여 포함).
   */
  const openInvite = () => {
    if (!(authToken && householdId)) {
      router.push("/family/invite");
      return;
    }
    // Android Alert은 버튼을 3개까지만 그린다 -- 취소를 함께 넣으면 역할 하나가 조용히 잘린다.
    // 무엇을 남길지는 invite-flow.ts가 정한다(역할 셋은 언제나 남고, 닫는 길도 남는다).
    const prompt = inviteRolePrompt(Platform.OS);
    Alert.alert(
      prompt.title,
      prompt.message,
      [
        ...(prompt.showsCancelButton
          ? [{ text: INVITE_ROLE_PROMPT_CANCEL_LABEL, style: "cancel" as const }]
          : []),
        ...prompt.roles.map((choice) => ({
          text: choice.label,
          onPress: () => router.push(inviteScreenHref(choice.role))
        }))
      ],
      { cancelable: prompt.cancelable }
    );
  };
  /**
   * 라운드 60 리뷰(P1-3): 가구 전환 입구. 후보가 둘 이상일 때만 그려지므로 1가구 계정에서는
   * 이 버튼이 존재하지 않는다. Alert 하나로 끝내는 최소 형태다 -- 전용 시트를 새로 만들 만큼의
   * 화면이 아니고, 이 앱은 이미 초대 역할 선택에 같은 형태를 쓴다(invite-flow.ts).
   *
   * 라벨은 순수 모듈이 정한다: 이름을 알면 이름, 모르면 그 가구의 아이들, 둘 다 모르면 사실
   * ("아이가 아직 없는 가구"). 지금 보고 있는 가구는 목록에서 표시만 하고 고를 수 없게 둔다.
   */
  const openHouseholdSwitch = () => {
    Alert.alert(
      HOUSEHOLD_SCOPE_SWITCH_LABEL,
      "관리할 가구를 골라 주세요. 이 화면에서만 바뀌고 아이 선택은 그대로예요.",
      [
        { text: "닫기", style: "cancel" as const },
        ...householdSwitchOptions.map((option) => ({
          text: option.isCurrent ? `${option.label} (보는 중)` : option.label,
          onPress: option.isCurrent ? undefined : () => setViewedHouseholdId(option.householdId)
        }))
      ]
    );
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

        {/* 라운드 60 A: 다가구 계정에서만 나타나는 부제 -- 어느 가구를 관리하는 중인지 말한다. */}
        {householdNotice ? <Text style={familyScopeNoticeStyle}>{householdNotice}</Text> : null}

        {/* 라운드 60 리뷰(P1-3): 아이가 없는 가구까지 포함한 전환 입구. 후보가 둘 이상일 때만
            그려지므로 1가구 계정·비로그인 미리보기(FAM-001 픽셀락)에는 아무것도 늘지 않는다. */}
        {householdSwitchOptions.length >= 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={HOUSEHOLD_SCOPE_SWITCH_LABEL}
            hitSlop={8}
            onPress={openHouseholdSwitch}
          >
            <Text style={familyHouseholdSwitchStyle}>{HOUSEHOLD_SCOPE_SWITCH_LABEL}</Text>
          </Pressable>
        ) : null}

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

        {/*
          DSN-053 P2-D: 승인 캡처(FAM-001)의 가족 화면에는 "멤버 관리" 목록 **하나**가 있다.
          대기 중인 초대를 그 아래 별도 구획으로 두면 같은 사람이 목록 둘에 나뉘어 서고("보낸
          초대"와 "가족"이 다른 것처럼 읽힌다), 화면도 구획 넷으로 길어진다. 그래서 대기 초대를
          같은 목록 안의 **pending 행**으로 흡수한다 -- 행 문법(radius 16 · 아바타 · 이름 ·
          상태 pill · 파괴적 액션)이 이미 같고, 서버 상태가 pending인 멤버 행과도 한 벌이 된다.
          소유자 전용·세션 전용 게이트(canManageMembers)와 취소 확인·조용한 실패 안내는 그대로다.
        */}
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
          {/*
            FAM-121B: 대기 중인 초대. Owner-only and session-only, so the non-session
            FAM-001 pixel-lock capture renders nothing extra here -- 흡수 후에도 같다.
            빈 목록에는 "대기 중인 초대가 없어요." 한 줄을 남긴다 — 이 줄이 없으면 초대를
            보낸 owner가 "0건"과 "아직 안 불러옴"을 구분할 방법이 화면에 없다(적대적 리뷰).
          */}
          {canManageMembers ? (
            pendingInvites.isLoading ? (
              <SkeletonRow />
            ) : pendingInvites.data && pendingInvites.data.invites.length === 0 ? (
              <Text style={familyPendingInviteMetaStyle}>대기 중인 초대가 없어요.</Text>
            ) : pendingInvites.isError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="대기 중인 초대 다시 불러오기"
                onPress={() => pendingInvites.refetch()}
              >
                <Text style={familyInviteErrorStyle}>대기 중인 초대를 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
              </Pressable>
            ) : (
              (pendingInvites.data?.invites ?? []).map((invite) => {
                const roleLabel = memberRoleLabel(invite.role);
                return (
                  <View key={invite.id} style={familyPendingInviteRowStyle}>
                    <FamilyAvatarGroup names={[roleLabel]} />
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
              })
            )
          ) : null}
        </View>

        {/*
          Honesty note, not a placeholder: invite tokens are stored hashed on the
          server, so a link can never be shown again after the create screen. The
          only real recovery is cancel + create a new invite, and we say exactly that.
        */}
        {canManageMembers && (pendingInvites.data?.invites.length ?? 0) > 0 ? (
          <Text style={familyInviteHintStyle}>보낸 링크는 보안을 위해 다시 볼 수 없어요. 링크를 잃어버렸다면 취소하고 새로 만들어 주세요.</Text>
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

// 라운드 60 A: 제목 아래 가구 부제. 새 토큰을 만들지 않고 이 화면이 이미 쓰는 보조 문장 레시피
// (familyInviteHintStyle과 같은 gray600 12/18)를 그대로 쓴다.
const familyScopeNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18,
  marginTop: -8
} as const;

// 라운드 60 리뷰(P1-3): 전환 입구의 문자 링크. 새 토큰을 만들지 않고 이 화면이 이미 쓰는
// 강조 보조 텍스트(A11Y-117 대비 규칙에 맞는 coral[700] 12/18)를 그대로 쓴다.
const familyHouseholdSwitchStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700",
  lineHeight: 18
} as const;

const familyAvatarRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

// DSN-053 P2-D: 승인 캡처(FAM-001)의 `+`는 48dp 원이다(theme.touchTarget과 같은 값) --
// 종전 44는 아바타 스택(36)과의 대비도, 앱 전역의 터치 타깃 기준도 어긋나 있었다.
const familyPlusButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.10)",
  borderRadius: theme.touchTarget / 2,
  borderWidth: 1,
  height: theme.touchTarget,
  justifyContent: "center",
  width: theme.touchTarget,
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
