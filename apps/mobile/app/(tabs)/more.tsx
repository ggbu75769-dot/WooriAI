import { useQuery } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import type React from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import {
  fixtureSessionToken,
  getBudget,
  getHome,
  getNotificationPreferences,
  listChildren,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID
} from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { useCurrentSessionLogout } from "../../src/auth/use-current-session-logout";
import {
  AppIcon,
  AppScreen,
  Card,
  EmptyStateCard,
  SampleDataBanner,
  SecondaryButton,
  StatusBadge,
  SyncStatusBar,
  TopAppBar,
  type AppIconName
} from "../../src/design-system";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import appManifest from "../../app.json";

const isPixelLockMode = isPixelLockBuild();
const profileReferenceScreenId = pixelEvidenceId("SET-001 · PF-01 · FAM-001 · IMP-001");
const logoMark = require("../../assets/illustrations/logo_mark.png");
const appVersion = appManifest.expo.version;
const appPackage = appManifest.expo.android.package;

type ProfileRowProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  value?: string;
  disabled?: boolean;
  onPress?: () => void;
};

function ProfileRow({ icon, title, subtitle, value, disabled, onPress }: ProfileRowProps) {
  return (
    <Pressable
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(". ")}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, flexDirection: "row", gap: 12, minHeight: 64, opacity: disabled ? 0.48 : pressed ? 0.76 : 1, paddingHorizontal: 14, paddingVertical: 8 })}
    >
      <View style={{ alignItems: "center", backgroundColor: theme.colors.coral[50], borderRadius: 20, height: 40, justifyContent: "center", width: 40 }}>
        <AppIcon color={disabled ? theme.colors.text.tertiary : theme.colors.coral[700]} name={icon} size={22} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        {subtitle ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: "700" }}>{value}</Text> : null}
      <AppIcon color={theme.colors.text.tertiary} name="chevron-right" size={21} />
    </Pressable>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: "700" }}>{title}</Text>
      <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.gray300, borderRadius: theme.radii.card, borderWidth: 1, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

