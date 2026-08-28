import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import {
  confirmAccountDeletion,
  confirmChildProfileDeletion,
  confirmHouseholdLeave,
  getPrivacySettings,
  listChildren,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  previewAccountDeletion,
  previewChildProfileDeletion,
  previewHouseholdLeave,
  type SettingsPreview
} from "../../src/api/client";
import { resetLocalBackend } from "../../src/api/local-backend";
import { CHILD_REMOVAL_INVALIDATE_KEYS, planAfterChildRemoval } from "../../src/children/child-deletion";
import {
  describeHouseholdScope,
  householdScopeLeaveNotice,
  householdScopePhrase,
  isChildrenSettled,
  resolveManagedHouseholdId
} from "../../src/family/household-scope";
import { buildConsentSummaryLines } from "../../src/settings/consent-summary";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  EmptyStateCard,
  ScreenHeader,
  SecondaryButton,
  StatusBadge
} from "../../src/ui";

const flowCopy = {
  child_profile_delete: {
    title: "아이 프로필 삭제",
    description: "이 아이의 지출 기록과 준비 목록이 함께 삭제돼요.",
    previewLabel: "삭제 전 확인하기",
    confirmLabel: "아이 프로필 삭제하기"
  },
  household_leave: {
    title: "가구 탈퇴",
    description: "가구에서 나가면 공유 데이터에 더 이상 접근할 수 없어요.",
    previewLabel: "탈퇴 전 확인하기",
    confirmLabel: "가구 탈퇴하기"
  },
  account_delete: {
    title: "계정 삭제",
    description: "계정과 모든 데이터가 영구적으로 삭제돼요.",
    previewLabel: "삭제 전 확인하기",
    confirmLabel: "계정 삭제하기"
  }
} as const;

/**
 * 라운드 45 UX-AA(후보 8ⓐ): 되돌릴 수 없는 결정 앞에서 사용자가 가장 자주 하는 질문("다시 가입하면
 * 되지 않나?")에 대한 사실 한 줄.
 *
 * 근거: 탈퇴는 users.status를 withdrawn으로 바꾸고(households/household-runtime.service.ts의
 * withdrawUser), 카카오 로그인은 그 상태를 USER_WITHDRAWN으로 거절한다(auth/kakao/
 * kakao-auth.service.ts). 그 행은 파기 작업(worker/jobs/data-retention-purge.job.ts,
 * DEFAULT_PURGE_RETENTION_DAYS = 30)이 물리 삭제하기 전까지 남아 있으므로 30일은 **하한**이다
 * -- 그래서 "30일 동안은 …할 수 없어요"까지만 말하고, 30일이 지나면 된다고는 약속하지 않는다.
 */
const ACCOUNT_DELETE_REJOIN_NOTICE = "삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.";

const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const actionFailedText = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

function DangerButton({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        dangerButtonStyle,
        disabled ? dangerButtonDisabledStyle : null,
        pressed && !disabled ? { opacity: 0.86 } : null
      ]}
    >
      <Text style={dangerButtonTextStyle}>{label}</Text>
    </Pressable>
  );
}

