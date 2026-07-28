import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppScreen } from "../../src/design-system";
import {
  PreparationListParity,
  type PreparationParityItem
} from "../../src/preparation/PreparationListParity";
import { Release4PreparationScreen } from "../../src/preparation/Release4PreparationScreen";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";

const isPixelLockMode = isPixelLockBuild();

const pixelPreparationItems: PreparationParityItem[] = [
  { id: "R4-C10-001", code: "R4-C10-001", nameKo: "신생아 기저귀", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "owned" } },
  { id: "R4-C09-001", code: "R4-C09-001", nameKo: "신생아 침대", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "planned" } },
  { id: "R4-C09-003", code: "R4-C09-003", nameKo: "단단한 아기 매트리스", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "researching" } },
  { id: "R4-C09-005", code: "R4-C09-005", nameKo: "고정형 매트리스 시트", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "owned" } },
  { id: "R4-C12-001", code: "R4-C12-001", nameKo: "아기 체온계", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "planned" } },
  { id: "R4-C17-011", code: "R4-C17-011", nameKo: "신생아 아기띠", timelineBucket: "this_week", dueWindowLabel: "이번 주", plan: { state: "researching" } },
  { id: "R4-C11-001", code: "R4-C11-001", nameKo: "신생아 욕조", timelineBucket: "this_month", dueWindowLabel: "이번 달", plan: { state: "owned" } },
  { id: "R4-C11-005", code: "R4-C11-005", nameKo: "후드형 아기 타월", timelineBucket: "this_month", dueWindowLabel: "이번 달", plan: { state: "researching" } },
  { id: "R4-C13-001", code: "R4-C13-001", nameKo: "신생아 배냇저고리", timelineBucket: "this_month", dueWindowLabel: "이번 달", plan: { state: "gifted" } },
  { id: "R4-C17-007", code: "R4-C17-007", nameKo: "신생아 유모차", timelineBucket: "this_month", dueWindowLabel: "이번 달", plan: { state: "planned" } },
  { id: "R4-C08-004", code: "R4-C08-004", nameKo: "젖병", timelineBucket: "next_stage", dueWindowLabel: "수유 방식 확인 후", plan: { state: "researching" } },
  { id: "R4-C17-001", code: "R4-C17-001", nameKo: "신생아용 카시트", timelineBucket: "next_stage", dueWindowLabel: "차량 이용 시", plan: { state: "researching" } },
  { id: "R4-C10-004", code: "R4-C10-004", nameKo: "물티슈", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "researching" } },
  { id: "R4-C13-002", code: "R4-C13-002", nameKo: "아기 바디수트", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "planned" } },
  { id: "R4-C11-010", code: "R4-C11-010", nameKo: "아기 손톱가위", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "researching" } },
  { id: "R4-C11-007", code: "R4-C11-007", nameKo: "아기 바디 세정제", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "owned" } },
  { id: "R4-C11-008", code: "R4-C11-008", nameKo: "아기 보습제", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "researching" } },
  { id: "R4-C11-003", code: "R4-C11-003", nameKo: "목욕물 온도계", timelineBucket: "next_stage", dueWindowLabel: "다음 단계", plan: { state: "planned" } },
  { id: "R4-C08-007", code: "R4-C08-007", nameKo: "젖병 세척솔", timelineBucket: "next_stage", dueWindowLabel: "수유 방식 확인 후", plan: { state: "researching" } },
  { id: "R4-C08-009", code: "R4-C08-009", nameKo: "젖병 세정제", timelineBucket: "next_stage", dueWindowLabel: "수유 방식 확인 후", plan: { state: "planned" } }
];

function recommendationPixelScaleFrameStyle() {
  return {
    transform: [
      { translateX: ItemListPixelStyles.horizontalOffset },
      { translateY: ItemListPixelStyles.topOffset },
      { scale: ItemListPixelStyles.scale }
    ]
  } as const;
}

export default function ItemsScreen() {
  return isPixelLockMode ? <PixelItemsScreen /> : <Release4PreparationScreen />;
}

function PixelItemsScreen() {
  const [urgentOnly, setUrgentOnly] = useState(false);

  return (
    <AppScreen>
      <View accessibilityLabel="ITEM-CATALOG-001" style={recommendationPixelScaleFrameStyle()}>
        <PreparationListParity
          contextOptions={[{ key: "child:pixel", label: "산모 · 복덩이" }]}
          items={pixelPreparationItems}
          onBack={() => router.push("/(tabs)" as Href)}
          onItemPress={(item) => router.push(`/items/${item.id}`)}
          onMissingReport={() => undefined}
          onRetry={() => undefined}
          onSelectContext={() => undefined}
          onToggleUrgent={() => setUrgentOnly((current) => !current)}
          selectedContextKey="child:pixel"
          urgentOnly={urgentOnly}
        />
      </View>
    </AppScreen>
  );
}
