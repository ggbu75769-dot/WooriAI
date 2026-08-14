import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import { fixtureSessionToken, previewOnboardingStarterItems, type OnboardingStarterItem } from "../api/client";
import { useOnboardingDraftStore } from "../stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSessionStore } from "../stores/session.store";
import { AppIcon, BottomActionBar, LoadingState, OnboardingScaffold, ScreenHeader, StepProgress, TextButton, Toast } from "../design-system";
import { theme } from "../theme";
import { columnCountForPreparedItems, resolveOnboardingStarterIcon } from "./starter-items";

export function PreparedItemsV2Screen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const draft = useOnboardingDraftStore((state) => state.draft);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  const replacePreparedItems = useOnboardingDraftStore((state) => state.replacePreparedItems);
  const { height, width } = useWindowDimensions();
  const columns = columnCountForPreparedItems(width, height);

  const preview = useQuery({
    queryKey: ["onboarding", "starter-items", draft?.selectedPath, draft?.dueDate, draft?.birthDate, draft?.manualStage],
    queryFn: () => previewOnboardingStarterItems(token!, {
      stageMode: draft!.selectedPath!,
      ...(draft!.dueDate ? { dueDate: draft!.dueDate } : {}),
      ...(draft!.birthDate ? { birthDate: draft!.birthDate } : {}),
      ...(draft!.manualStage ? { manualStage: draft!.manualStage } : {})
    }),
    enabled: Boolean(token && draft?.selectedPath)
  });

  if (!draft?.selectedPath) return <Redirect href="/onboarding/child-status" />;
  const selectedIds = draft.preparedItemIds;
  const visibleItems = preview.data?.items ?? [];
  const visibleIds = visibleItems.map((item) => item.id);
  const selectedVisibleIds = visibleIds.filter((id) => selectedIds.includes(id));
  const selectedVisibleCount = selectedVisibleIds.length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const selectionProgress = visibleIds.length > 0 ? selectedVisibleCount / visibleIds.length : 0;
  const continueToBudget = (state: "selected" | "skipped" | "completed_none") => {
    updateDraft({ preparedStepState: state, currentStep: "budget", preparedItemIds: state === "selected" ? selectedVisibleIds : [] });
    useOnboardingProgressStore.getState().completeStep("ONB-002");
    router.push("/onboarding/budget");
  };

  return (
    <OnboardingScaffold
      footer={(
        <BottomActionBar
          onPrimary={() => continueToBudget("selected")}
          onSecondary={() => continueToBudget("completed_none")}
          onText={() => continueToBudget("skipped")}
          primaryDisabled={selectedVisibleCount === 0}
          primaryLabel={selectedVisibleCount > 0 ? `${selectedVisibleCount}개를 준비 완료로 표시` : "준비한 물건을 선택해 주세요"}
          secondaryLabel="아직 준비한 물건이 없어요"
          textLabel="나중에 할게요"
        />
      )}
      scrollMode="content"
      testID="screen-ONB-002"
    >
      <FlatList
        key={`prepared-grid-${columns}`}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
        data={visibleItems}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View accessibilityLabel="ONB-002" style={{ gap: theme.spacing.section, marginBottom: 8 }} testID="screen-ONB-002">
            <StepProgress current={2} label="준비 현황" total={3} />
            <ScreenHeader title="이미 준비한 물건이 있나요?" subtitle="선택한 항목은 준비 완료 상태로 시작해요. 나중에 바꿀 수 있어요." />
            {preview.isLoading ? <LoadingState description="현재 단계에 맞는 항목을 확인하고 있어요." /> : null}
            {preview.isError ? <Toast message="목록을 불러오지 못했어요. 건너뛰고 나중에 설정할 수 있어요." tone="error" /> : null}
            {visibleItems.length > 0 ? (
              <View
                accessibilityLabel={`준비물 ${selectedVisibleCount}개 선택, 전체 ${visibleItems.length}개`}
                accessibilityLiveRegion="polite"
                style={{ backgroundColor: theme.colors.beige, borderRadius: theme.radii.card, gap: 10, padding: 16 }}
              >
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "800" }}>현재 단계 추천 준비물</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>{selectedVisibleCount} / {visibleItems.length}개 선택</Text>
                  </View>
                  <TextButton
                    label={allVisibleSelected ? "모두 해제" : "모두 선택"}
                    onPress={() => replacePreparedItems(allVisibleSelected ? [] : visibleIds)}
                    style={{ alignSelf: "center", paddingHorizontal: 8 }}
                  />
                </View>
                <View
                  accessibilityLabel="준비물 선택 진행률"
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: visibleItems.length, now: selectedVisibleCount, text: `${selectedVisibleCount}/${visibleItems.length}` }}
                  style={{ backgroundColor: theme.colors.gray300, borderRadius: theme.radii.pill, height: 6, overflow: "hidden" }}
                >
                  <View style={{ backgroundColor: theme.colors.mainCoral, borderRadius: theme.radii.pill, height: 6, width: `${selectionProgress * 100}%` }} />
                </View>
              </View>
            ) : null}
            {preview.data?.availability === "external_blocked" ? (
              <View style={{ backgroundColor: theme.colors.beige, borderRadius: theme.radii.card, gap: 6, padding: 18 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "800" }}>검수가 끝난 준비물이 아직 공개되지 않았어요</Text>
                <Text style={{ color: theme.colors.textSecondary, lineHeight: 21 }}>검수 중인 항목은 보여주지 않아요. 지금은 건너뛰고 준비 탭에서 나중에 설정해 주세요.</Text>
              </View>
            ) : null}
          </View>
        )}
        numColumns={columns}
        renderItem={({ item }) => (
          <PreparedItemCard
            checked={selectedIds.includes(item.id)}
            item={item}
            onPress={() => replacePreparedItems(
              selectedIds.includes(item.id)
                ? selectedIds.filter((id) => id !== item.id)
                : [...selectedIds, item.id]
            )}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </OnboardingScaffold>
  );
}

export default PreparedItemsV2Screen;

function PreparedItemCard({ checked, item, onPress }: { checked: boolean; item: OnboardingStarterItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={checked ? "준비 완료로 선택됨. 두 번 탭하면 해제됩니다." : "두 번 탭하면 준비 완료로 선택됩니다."}
      accessibilityLabel={`${item.nameKo}. ${item.shortDescription}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: checked ? theme.colors.coral[50] : theme.colors.surface,
        borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
        borderRadius: theme.radii.card,
        borderWidth: checked ? 2 : 1,
        flex: 1,
        gap: 7,
        justifyContent: "center",
        marginBottom: 2,
        minHeight: 132,
        opacity: pressed ? 0.8 : 1,
        paddingHorizontal: 7,
        paddingVertical: 10
      })}
    >
      <View style={{ alignItems: "center", backgroundColor: theme.colors.beige, borderRadius: 24, height: 44, justifyContent: "center", width: 44 }}>
        <AppIcon color={theme.colors.coral[700]} name={resolveOnboardingStarterIcon(item)} size={25} />
      </View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: "800", minHeight: 30, textAlign: "center" }}>{item.nameKo}</Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 11, textAlign: "center" }}>{item.shortDescription}</Text>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
        <AppIcon color={checked ? theme.colors.mainCoral : theme.colors.gray300} name={checked ? "check-circle" : "circle-outline"} size={16} />
        <Text style={{ color: checked ? theme.colors.coral[700] : theme.colors.textSecondary, fontSize: 10, fontWeight: "700" }}>{checked ? "선택됨" : "선택"}</Text>
      </View>
    </Pressable>
  );
}