function PreviewSummary({ preview }: { preview?: SettingsPreview }) {
  if (!preview) return null;
  return (
    <View style={previewBoxStyle}>
      <Text style={previewTitleStyle}>진행하면 이렇게 돼요</Text>
      {preview.impact.map((line) => (
        <Text key={line} style={previewLineStyle}>
          · {line}
        </Text>
      ))}
      {preview.requiresSecondStep ? (
        <Text style={previewNoticeStyle}>한 번 더 확인한 다음에 진행할 수 있어요.</Text>
      ) : null}
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const clearSession = useSessionStore((state) => state.clearSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;

  /**
   * R19-C(F2): 아이가 사라지는 두 경로(아이 삭제 · 가구 탈퇴)의 공통 뒤처리.
   * 1) 선택 아이를 비우고, 2) 아이 스코프 캐시를 전부 무효화한 뒤, 3) 남은 아이가 있으면 그중
   *    첫째를 골라 홈으로, 없으면 예전처럼 온보딩으로 보낸다.
   * 예전에는 남은 아이가 있든 없든 무조건 온보딩으로 보내고(둘째를 지운 사용자까지 튕겼다)
   * ["children"]/["home"] 두 키만 지워서 지출·준비템·리포트 캐시가 삭제된 아이 데이터로 남았다.
   */
  const finishChildRemoval = async (doneMessage: string) => {
    clearChild();
    // 데모(local-backend) 세션은 "가구 탈퇴 후 아이 접근 상실"을 모사하지 않아 목록이 실제와
    // 다르다(FIX-118B(F3)와 같은 정직성 규칙) -- 알 수 없음으로 두고 기존 데모 동작을 유지한다.
    const remaining = isDemoSession
      ? null
      : await listChildren(authToken!)
          .then((response) => response.children)
          .catch(() => null);
    await Promise.all(
      CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );
    const plan = planAfterChildRemoval(remaining);
    if (plan.kind === "select") {
      setSelectedChildId(plan.childId);
      Alert.alert("완료됐어요", `${doneMessage}\n${plan.notice}`);
      announceForA11y(plan.notice);
      router.replace("/(tabs)");
      return;
    }
    Alert.alert("완료됐어요", doneMessage);
    router.replace("/onboarding/child-status");
  };

  const privacy = useQuery({
    queryKey: ["privacy-settings"],
    enabled: Boolean(authToken),
    queryFn: () => getPrivacySettings(authToken!)
  });

  /**
   * 라운드 60 A — **어느 가구를 나가는가.**
   *
   * 탈퇴 대상은 세션의 `defaultHouseholdId`였다. 그 값은 다른 가구 초대를 수락하는 순간 영구히
   * 바뀌므로, 수락한 사용자가 "가구 탈퇴"를 누르면 자기 본가구가 아니라 **방금 들어간 가구**를
   * 나가게 되고(또는 그 반대), 화면 어디에도 어느 가구인지 적혀 있지 않았다. 이제 대상은 보고
   * 있는 아이의 가구이고, 그 가구를 가리킬 수 있으면 아래 한 줄로 말한다. 아이 목록은 다른
   * 화면들과 같은 `["children"]` 캐시다(대개 이미 채워져 있다).
   */
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdId = resolveManagedHouseholdId({
    children: childrenQuery.data?.children,
    childId,
    fallbackHouseholdId,
    // 세션이 없으면 기다릴 조회 자체가 없다(쿼리가 disabled라 영원히 pending이다).
    childrenSettled: isChildrenSettled({ authToken, isSuccess: childrenQuery.isSuccess, isError: childrenQuery.isError })
  });
  /**
   * 되돌릴 수 없는 동작이 무엇을 대상으로 하는지 말하는 한 줄. 서버가 내려주는 영향 목록
   * (preview.impact)은 가구를 특정하지 않으므로 클라이언트 라벨로 보완한다 -- 서버 API는
   * 건드리지 않는다. 1가구 계정에서는 null이라 카드가 종전과 한 글자도 달라지지 않는다.
   */
  const householdLeaveNotice = householdScopeLeaveNotice(
    householdScopePhrase(
      describeHouseholdScope({
        householdId,
        children: childrenQuery.data?.children,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    )
  );

  const childPreview = useMutation({
    mutationFn: () => previewChildProfileDeletion(authToken!, childId!)
  });
  const childDelete = useMutation({
    mutationFn: () => confirmChildProfileDeletion(authToken!, childId!, childPreview.data?.confirmationText ?? ""),
    onSuccess: async () => {
      childPreview.reset();
      await finishChildRemoval("아이 프로필을 삭제했어요.");
    }
  });

  const householdPreview = useMutation({
    mutationFn: () => previewHouseholdLeave(authToken!, householdId!)
  });
  const householdLeave = useMutation({
    mutationFn: () => confirmHouseholdLeave(authToken!, householdId!, householdPreview.data?.confirmationText ?? ""),
    onSuccess: async () => {
      householdPreview.reset();
      // 탈퇴한 가구의 아이만 접근을 잃는다 -- 다른 가구에 아이가 남아 있으면 그쪽으로 이어간다.
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      await finishChildRemoval("가구에서 나갔어요.");
    }
  });

  const accountPreview = useMutation({
    mutationFn: () => previewAccountDeletion(authToken!)
  });
  const accountDelete = useMutation({
    mutationFn: () => confirmAccountDeletion(authToken!, accountPreview.data?.confirmationText ?? ""),
    onSuccess: () => {
      Alert.alert("완료됐어요", "계정을 삭제했어요.");
      if (isTestSession) {
        resetLocalBackend();
      }
      clearSession();
      clearChild();
      router.replace("/launch-animation");
    }
  });

  const confirmChildDelete = () => {
    if (!childPreview.data || childDelete.isPending) return;
    Alert.alert("정말 삭제할까요?", "이 작업은 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => childDelete.mutate() }
    ]);
  };

  const confirmHouseholdLeaveAction = () => {
    if (!householdPreview.data || householdLeave.isPending) return;
    Alert.alert("정말 나갈까요?", "이 작업은 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "나가기", style: "destructive", onPress: () => householdLeave.mutate() }
    ]);
  };

  const confirmAccountDelete = () => {
    if (!accountPreview.data || accountDelete.isPending) return;
    Alert.alert("정말 삭제할까요?", "이 작업은 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => accountDelete.mutate() }
    ]);
  };

  const flows = privacy.data?.flows ?? [];
  // 라운드 45 UX-AA(후보 3): 화면 부제는 "동의 내역과 삭제 · 탈퇴를 관리해요"인데 동의 내역이
  // 어디에도 없었다. 서버 GET /settings/privacy가 이미 함께 내려주는 값이라 **새 요청 없이**
  // 그린다. 응답에 없거나(구 서버) 불러오기에 실패하면 빈 배열 -> 카드를 아예 그리지 않는다.
  const consentLines = buildConsentSummaryLines(privacy.data?.consents);

  return (
    <AppScreen>
      <View testID="screen-SET-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="설정"
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onBack={() => router.back()}
        />

        {privacy.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {privacy.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
            <SecondaryButton label="다시 시도" onPress={() => privacy.refetch()} />
          </Card>
        ) : null}

        {consentLines.length > 0 ? (
          <Card style={{ gap: 8 }}>
            <Text style={cardTitleStyle}>동의 내역</Text>
            {consentLines.map((line) => (
              <View key={line.title} style={rowHeaderStyle}>
                <Text style={consentTitleStyle}>{line.title}</Text>
                <Text style={mutedTextStyle}>{line.statusText}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {!privacy.isLoading && !privacy.isError && flows.length === 0 ? (
          <EmptyStateCard title="표시할 항목이 없어요" actionLabel="새로고침" onPress={() => privacy.refetch()} />
        ) : null}
      </View>

      <View testID="screen-SET-004" style={{ gap: theme.spacing.gap }}>
        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.child_profile_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.child_profile_delete.description}</Text>
          <SecondaryButton
            label={childPreview.isPending ? "확인하는 중..." : flowCopy.child_profile_delete.previewLabel}
            disabled={!authToken || !childId || childPreview.isPending}
            onPress={() => childPreview.mutate()}
          />
          {childPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={childPreview.data} />
          {childPreview.data ? (
            <DangerButton
              label={childDelete.isPending ? "삭제하는 중..." : flowCopy.child_profile_delete.confirmLabel}
              disabled={childDelete.isPending}
              onPress={confirmChildDelete}
            />
          ) : null}
          {childDelete.isError ? <Text style={{ color: theme.colors.danger }}>{actionFailedText}</Text> : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.household_leave.title}</Text>
            <StatusBadge label="주의" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.household_leave.description}</Text>
          {/* 라운드 60 A: 다가구 계정에서만 나타나는 대상 표기(어느 가구를 나가는지). */}
          {householdLeaveNotice ? <Text style={mutedTextStyle}>{householdLeaveNotice}</Text> : null}
          <SecondaryButton
            label={householdPreview.isPending ? "확인하는 중..." : flowCopy.household_leave.previewLabel}
            disabled={!authToken || !householdId || householdPreview.isPending}
            onPress={() => householdPreview.mutate()}
          />
          {householdPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={householdPreview.data} />
          {householdPreview.data ? (
            <DangerButton
              label={householdLeave.isPending ? "나가는 중..." : flowCopy.household_leave.confirmLabel}
              disabled={householdLeave.isPending}
              onPress={confirmHouseholdLeaveAction}
            />
          ) : null}
          {householdLeave.isError ? <Text style={{ color: theme.colors.danger }}>{actionFailedText}</Text> : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.account_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.account_delete.description}</Text>
          <Text style={mutedTextStyle}>{ACCOUNT_DELETE_REJOIN_NOTICE}</Text>
          <SecondaryButton
            label={accountPreview.isPending ? "확인하는 중..." : flowCopy.account_delete.previewLabel}
            disabled={!authToken || accountPreview.isPending}
            onPress={() => accountPreview.mutate()}
          />
          {accountPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={accountPreview.data} />
          {accountPreview.data ? (
            <DangerButton
              label={accountDelete.isPending ? "삭제하는 중..." : flowCopy.account_delete.confirmLabel}
              disabled={accountDelete.isPending}
              onPress={confirmAccountDelete}
            />
          ) : null}
          {accountDelete.isError ? <Text style={{ color: theme.colors.danger }}>{actionFailedText}</Text> : null}
        </Card>
      </View>
    </AppScreen>
  );
}

const rowHeaderStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 8,
  justifyContent: "space-between"
} as const;

// 카드 제목(동의 내역 · 삭제/탈퇴 세 카드가 공유). 예전 이름은 dangerTitleStyle이었는데,
// 위험 카드 전용이 아니게 되어(동의 내역 카드도 같은 제목 크기) 이름만 사실에 맞췄다 -- 값은 그대로다.
const cardTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "800"
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 20
} as const;

// 동의 항목 이름: 오른쪽 상태 문구(mutedTextStyle)와 같은 크기로 두되, 이름 쪽이 앞선다.
const consentTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 13,
  fontWeight: "700",
  lineHeight: 20
} as const;

const previewBoxStyle = {
  backgroundColor: theme.colors.peach,
  borderRadius: theme.radii.small,
  gap: 4,
  padding: 12
} as const;

const previewTitleStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "800"
} as const;

const previewLineStyle = {
  color: theme.colors.brown,
  fontSize: 12,
  lineHeight: 18
} as const;

// FIX-118B(F4): same A11Y-117 small-coral-text rule as app/settings/children.tsx's 편집 link --
// coral[500] at 12px is 3.16:1 on cream, coral[700] clears the 4.5:1 bar.
const previewNoticeStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700",
  marginTop: 4
} as const;

const pendingNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontStyle: "italic"
} as const;

const dangerButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.danger,
  borderRadius: theme.radii.button,
  height: theme.ctaHeight,
  justifyContent: "center"
} as const;

const dangerButtonDisabledStyle = {
  backgroundColor: theme.colors.gray300
} as const;

const dangerButtonTextStyle = {
  color: theme.colors.white,
  fontSize: 15,
  fontWeight: "700"
} as const;
