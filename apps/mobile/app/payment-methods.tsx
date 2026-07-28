import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  fixtureSessionToken,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  type UserPaymentMethod
} from "../src/api/client";
import { useSessionStore } from "../src/stores/session.store";
import { isPixelLockBuild } from "../src/pixelLock/build-profile";
import { theme } from "../src/theme";
import { AppScreen, Card, CategoryChip, PrimaryButton, ScreenHeader, SecondaryButton, Toast } from "../src/ui";

const paymentTypes: Array<{ value: UserPaymentMethod["type"]; label: string }> = [
  { value: "cash", label: "현금" },
  { value: "card", label: "카드" },
  { value: "transfer", label: "계좌 이체" },
  { value: "mobile_pay", label: "모바일 결제" }
];

const pixelPreviewPaymentMethods: UserPaymentMethod[] = [
  {
    id: "pixel-payment-card",
    type: "card",
    label: "생활비 카드",
    isDefault: true,
    active: true,
    displayOrder: 0
  },
  {
    id: "pixel-payment-cash",
    type: "cash",
    label: "비상 현금",
    isDefault: false,
    active: true,
    displayOrder: 1
  }
];

export default function PaymentMethodsScreen() {
  const params = useLocalSearchParams<{ evidence?: string }>();
  const evidenceId = String(params.evidence ?? "PAY-001");
  const isPixelEvidence = isPixelLockBuild();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<UserPaymentMethod["type"]>("card");
  const [editingId, setEditingId] = React.useState<string | null>(() =>
    isPixelEvidence && evidenceId === "PAY-002" ? "pixel-payment-card" : null
  );
  const [editingLabel, setEditingLabel] = React.useState(() =>
    isPixelEvidence && evidenceId === "PAY-002" ? "생활비 카드" : ""
  );
  const [editingType, setEditingType] = React.useState<UserPaymentMethod["type"]>("card");

  const methods = useQuery({
    queryKey: ["payment-methods"],
    enabled: Boolean(token),
    queryFn: () => listPaymentMethods(token!)
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
  const create = useMutation({
    mutationFn: () => createPaymentMethod(token!, { type, label, isDefault: false }),
    onSuccess: async () => {
      setLabel("");
      await refresh();
    }
  });
  const makeDefault = useMutation({
    mutationFn: (paymentMethodId: string) => setDefaultPaymentMethod(token!, paymentMethodId),
    onSuccess: refresh
  });
  const update = useMutation({
    mutationFn: () => updatePaymentMethod(token!, editingId!, { type: editingType, label: editingLabel }),
    onSuccess: async () => {
      setEditingId(null);
      setEditingLabel("");
      await refresh();
    }
  });
  const deactivate = useMutation({
    mutationFn: (paymentMethodId: string) => deactivatePaymentMethod(token!, paymentMethodId),
    onSuccess: refresh
  });

  const visibleMethods = methods.data?.paymentMethods ?? (isPixelEvidence ? pixelPreviewPaymentMethods : []);
  const active = visibleMethods.filter((method) => method.active);
  const inactive = visibleMethods.filter((method) => !method.active);

  return (
    <AppScreen>
      <View accessibilityLabel="PAY-001" testID="screen-PAY-001" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="PAY-001" title="결제수단" subtitle="번호는 저장하지 않고 알아보기 쉬운 이름만 관리해요." />

        <Card style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>등록된 결제수단</Text>
          {active.length === 0 ? (
            <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>아직 등록된 수단이 없어 지출에는 미지정으로 저장돼요.</Text>
          ) : (
            active.map((method) => (
              <View key={method.id} style={{ borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, gap: 8, paddingVertical: 10 }}>
                {editingId === method.id ? (
                  <View accessibilityLabel="PAY-002" testID="evidence-PAY-002" style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {paymentTypes.map((entry) => (
                        <CategoryChip
                          key={entry.value}
                          label={entry.label}
                          selected={editingType === entry.value}
                          onPress={() => setEditingType(entry.value)}
                        />
                      ))}
                    </View>
                    <TextInput
                      accessibilityLabel="결제수단 이름 수정"
                      maxLength={80}
                      onChangeText={setEditingLabel}
                      style={{
                        backgroundColor: theme.colors.beige,
                        borderRadius: theme.radii.small,
                        color: theme.colors.brown,
                        minHeight: theme.touchTarget,
                        paddingHorizontal: 14
                      }}
                      value={editingLabel}
                    />
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      <Pressable disabled={!editingLabel.trim() || update.isPending} onPress={() => update.mutate()}>
                        <Text style={{ color: theme.colors.mainCoral, fontWeight: "700" }}>저장</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditingId(null)}>
                        <Text style={{ color: theme.colors.gray600, fontWeight: "700" }}>취소</Text>
                      </Pressable>
                    </View>
                    {isPixelEvidence && evidenceId === "PAY-002" ? (
                      <Toast message="카드번호·계좌번호 같은 민감정보는 저장할 수 없어요." tone="error" />
                    ) : null}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ gap: 3 }}>
                      <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{method.label}</Text>
                      <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
                        {paymentTypes.find((entry) => entry.value === method.type)?.label ?? "미지정"}
                        {method.isDefault ? " · 기본" : ""}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => {
                          setEditingId(method.id);
                          setEditingLabel(method.label);
                          setEditingType(method.type);
                        }}
                      >
                        <Text style={{ color: theme.colors.mainCoral, fontWeight: "700" }}>수정</Text>
                      </Pressable>
                      {!method.isDefault ? (
                        <Pressable onPress={() => makeDefault.mutate(method.id)}>
                          <Text style={{ color: theme.colors.mainCoral, fontWeight: "700" }}>기본</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          Alert.alert("결제수단을 숨길까요?", "과거 지출의 결제수단 표시는 유지돼요.", [
                            { text: "취소", style: "cancel" },
                            { text: "숨기기", style: "destructive", onPress: () => deactivate.mutate(method.id) }
                          ])
                        }
                      >
                        <Text style={{ color: theme.colors.danger, fontWeight: "700" }}>숨기기</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
          {inactive.length > 0 ? (
            <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>숨긴 결제수단 {inactive.length}개 · 과거 기록 연결은 유지돼요.</Text>
          ) : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>결제수단 추가</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {paymentTypes.map((entry) => (
              <CategoryChip key={entry.value} label={entry.label} selected={type === entry.value} onPress={() => setType(entry.value)} />
            ))}
          </View>
          <TextInput
            accessibilityLabel="결제수단 이름"
            maxLength={80}
            onChangeText={setLabel}
            placeholder="예: 생활비 카드"
            style={{
              backgroundColor: theme.colors.beige,
              borderRadius: theme.radii.small,
              color: theme.colors.brown,
              minHeight: theme.touchTarget,
              paddingHorizontal: 14
            }}
            value={label}
          />
          <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>카드번호와 계좌번호는 입력하지 마세요.</Text>
          {create.isError ? <Toast message="이름을 확인하고 다시 시도해 주세요." tone="error" /> : null}
          <PrimaryButton disabled={!token || !label.trim() || create.isPending} label="결제수단 추가" onPress={() => create.mutate()} />
        </Card>

        <SecondaryButton label="설정으로 돌아가기" onPress={() => router.back()} />
      </View>
    </AppScreen>
  );
}
