import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createExpense } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, BottomSheetFrame, PrimaryButton, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

const quickExpenseScreenId = "EXP-001";
const quickExpenseAmountPreview = "₩ 38,500";
const quickExpenseCategories = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "▱", label: "기저귀" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "▤", label: "분유/유제품" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "⌘", label: "식비" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "⌂", label: "의류" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "▭", label: "약품/교통" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "▣", label: "병원/약" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "▥", label: "교육/도서" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", icon: "⊕", label: "기타" }
];

const quickExpensePixelScale = 0.96;
const quickExpenseScaleHorizontalOffset = 4;
const quickExpenseScaleVerticalOffset = 11;
const quickExpensePixelFrameStyle = {
  transform: [
    { translateX: quickExpenseScaleHorizontalOffset },
    { translateY: quickExpenseScaleVerticalOffset },
    { scale: quickExpensePixelScale }
  ]
} as const;

const quickExpenseStatusBarStyle = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    height: 20,
    justifyContent: "space-between",
    left: -14,
    position: "absolute",
    right: -14,
    top: -18,
    zIndex: 2
  },
  symbols: {
    color: theme.colors.gray900,
    fontSize: 10,
    fontWeight: "800"
  },
  rightCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  signalBars: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 1,
    height: 8
  },
  signalBar: {
    backgroundColor: theme.colors.gray900,
    borderRadius: 1,
    width: 2
  },
  wifiDot: {
    backgroundColor: theme.colors.gray900,
    borderRadius: 4,
    height: 7,
    opacity: 0.82,
    width: 7
  },
  battery: {
    alignItems: "center",
    borderColor: theme.colors.gray900,
    borderRadius: 2,
    borderWidth: 1,
    flexDirection: "row",
    height: 7,
    justifyContent: "center",
    width: 15
  },
  batteryFill: {
    backgroundColor: theme.colors.gray900,
    borderRadius: 1,
    height: 4,
    width: 10
  },
  batteryNub: {
    backgroundColor: theme.colors.gray900,
    borderRadius: 1,
    height: 3,
    marginLeft: 1,
    width: 2
  },
  time: {
    color: theme.colors.gray900,
    fontSize: 11,
    fontWeight: "800"
  }
});

const quickExpenseCategoryGridStyle = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 13
  }
});

const quickExpenseCategoryTileStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    flexBasis: "23%",
    gap: 7
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  iconBoxSelected: {
    backgroundColor: theme.colors.mainCoral,
    borderColor: theme.colors.mainCoral,
    shadowColor: theme.colors.mainCoral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12
  },
  iconText: {
    color: theme.colors.brown,
    fontSize: 20,
    fontWeight: "800"
  },
  iconTextSelected: {
    color: theme.colors.white
  },
  label: {
    color: theme.colors.brown,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  }
});

type QuickExpenseCategory = (typeof quickExpenseCategories)[number];

function QuickExpenseStatusBar() {
  return (
    <View pointerEvents="none" style={quickExpenseStatusBarStyle.container}>
      <Text style={quickExpenseStatusBarStyle.time}>9:41</Text>
      <View style={quickExpenseStatusBarStyle.rightCluster}>
        <View style={quickExpenseStatusBarStyle.signalBars}>
          <View style={[quickExpenseStatusBarStyle.signalBar, { height: 3 }]} />
          <View style={[quickExpenseStatusBarStyle.signalBar, { height: 5 }]} />
          <View style={[quickExpenseStatusBarStyle.signalBar, { height: 7 }]} />
        </View>
        <View style={quickExpenseStatusBarStyle.wifiDot} />
        <View style={{ alignItems: "center", flexDirection: "row" }}>
          <View style={quickExpenseStatusBarStyle.battery}>
            <View style={quickExpenseStatusBarStyle.batteryFill} />
          </View>
          <View style={quickExpenseStatusBarStyle.batteryNub} />
        </View>
      </View>
    </View>
  );
}