export default function ProfileHubScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const effectiveUserId = userId ?? (isTestSession ? LOCAL_USER_ID : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const { confirmLogout, isLoggingOut } = useCurrentSessionLogout();
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const hasScope = Boolean(token && householdId && childId);

  const home = useQuery({ queryKey: ["home", childId], enabled: hasScope, queryFn: () => getHome(token!, childId!) });
  const children = useQuery({ queryKey: ["children", householdId], enabled: Boolean(token && householdId), queryFn: () => listChildren(token!) });
  const members = useQuery({ queryKey: ["household-members", householdId], enabled: Boolean(token && householdId), queryFn: () => listHouseholdMembers(token!, householdId!) });
  const budget = useQuery({ queryKey: ["budget", childId], enabled: Boolean(token && childId), queryFn: () => getBudget(token!, childId!) });
  const notifications = useQuery({ queryKey: ["notification-preferences", householdId], enabled: Boolean(token && householdId && !isTestSession), queryFn: () => getNotificationPreferences(token!) });

  if (!token && !isPixelLockMode) return <Redirect href="/launch-animation" />;
  if (!hasScope && !isPixelLockMode) return <Redirect href="/" />;

  const loading = hasScope && (home.isLoading || children.isLoading || members.isLoading || budget.isLoading);
  const failed = hasScope && (home.isError || children.isError || members.isError || budget.isError);
  if (loading) return <AppScreen><EmptyStateCard title="프로필을 불러오고 있어요." actionLabel="잠시만요" /></AppScreen>;
  if (failed) return <AppScreen><EmptyStateCard title="프로필을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => { void home.refetch(); void children.refetch(); void members.refetch(); void budget.refetch(); }} /></AppScreen>;

  const visibleChild = home.data?.child ?? (isPixelLockMode ? { id: "pixel-child", nickname: "우리아이", currentStage: "pregnancy_late", stageLabel: "임신 28주" } : null);
  if (!visibleChild) return <Redirect href="/onboarding/child-status" />;
  const activeMembers = members.data?.members.filter((member) => member.status === "active") ?? [];
  const activeChildren = children.data?.children ?? [];
  const ownRole = activeMembers.find((member) => member.userId === effectiveUserId)?.role ?? "viewer";
  const canManage = ownRole === "owner";
  const canEditFamilyData = ownRole === "owner" || ownRole === "co_parent";
  const notificationSummary = isTestSession
    ? "이 기기에서는 변경할 수 없어요"
    : notifications.data
      ? [notifications.data.replacementEnabled ? "준비 시기" : null, notifications.data.budgetEnabled ? "예산" : null, notifications.data.familyEnabled ? "가족" : null, notifications.data.marketingEnabled ? "소식" : null].filter(Boolean).join(" · ") || "모든 선택 알림 꺼짐"
      : "알림 상태 확인"
  ;

  return (
    <AppScreen>
      <View accessibilityLabel={profileReferenceScreenId} testID="screen-PF-01" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <TopAppBar title="프로필" />

        <Card style={{ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 88 }}>
          <View style={{ alignItems: "center", backgroundColor: theme.colors.coral[50], borderRadius: 28, height: 56, justifyContent: "center", width: 56 }}>
            <Image accessibilityIgnoresInvertColors source={logoMark} style={{ height: 38, width: 38 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{visibleChild.nickname}네</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>보호자 {activeMembers.length || 1}명 · 아이 {activeChildren.length || 1}명</Text>
          </View>
          <StatusBadge label={visibleChild.stageLabel} tone="brand" />
        </Card>

        <ProfileSection title="아이 · 산모">
          {activeChildren.length ? activeChildren.map((child) => (
            <ProfileRow key={child.id} icon="baby-face-outline" title={child.nickname} subtitle={child.stageLabel} value={child.id === childId ? "선택됨" : undefined} onPress={() => router.push(`/children/${child.id}` as Href)} />
          )) : <ProfileRow icon="baby-face-outline" title={visibleChild.nickname} subtitle={visibleChild.stageLabel} onPress={() => router.push(`/children/${visibleChild.id}` as Href)} />}
          {visibleChild.currentStage.startsWith("pregnancy_") ? <ProfileRow icon="human-pregnant" title="산모 프로필" subtitle="회복·케어 준비를 함께 확인해요" onPress={() => router.push(`/children/${visibleChild.id}` as Href)} /> : null}
          <ProfileRow icon="plus-circle-outline" title="아이 추가하기" subtitle="최대 5명까지 아이별로 관리해요" onPress={() => router.push("/children/new" as Href)} />
        </ProfileSection>

        <ProfileSection title="가족">
          <ProfileRow disabled={!canManage} icon="account-multiple-outline" title="가족 구성원" subtitle={canManage ? "멤버와 권한을 관리해요" : "보기 전용 권한에서는 관리할 수 없어요"} value={`${activeMembers.length || 1}명`} onPress={() => router.push("/family")} />
          <ProfileRow disabled={!canManage} icon="email-outline" title="가족 초대" subtitle="24시간 유효한 링크로 함께 기록해요" onPress={() => router.push("/family/invite")} />
        </ProfileSection>

        <ProfileSection title="예산 · 데이터">
          <ProfileRow disabled={!canEditFamilyData} icon="wallet-outline" title="월 예산 설정" subtitle={canEditFamilyData ? "매월 1일 기준으로 관리돼요" : "보기 전용 권한에서는 변경할 수 없어요"} value={budget.data ? `${budget.data.amountKrw.toLocaleString("ko-KR")}원` : "미설정"} onPress={() => router.push("/budget")} />
          <ProfileRow icon="file-excel-outline" title="지출 내역 가져오기" subtitle="xlsx·csv 파일을 저장 전 미리보기로 확인해요" onPress={() => router.push("/import")} />
          <ProfileRow disabled icon="file-export-outline" title="지출 내역 내보내기" subtitle="현재 서버에서 제공하지 않아요" />
        </ProfileSection>

        <ProfileSection title="설정">
          <ProfileRow icon="bell-outline" title="알림 설정" subtitle={notificationSummary} onPress={() => router.push("/notification-preferences" as Href)} />
          <ProfileRow icon="shield-lock-outline" title="약관 · 개인정보 · 계정" subtitle="동의 내역과 회원 탈퇴 유예를 확인해요" onPress={() => router.push("/settings/privacy")} />
          <ProfileRow icon="information-outline" title="앱 정보" value={`v${appVersion}`} onPress={() => Alert.alert("앱 정보", `우리아이 v${appVersion}\n${appPackage}`)} />
        </ProfileSection>

        <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
        <SecondaryButton
          busy={isLoggingOut}
          disabled={isLoggingOut}
          label={isLoggingOut ? "로그아웃 중" : "로그아웃"}
          onPress={confirmLogout}
          style={{ alignSelf: "center", minWidth: 120 }}
        />
      </View>
    </AppScreen>
  );
}
