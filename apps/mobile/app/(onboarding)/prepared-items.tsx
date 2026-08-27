import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { listItems, LOCAL_SESSION_TOKEN, setPreparedItems } from "../../src/api/client";
import { LOCAL_ITEM_CARRIER, LOCAL_ITEM_DIAPER } from "../../src/api/local-fixtures";
import {
  PREPARED_ITEMS_PARTIAL_ALERT_TITLE,
  preparedIdsToSubmit,
  preparedItemsPartialNotice,
  selectPreparedItemOptions,
  togglePreparedItemId,
  type PreparedItemOption
} from "../../src/onboarding/prepared-items-selection";
import { OnboardingSaveErrorCard, OnboardingStepProgress } from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, TextButton } from "../../src/ui";
import { SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

// 데모(테스트 세션) 전용 고정 후보. 이 두 id는 standalone 로컬 백엔드에 실제로 있는 픽스처라
// (src/api/local-fixtures.ts) 체크하면 데모 준비템 목록에도 그대로 반영된다.
//
// 라운드 45 UX-Y(P1): 실서버 세션은 더 이상 이 목록을 쓰지 않는다 — 실서버에 없는 id를 보내
// 서버가 조용히 건너뛰는데도 화면은 "준비 완료"라고 선언하던 허위 성공이었다. 실세션은 아래
// itemsQuery로 진짜 준비템을 받아 그 id를 보낸다.
const demoPreparedItemOptions: PreparedItemOption[] = [
  { id: LOCAL_ITEM_DIAPER, icon: "🧷", label: "기저귀", essential: true },
  { id: LOCAL_ITEM_CARRIER, icon: "🎒", label: "아기띠", essential: false }
];

export default function PreparedItemsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  // 기본값은 전체 해제 — 사용자가 직접 고른 것만 "이미 준비했다"고 선언한다(라운드 45 UX-Y).
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const isItemsQueryEnabled = Boolean(authToken && selectedChildId) && !isDemoSession;
  const itemsQuery = useQuery({
    queryKey: ["onboarding-prepared-items", selectedChildId],
    enabled: isItemsQueryEnabled,
    queryFn: () => listItems(authToken!, selectedChildId!, "now")
  });

  const options = isDemoSession ? demoPreparedItemOptions : selectPreparedItemOptions(itemsQuery.data?.items ?? []);
  // 비활성 쿼리도 react-query에서는 isPending이라, 로딩 판정에는 "실제로 조회 중"인지를 함께 본다.
  const isLoadingOptions = isItemsQueryEnabled && itemsQuery.isPending;
  const hasOptions = options.length > 0;
  const idsToSubmit = preparedIdsToSubmit(checkedIds, options);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !selectedChildId) {
        throw new Error("missing onboarding context");
      }
      return setPreparedItems(authToken, selectedChildId, idsToSubmit);
    },
    // 서버가 돌려준 `updatedCount`는 **실제로 반영된 건수**다. 보낸 개수보다 작으면(목록이
    // 갱신되며 사라진 항목을 체크해 둔 경우) 저장은 성공이지만 화면이 아는 수와 다르다 —
    // 진행을 막지 않고 중립 안내 한 줄만 남긴다(preparedItemsPartialNotice 주석 참고).
    onSuccess: (result) => {
      const notice = preparedItemsPartialNotice(idsToSubmit.length, result?.updatedCount);
      if (notice) Alert.alert(PREPARED_ITEMS_PARTIAL_ALERT_TITLE, notice);
      completeStep("ONB-003");
      router.push("/onboarding/budget");
    }
  });

  // 목록을 못 받았거나(오프라인·서버 오류) 지금 시기에 보여줄 준비템이 없을 때는 이 단계를
  // 건너뛸 수 있어야 한다. 건너뛰기도 같은 저장(빈 목록 = 0건)을 태운다 — 서버가 단계 완료
  // 표시(preparedItemsSetAt)를 남겨야 다음 실행의 이어하기가 이 화면으로 되돌아오지 않고,
  // 요약에도 "0개"라는 사실 그대로가 남는다.
  const canSkip = !isLoadingOptions && !hasOptions;

  return (
    <AppScreen>
      <View testID="screen-ONB-003" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-003" />
        <ScreenHeader
          eyebrow="출산 준비물"
          title="이미 준비한 물건이 있나요?"
          subtitle="체크한 항목은 준비물 목록에서 완료로 표시할게요."
        />

        <Card style={{ gap: 4 }}>
          {isLoadingOptions ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : null}

          {!isLoadingOptions && !hasOptions ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body2.fontSize }}>
              {itemsQuery.isError
                ? "준비물 목록을 불러오지 못했어요. 이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요."
                : "지금 시기에 보여드릴 준비물이 아직 없어요. 이 단계는 건너뛰어도 괜찮아요."}
            </Text>
          ) : null}

          {options.map((item, index) => {
            const checked = checkedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityLabel={item.label}
                accessibilityState={{ checked }}
                onPress={() => setCheckedIds((current) => togglePreparedItemId(current, item.id))}
                style={{
                  alignItems: "center",
                  borderTopColor: theme.colors.gray300,
                  borderTopWidth: index === 0 ? 0 : 1,
                  flexDirection: "row",
                  gap: theme.spacing.gap,
                  minHeight: theme.touchTarget,
                  paddingVertical: 10
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.beige,
                    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
                    borderRadius: 8,
                    borderWidth: 1,
                    height: 26,
                    justifyContent: "center",
                    width: 26
                  }}
                >
                  {checked ? <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "800" }}>✓</Text> : null}
                </View>
                {item.icon ? <Text style={{ fontSize: 18 }}>{item.icon}</Text> : null}
                <Text style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                  {item.label}
                </Text>
                {item.essential ? (
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    필수
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Card>

        <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
          나중에 준비템 탭에서 언제든 다시 체크할 수 있어요.
        </Text>

        {save.isError ? <OnboardingSaveErrorCard onRetry={() => save.mutate()} /> : null}

        <PrimaryButton
          disabled={save.isPending || isLoadingOptions || !authToken || !selectedChildId}
          label={save.isPending ? "저장하는 중" : canSkip ? "건너뛰고 계속" : "저장하고 계속"}
          onPress={() => save.mutate()}
        />
        {itemsQuery.isError ? (
          <TextButton
            disabled={itemsQuery.isFetching}
            label="목록 다시 불러오기"
            onPress={() => void itemsQuery.refetch()}
            style={{ alignItems: "center" }}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}
