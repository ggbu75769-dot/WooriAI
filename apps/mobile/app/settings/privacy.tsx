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
// 라운드 61 #2: 탈퇴 직후 가구 목록·역할 표를 서버 기준으로 다시 받는 그 경로 그대로
// (초대 수락과 같은 단일 소스 — app/family/accept/[token].tsx).
import { revalidateHouseholdRoles } from "../../src/family/useExpenseEntryGate";
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
    /**
     * 라운드 61 #2 — **나간 가구를 세션에서도 내보낸다.**
     *
     * 종전에는 성공 뒤 캐시만 무효화했다. 그런데 이 계정이 아는 가구는 캐시가 아니라 세션
     * 스토어에 있다(`householdIds` · `householdRoles` · `defaultHouseholdId` — persist라 앱을
     * 다시 켜도 남는다). 그래서 방금 나온 가구가
     *   - 가족 화면의 "다른 가구 보기" 후보로 계속 서 있고(고르면 403/404뿐이다),
     *   - 다가구 표기·역할 판정의 근거로 계속 세어지고,
     *   - `defaultHouseholdId`였다면 **다음 탈퇴의 대상**으로까지 남았다(아이가 없는 계정에서
     *     대상 가구는 그 값이다 — resolveManagedHouseholdId의 3단계 폴백).
     *
     * 두 줄로 정리한다. 새 스토어 API도, 새 요청 경로도 만들지 않는다.
     */
    onSuccess: async () => {
      householdPreview.reset();
      const leftHouseholdId = householdId;
      // 탈퇴한 가구의 아이만 접근을 잃는다 -- 다른 가구에 아이가 남아 있으면 그쪽으로 이어간다.
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      /**
       * ① 기본 가구가 방금 나온 그 가구면 **비운다**.
       *
       * 라운드 60의 "덮어쓰기 금지" 계약(app/family/accept/[token].tsx)과 충돌하지 않는다 --
       * 그 계약이 막는 것은 **살아 있는 사실을 다른 살아 있는 사실로 갈아 끼우는 일**이다
       * (초대를 수락했다는 이유로 원래 가구를 가리키던 유일한 값을 잃는 것). 여기서 지우는
       * 값은 서버가 방금 "당신은 이 가구의 구성원이 아니다"라고 답한 **죽은 값**이고, 죽은
       * 값을 붙들고 있으면 그것이 곧 다음 화면의 거짓말이 된다. 그래서 규칙은 이렇게 갈린다:
       *   - 살아 있는 값은 덮어쓰지 않는다(수락);
       *   - 죽은 값은 붙들지 않는다(탈퇴).
       * 대신 **다른 가구를 골라 채우지도 않는다** -- null은 "모름"이고, 모름이면 판정은
       * 아이 기준으로 돌아간다(그게 우리가 아는 유일한 사실이다). 남은 가구 중 하나를
       * 기본으로 지어내는 것은 사용자가 고른 적 없는 선택이다.
       */
      if (leftHouseholdId && useSessionStore.getState().defaultHouseholdId === leftHouseholdId) {
        useSessionStore.setState({ defaultHouseholdId: null });
      }
      /**
       * ② 가구 목록·역할 표를 **서버 기준으로** 다시 받는다(초대 수락과 같은 관례 —
       * app/family/accept/[token].tsx). 표가 방금 바뀐 것을 아는 순간이라 스로틀의 전제
       * ("같은 사실을 반복해 묻는다")가 성립하지 않으므로 `force`다.
       *
       * 마지막 가구에서 나온 사람은 서버가 `households: []`로 답한다 -- 그 빈 목록은
       * `setHouseholdRoles`를 지나 표·목록을 **둘 다 null(모름)**로 만든다(세션 스토어의
       * 빈 목록 경로 주석 그대로). 모름은 아무 진입점도 잠그지 않으므로, 가구가 하나도 없는
       * 계정이 자기 아이 기록에서 잠기는 일은 생기지 않는다.
       *
       * 조회는 백그라운드다. 응답이 늦게 도착했는데 그사이 세션이 끝났다면(로그아웃 →
       * userId null) `setHouseholdRoles`가 그대로 빠져나가므로 떠난 계정의 표가 되살아나지
       * 않는다. 만료(`clearSession("expired")`)는 정체성을 남기므로 갱신이 그대로 착지하고,
       * 그게 맞다 -- 사람도 계정도 그대로이고 방금 탈퇴한 사실도 그대로다.
       */
      revalidateHouseholdRoles({ force: true });
      /**
       * P3(라운드 61 정찰) — 여기서 **정리되지 않는 것**을 적어 둔다(이번 라운드 범위 밖).
       *
       * 정기 지출 템플릿(src/stores/recurring-expense.store.ts)과 알림 목록
       * (src/notifications/notification.store.ts)은 가구가 아니라 **아이 단위**로 쌓인다
       * (`template.childId` · `entry.childId`). 탈퇴로 접근을 잃는 것은 그 가구의 아이들이므로,
       * 그 아이들의 템플릿·알림은 기기에 그대로 남아 이번 달 리마인더로 다시 뜬다 -- 사용자는
       * 더 이상 볼 수 없는 아이의 "기저귀 살 때예요"를 계속 받는다. PRIV-104의 teardown은
       * 정체성 전환(userId·isTestSession)에만 걸리는데(src/offline/session-teardown.ts) 탈퇴는
       * 같은 사람이 계속 로그인해 있는 상태라 발화하지 않는다. 아래 `finishChildRemoval`이
       * 지우는 것은 쿼리 캐시뿐이다(CHILD_REMOVAL_INVALIDATE_KEYS).
       *
       * 고치려면 "어느 아이가 사라졌는가"를 알아야 하는데, 탈퇴 응답도 이후 목록 조회도 그것을
       * 말해 주지 않는다(남은 아이만 온다). 탈퇴 직전 목록과의 차집합을 뜨는 설계가 필요하고,
       * 그건 이 라운드의 "세션 잔재" 한 줄과는 범위가 다르다 -- 근거만 남긴다.
       */
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
