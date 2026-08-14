import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { Alert, Pressable, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import {
  ApiClientError,
  cancelAccountDeletion,
  confirmAccountDeletion,
  confirmChildProfileDeletion,
  confirmHouseholdLeave,
  getCurrentAccountDeletion,
  getPrivacyExportPayload,
  getPrivacyRequest,
  getPrivacySettings,
  isApiErrorCode,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID,
  fixtureSessionToken,
  previewAccountDeletion,
  previewChildProfileDeletion,
  previewHouseholdLeave,
  retryAccountDeletion,
  requestDataExport,
  type AccountDeletionRequest,
  type PrivacyExportRequest,
  type SettingsPreview
} from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { accountDeletionPresentation } from "../../src/privacy/account-deletion-presentation";
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
  const sessionUserId = useSessionStore((state) => state.userId);
  const userId = sessionUserId ?? (isTestSession ? LOCAL_USER_ID : null);
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
  const householdMembers = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const myHouseholdRole = householdMembers.data?.members.find((member) => member.userId === userId)?.role ?? null;
  const isHouseholdOwner = myHouseholdRole === "owner";
  const canLeaveHousehold = Boolean(myHouseholdRole && !isHouseholdOwner);

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
    },
    onError: (error) => {
      if (isApiErrorCode(error, "OWNER_TRANSFER_REQUIRED")) {
        householdPreview.reset();
        Alert.alert(
          "먼저 가족 소유권을 이전해 주세요",
          "가족 소유자는 바로 나갈 수 없어요. 가족 관리에서 기록 가능 구성원에게 소유권을 이전한 뒤 다시 시도해 주세요.",
          [
            { text: "확인", style: "cancel" },
            { text: "가족 관리 열기", onPress: () => router.push("/family") }
          ]
        );
      }
    }
  });

  const accountPreview = useMutation({
    mutationFn: () => previewAccountDeletion(authToken!)
  });
  const accountDelete = useMutation({
    mutationFn: () => confirmAccountDeletion(authToken!, accountPreview.data?.confirmationText ?? ""),
    onSuccess: (response) => {
      queryClient.setQueryData(["account-deletion-current"], { deletion: response.deletion ?? null });
      if (response.deletion?.state === "failed" && response.deletion.failureCode === "OWNER_TRANSFER_REQUIRED") {
        Alert.alert(
          "먼저 가족 소유권을 이전해 주세요",
          "삭제는 시작되지 않았고 계정 접근도 그대로 유지돼요. 해당 가족의 새 관리자를 정한 뒤 다시 시도해 주세요."
        );
        return;
      }
      Alert.alert("삭제 요청을 접수했어요", "7일 유예 기간 동안 계정과 데이터가 유지됩니다. 이 화면에서 요청을 취소할 수 있어요.");
    },
    onError: (error) => {
      if (!isApiErrorCode(error, "OWNER_TRANSFER_REQUIRED")) return;
      const blockingHouseholdId = error instanceof ApiClientError && typeof error.details?.householdId === "string"
        ? error.details.householdId
        : null;
      Alert.alert(
        "먼저 가족 소유권을 이전해 주세요",
        "계정 접근은 그대로 유지돼요. 해당 가족의 새 관리자를 정한 뒤 다시 시도해 주세요.",
        [
          { text: "나중에", style: "cancel" },
          ...(blockingHouseholdId
            ? [{ text: "가족 관리 열기", onPress: () => router.push({ pathname: "/family", params: { householdId: blockingHouseholdId } }) }]
            : [])
        ]
      );
    }
  });
  const accountRetry = useMutation({
    mutationFn: (requestId: string) => retryAccountDeletion(authToken!, requestId),
    onSuccess: (deletion) => {
      queryClient.setQueryData(["account-deletion-current"], { deletion });
      accountDelete.reset();
      Alert.alert("다시 요청했어요", "가족 상태를 다시 확인했고 삭제 절차를 재개했어요.");
    },
    onError: (error) => {
      if (isApiErrorCode(error, "OWNER_TRANSFER_REQUIRED")) {
        Alert.alert("아직 소유권 이전이 필요해요", "해당 가족의 새 관리자를 정한 뒤 다시 시도해 주세요.");
        return;
      }
      Alert.alert("다시 시도하지 못했어요", actionFailedText);
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

  const exportRequest = useMutation({
    mutationFn: () => requestDataExport(authToken!),
    onSuccess: (request) => {
      queryClient.setQueryData(["privacy-export", request.id], request);
    },
    onError: () => Alert.alert("내보내기를 요청하지 못했어요", actionFailedText)
  });
  const activeExport = useQuery({
    queryKey: ["privacy-export", exportRequest.data?.id],
    enabled: Boolean(authToken && exportRequest.data?.id),
    initialData: exportRequest.data,
    queryFn: () => getPrivacyRequest(authToken!, exportRequest.data!.id),
    refetchInterval: (query) => {
      const state = (query.state.data as PrivacyExportRequest | undefined)?.state;
      return state === "requested" || state === "processor_delete_queued" || state === "purging" ? 2_000 : false;
    }
  });
  const exportDownload = useMutation({
    mutationFn: async (requestId: string) => {
      const payload = await getPrivacyExportPayload(authToken!, requestId);
      if (!FileSystem.cacheDirectory) throw new Error("EXPORT_DIRECTORY_UNAVAILABLE");
      const fileUri = `${FileSystem.cacheDirectory}wooriai-data-export-${requestId}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: "우리AI 내 데이터 저장",
          mimeType: "application/json",
          UTI: "public.json"
        });
      }
      return fileUri;
    },
    onSuccess: () => Alert.alert("내보내기 파일을 만들었어요", "공유 화면에서 파일을 저장하거나 안전한 곳으로 보낼 수 있어요."),
    onError: () => Alert.alert("파일을 만들지 못했어요", actionFailedText)
  });

  const isVisibleDeletion = (deletion: AccountDeletionRequest | undefined | null): deletion is AccountDeletionRequest =>
    deletion?.state === "requested" ||
    (deletion?.state === "failed" && deletion.failureCode === "OWNER_TRANSFER_REQUIRED");
  const mutationDeletion = accountDelete.data?.deletion;
  const fetchedDeletion = currentDeletion.data?.deletion;
  const activeDeletion = isVisibleDeletion(mutationDeletion)
    ? mutationDeletion
    : isVisibleDeletion(fetchedDeletion)
      ? fetchedDeletion
      : null;
  const blockingHouseholdId = activeDeletion?.state === "failed"
    ? activeDeletion.details?.householdId ?? null
    : null;
  const deletionPresentation = activeDeletion ? accountDeletionPresentation(activeDeletion) : null;

  const confirmChildDelete = () => {
    if (!childPreview.data || childDelete.isPending) return;
    Alert.alert("정말 삭제할까요?", "이 작업은 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => childDelete.mutate() }
    ]);
  };

  const confirmHouseholdLeaveAction = () => {
    if (!canLeaveHousehold || !householdPreview.data || householdLeave.isPending) return;
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
  const exportState = activeExport.data?.state ?? exportRequest.data?.state ?? null;
  const exportReady = exportState === "completed";

  return (
    <AppScreen>
      <View testID="screen-SET-003" accessibilityLabel="screen-SET-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" onBack={() => router.back()} title="약관 및 개인정보" subtitle="동의 내역과 삭제 · 탈퇴를 관리해요" />

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

        {privacy.data ? (
          <View accessibilityLabel="필수 약관 동의 내역">
            <Card style={{ gap: 12 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "800" }}>필수 약관 동의 내역</Text>
              {privacy.data.consents.map((consent) => (
                <View key={`${consent.type}:${consent.version}`} style={{ borderTopColor: theme.colors.gray300, borderTopWidth: 1, gap: 4, paddingTop: 10 }}>
                  <View style={rowHeaderStyle}>
                    <Text style={{ color: theme.colors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>{consent.title}</Text>
                    <StatusBadge label={consent.accepted ? "동의함" : "재확인 필요"} tone={consent.accepted ? "success" : "warning"} />
                  </View>
                  <Text style={mutedTextStyle}>버전 {consent.version}</Text>
                  {consent.acceptedAt ? <Text style={mutedTextStyle}>동의 시각 {new Date(consent.acceptedAt).toLocaleString("ko-KR")}</Text> : null}
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {!privacy.isLoading && !privacy.isError && flows.length === 0 ? (
          <EmptyStateCard title="표시할 항목이 없어요" actionLabel="새로고침" onPress={() => privacy.refetch()} />
        ) : null}
      </View>

      <View testID="screen-SET-004" accessibilityLabel="screen-SET-004" style={{ gap: theme.spacing.gap }}>
        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={{ color: theme.colors.textPrimary, flex: 1, fontSize: 15, fontWeight: "800" }}>내 데이터 내보내기</Text>
            <StatusBadge label={exportReady ? "준비 완료" : exportState ? "준비 중" : "요청 가능"} tone={exportReady ? "success" : exportState ? "warning" : "neutral"} />
          </View>
          <Text style={mutedTextStyle}>내 계정 정보와 직접 작성한 지출·예산·동의 기록을 JSON 파일로 받아볼 수 있어요. 다른 가족의 개인정보와 인증 비밀값은 포함하지 않아요.</Text>
          {!exportState ? (
            <SecondaryButton
              label={exportRequest.isPending ? "내보내기 요청 중..." : "내 데이터 준비하기"}
              disabled={!authToken || exportRequest.isPending}
              onPress={() => exportRequest.mutate()}
            />
          ) : null}
          {exportState && !exportReady && exportState !== "failed" ? (
            <Text accessibilityLiveRegion="polite" style={pendingNoticeStyle}>파일을 안전하게 준비하고 있어요. 이 화면에서 완료 여부를 자동으로 확인할게요.</Text>
          ) : null}
          {exportReady ? (
            <>
              <Text accessibilityLiveRegion="polite" style={previewNoticeStyle}>
                {activeExport.data?.exportExpiresAt ? `${new Date(activeExport.data.exportExpiresAt).toLocaleString("ko-KR")}까지 받을 수 있어요.` : "파일을 받을 수 있어요."}
              </Text>
              <SecondaryButton
                label={exportDownload.isPending ? "파일 만드는 중..." : "JSON 파일 저장·공유"}
                disabled={exportDownload.isPending}
                onPress={() => exportDownload.mutate(activeExport.data!.id)}
              />
            </>
          ) : null}
          {exportState === "failed" || activeExport.isError ? (
            <>
              <Text accessibilityLiveRegion="assertive" style={{ color: theme.colors.danger }}>{actionFailedText}</Text>
              <SecondaryButton label="새로 요청하기" disabled={exportRequest.isPending} onPress={() => exportRequest.mutate()} />
            </>
          ) : null}
        </Card>

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
          {isHouseholdOwner ? (
            <>
              <Text accessibilityLiveRegion="polite" style={previewNoticeStyle}>
                가족 소유자는 바로 나갈 수 없어요. 가족 관리에서 기록 가능 구성원에게 소유권을 이전한 뒤 다시 시도해 주세요.
              </Text>
              <SecondaryButton label="가족 관리 열기" onPress={() => router.push("/family")} />
            </>
          ) : canLeaveHousehold ? (
            <>
              <SecondaryButton
                label={householdPreview.isPending ? "확인하는 중..." : flowCopy.household_leave.previewLabel}
                disabled={householdPreview.isPending}
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
            </>
          ) : (
            <SecondaryButton
              label={householdMembers.isError ? "가족 정보를 다시 불러오기" : "가족 권한 확인 중..."}
              disabled={!householdMembers.isError}
              onPress={() => householdMembers.refetch()}
            />
          )}
          {householdLeave.isError ? <Text style={{ color: theme.colors.danger }}>{actionFailedText}</Text> : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={dangerTitleStyle}>{flowCopy.account_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          {!activeDeletion ? (
            <>
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
            </>
          ) : null}
          {activeDeletion ? (
            <View style={previewBoxStyle}>
              <Text style={previewTitleStyle}>
                {deletionPresentation!.title}
              </Text>
              <Text style={previewLineStyle}>요청 시각: {new Date(activeDeletion.requestedAt).toLocaleString("ko-KR")}</Text>
              <Text style={previewLineStyle}>삭제 시작 예정: {activeDeletion.dueAt ? new Date(activeDeletion.dueAt).toLocaleString("ko-KR") : "확인 중"}</Text>
              <Text accessibilityLiveRegion="polite" style={previewNoticeStyle}>
                {deletionPresentation!.notice}
              </Text>
              {blockingHouseholdId ? (
                <SecondaryButton
                  label="소유권 이전하러 가기"
                  onPress={() => router.push({ pathname: "/family", params: { householdId: blockingHouseholdId } })}
                />
              ) : null}
              {activeDeletion.state === "failed" ? (
                <SecondaryButton
                  disabled={accountRetry.isPending}
                  label={accountRetry.isPending ? "가족 상태 확인 중..." : "삭제 다시 시도"}
                  onPress={() => accountRetry.mutate(activeDeletion.id)}
                />
              ) : null}
              {deletionPresentation!.canCancel ? (
                <SecondaryButton disabled={accountCancel.isPending} label={accountCancel.isPending ? "취소 처리 중..." : "회원 탈퇴 요청 취소"} onPress={() => accountCancel.mutate(activeDeletion.id)} />
              ) : null}
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