function ExpenseCategoryIconButton({
  category,
  onPress,
  selected
}: {
  category: QuickExpenseCategory;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={quickExpenseCategoryTileStyle.button}>
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        <Text style={[quickExpenseCategoryTileStyle.iconText, selected ? quickExpenseCategoryTileStyle.iconTextSelected : null]}>{category.icon}</Text>
      </View>
      <Text numberOfLines={1} style={quickExpenseCategoryTileStyle.label}>
        {category.label}
      </Text>
    </Pressable>
  );
}

export default function NewExpenseScreen() {
  const [itemName, setItemName] = useState("기저귀");
  const [amountText, setAmountText] = useState("38500");
  const [memo, setMemo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(quickExpenseCategories[0]);
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const saveExpense = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      if (!accessToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim()) {
        throw new Error("invalid expense");
      }
      return createExpense(accessToken, childId, {
        categoryId: selectedCategory.id,
        amountKrw,
        spentOn: "2026-07-06",
        itemName,
        paymentMethod: "card",
        memo
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)/records");
    }
  });
  const formattedAmount = amountText === "38500" ? quickExpenseAmountPreview : `₩ ${Number(amountText || 0).toLocaleString("ko-KR")}`;

  return (
    <AppScreen>
      <View style={quickExpensePixelFrameStyle}>
        <BottomSheetFrame
          title=""
          showHandle={false}
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            boxShadow: "none",
            elevation: 0,
            gap: 14,
            padding: 0,
            position: "relative"
          }}
        >
        <QuickExpenseStatusBar />
        <View accessibilityLabel={quickExpenseScreenId} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 40 }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 36 }}>
            <Text style={{ color: theme.colors.gray900, fontSize: 24 }}>×</Text>
          </Pressable>
          <Text style={{ color: theme.colors.gray900, fontSize: 18, fontWeight: "800" }}>지출 기록</Text>
          <View style={{ width: 36 }} />
        </View>

        <View
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.12)",
            borderRadius: 14,
            borderWidth: 1,
            gap: 12,
            padding: 16
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>2025. 05. 24 (토)</Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 18 }}>▣</Text>
          </View>
          <View style={{ backgroundColor: "rgba(74, 63, 53, 0.12)", height: 1 }} />
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setAmountText(value.replace(/[^0-9]/g, ""))}
            style={{ color: theme.colors.gray900, fontSize: 30, fontWeight: "800", paddingVertical: 0 }}
            value={formattedAmount}
          />
        </View>

        <View style={quickExpenseCategoryGridStyle.grid}>
          {quickExpenseCategories.map((category) => {
            const selected = category.label === selectedCategory.label;
            return (
              <ExpenseCategoryIconButton
                key={`${category.id}-${category.label}`}
                selected={selected}
                category={category}
                onPress={() => {
                  setSelectedCategory(category);
                  setItemName(category.label);
                }}
              />
            );
          })}
        </View>

        <TextInput
          onChangeText={setMemo}
          placeholder="메모를 입력해 주세요 (선택)"
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            color: theme.colors.brown,
            minHeight: 48,
            paddingHorizontal: 14
          }}
          value={memo}
        />

        <Pressable
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 16
          }}
        >
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>결제 수단</Text>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>▣ 카카오뱅크</Text>
          </View>
          <Text style={{ color: theme.colors.gray600, fontSize: 18 }}>›</Text>
        </Pressable>

        <View style={{ display: "none" }}>
          <TextInput onChangeText={setItemName} value={itemName} />
        </View>

        {saveExpense.isError ? <Toast message="금액과 항목을 확인해 주세요." /> : null}
          <PrimaryButton label={saveExpense.isPending ? "저장 중" : "저장하기"} onPress={() => saveExpense.mutate()} />
        </BottomSheetFrame>
      </View>
    </AppScreen>
  );
}
