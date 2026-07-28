import { Pressable, Text, View } from "react-native";
import { AppIcon, Card, PrimaryButton } from "../design-system/components/ApplicationPrimitives";
import { theme } from "../theme";
import type { PurchaseFollowup } from "./store";

export function purchaseExpenseRouteParams(
  followup: PurchaseFollowup,
  itemName: string
) {
  return {
    pathname: "/expenses/new" as const,
    params: {
      itemName,
      itemDefinitionId: followup.itemDefinitionId,
      purchaseIntentId: followup.intentId
    }
  };
}

export function PurchaseFollowupCard({
  followup,
  itemName,
  onRecord,
  onReviewSync,
  onSnooze,
  onRemove
}: {
  followup: PurchaseFollowup;
  itemName: string;
  onRecord: () => void;
  onReviewSync: () => void;
  onSnooze: () => void;
  onRemove: () => void;
}) {
  const recorded = followup.state === "recorded_pending_sync";
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <AppIcon color={theme.colors.coral[600]} name="cart-check" size={23} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
            {recorded ? "지출 기록을 안전하게 확인 중이에요" : `${itemName}, 구매하셨나요?`}
          </Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 19 }}>
            {recorded
              ? "기기에 먼저 저장됐어요. 서버 확인 전에는 이 안내를 지우지 않아요."
              : "구매했다면 지출로 이어서 기록하고, 아니면 내일 다시 확인할 수 있어요."}
          </Text>
        </View>
      </View>
      {recorded ? (
        <PrimaryButton label="동기화 상태 확인" onPress={onReviewSync} />
      ) : (
        <>
          <PrimaryButton label="구매했어요 · 지출 기록" onPress={onRecord} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityLabel="구매 여부 내일 다시 확인"
              accessibilityRole="button"
              onPress={onSnooze}
              style={({ pressed }) => ({
                alignItems: "center",
                borderColor: theme.colors.gray300,
                borderRadius: theme.radii.small,
                borderWidth: 1,
                flex: 1,
                justifyContent: "center",
                minHeight: theme.touchTarget,
                opacity: pressed ? 0.72 : 1
              })}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: "700" }}>내일 다시</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="구매 후속 안내 지우기"
              accessibilityRole="button"
              onPress={onRemove}
              style={({ pressed }) => ({
                alignItems: "center",
                borderColor: theme.colors.gray300,
                borderRadius: theme.radii.small,
                borderWidth: 1,
                flex: 1,
                justifyContent: "center",
                minHeight: theme.touchTarget,
                opacity: pressed ? 0.72 : 1
              })}
            >
              <Text style={{ color: theme.colors.gray600, fontSize: 13, fontWeight: "700" }}>구매 안 했어요</Text>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}
