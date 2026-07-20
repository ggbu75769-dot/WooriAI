import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import {
  cancelAccountDeletion,
  confirmAccountDeletion,
  confirmChildProfileDeletion,
  confirmHouseholdLeave,
  getCurrentAccountDeletion,
  getPrivacySettings,
  LOCAL_HOUSEHOLD_ID,
  fixtureSessionToken,
  previewAccountDeletion,
  previewChildProfileDeletion,
  previewHouseholdLeave,
  type SettingsPreview
} from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, ScreenHeader, SecondaryButton, StatusBadge } from "../../src/design-system";
import { theme } from "../../src/theme";

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
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  const queryClient = useQueryClient();

  const privacy = useQuery({
    queryKey: ["privacy-settings"],
    enabled: Boolean(authToken),
    queryFn: () => getPrivacySettings(authToken!)
  });
  const currentDeletion = useQuery({
    queryKey: ["account-deletion-current"],
    enabled: Boolean(authToken),
    queryFn: () => getCurrentAccountDeletion(authToken!)
  });

  const childPreview = useMutation({
    mutationFn: () => previewChildProfileDeletion(authToken!, childId!)
  });
  const childDelete = useMutation({
    mutationFn: () => confirmChildProfileDeletion(authToken!, childId!, childPreview.data?.confirmationText ?? ""),
    onSuccess: async () => {
      clearChild();
      childPreview.reset();
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      Alert.alert("완료됐어요", "아이 프로필을 삭제했어요.");
      router.replace("/onboarding/child-status");
    }
  });

  const householdPreview = useMutation({
    mutationFn: () => previewHouseholdLeave(authToken!, householdId!)
  });
  const householdLeave = useMutation({
    mutationFn: () => confirmHouseholdLeave(authToken!, householdId!, householdPreview.data?.confirmationText ?? ""),
    onSuccess: async () => {
      householdPreview.reset();
      clearChild();
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      Alert.alert("완료됐어요", "가구에서 나갔어요.");
      router.replace("/onboarding/child-status");
    }
  });

  const accountPreview = useMutation({
    mutationFn: () => previewAccountDeletion(authToken!)
  });
  const accountDelete = useMutation({
    mutationFn: () => confirmAccountDeletion(authToken!, accountPreview.data?.confirmationText ?? ""),
    onSuccess: (response) => {
      queryClient.setQueryData(["account-deletion-current"], { deletion: response.deletion ?? null });
      Alert.alert("삭제 요청을 접수했어요", "7일 유예 기간 동안 계정과 데이터가 유지됩니다. 이 화면에서 요청을 취소할 수 있어요.");
    }
  });
  const accountCancel = useMutation({
    mutationFn: (requestId: string) => cancelAccountDeletion(authToken!, requestId),
    onSuccess: () => {
      queryClient.setQueryData(["account-deletion-current"], { deletion: null });
      accountDelete.reset();
      accountPreview.reset();
      Alert.alert("삭제 요청을 취소했어요", "계정과 데이터는 그대로 유지됩니다.");
    }
  });

  const activeDeletion = accountDelete.data?.deletion?.state === "requested"
    ? accountDelete.data.deletion
    : currentDeletion.data?.deletion?.state === "requested"
      ? currentDeletion.data.deletion
      : null;

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
    Alert.alert("회원 탈퇴를 요청할까요?", "7일 동안 취소할 수 있고, 유예 기간이 지나면 로그인 접근이 중단되고 데이터 삭제가 시작돼요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => accountDelete.mutate() }
    ]);
  };

  const flows = privacy.data?.flows ?? [];

  return (
    <AppScreen>
      <View testID="screen-SET-003" accessibilityLabel="screen-SET-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" title="약관 및 개인정보" subtitle="동의 내역과 삭제 · 탈퇴를 관리해요" />

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

        {!privacy.isLoading && !privacy.isError && flows.length === 0 ? (
          <EmptyStateCard title="표시할 항목이 없어요" actionLabel="새로고침" onPress={() => privacy.refetch()} />
        ) : null}
      </View>

      <View testID="screen-SET-004" accessibilityLabel="screen-SET-004" style={{ gap: theme.spacing.gap }}>
        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={dangerTitleStyle}>{flowCopy.child_profile_delete.title}</Text>
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
            <Text style={dangerTitleStyle}>{flowCopy.household_leave.title}</Text>
            <StatusBadge label="주의" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.household_leave.description}</Text>
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
            <Text style={dangerTitleStyle}>{flowCopy.account_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>탈퇴 요청 후 7일 동안 계정과 데이터가 유지되며, 유예 기간 안에는 언제든 요청을 취소할 수 있어요.</Text>
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
          {activeDeletion ? (
            <View style={previewBoxStyle}>
              <Text style={previewTitleStyle}>삭제 유예 중</Text>
              <Text style={previewLineStyle}>요청 시각: {new Date(activeDeletion.requestedAt).toLocaleString("ko-KR")}</Text>
              <Text style={previewLineStyle}>삭제 시작 예정: {activeDeletion.dueAt ? new Date(activeDeletion.dueAt).toLocaleString("ko-KR") : "확인 중"}</Text>
              <Text style={previewNoticeStyle}>예정 시각 전까지 로그인과 데이터 이용이 유지돼요.</Text>
              <SecondaryButton disabled={accountCancel.isPending} label={accountCancel.isPending ? "취소 처리 중..." : "회원 탈퇴 요청 취소"} onPress={() => accountCancel.mutate(activeDeletion.id)} />
              {accountCancel.isError ? <Text style={{ color: theme.colors.danger }}>{actionFailedText}</Text> : null}
            </View>
          ) : null}
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

const dangerTitleStyle = {
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

const previewNoticeStyle = {
  color: theme.colors.mainCoral,
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
