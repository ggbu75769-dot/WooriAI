import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, TextInput, View } from "react-native";
import { KoreanText as Text } from "../src/design-system/components/KoreanText";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  fixtureSessionToken,
  reactivatePaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  type UserPaymentMethod
} from "../src/api/client";
import { useSessionStore } from "../src/stores/session.store";
import { isPixelLockBuild } from "../src/pixelLock/build-profile";
import { useConfirmDiscardChanges } from "../src/navigation/use-confirm-discard-changes";
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

function PaymentMethodAction({ label, accessibilityLabel = label, onPress, disabled = false, danger = false }: { accessibilityLabel?: string; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48, opacity: disabled ? 0.45 : pressed ? 0.68 : 1, paddingHorizontal: 8 })}
    >
      <Text style={{ color: danger ? theme.colors.danger : theme.colors.mainCoral, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

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
  const [feedback, setFeedback] = React.useState<string | null>(null);

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
      setFeedback("결제수단을 추가했어요.");
      await refresh();
    }
  });
  const makeDefault = useMutation({
    mutationFn: (paymentMethodId: string) => setDefaultPaymentMethod(token!, paymentMethodId),
    onSuccess: async () => {
      setFeedback("기본 결제수단을 변경했어요.");
      await refresh();
    }
  });
  const update = useMutation({
    mutationFn: () => updatePaymentMethod(token!, editingId!, { type: editingType, label: editingLabel }),
    onSuccess: async () => {
      setEditingId(null);
      setEditingLabel("");
      setFeedback("결제수단을 수정했어요.");
      await refresh();
    }
  });
  const deactivate = useMutation({
    mutationFn: (paymentMethodId: string) => deactivatePaymentMethod(token!, paymentMethodId),
    onSuccess: async () => {
      setFeedback("결제수단 사용을 중지했어요. 필요하면 다시 사용할 수 있어요.");
      await refresh();
    }
  });
  const reactivate = useMutation({
    mutationFn: (paymentMethodId: string) => reactivatePaymentMethod(token!, paymentMethodId),
    onSuccess: async () => {
      setFeedback("결제수단을 다시 사용할 수 있어요.");
      await refresh();
    }
  });

  const visibleMethods = methods.data?.paymentMethods ?? (isPixelEvidence ? pixelPreviewPaymentMethods : []);
  const active = visibleMethods.filter((method) => method.active);
  const inactive = visibleMethods.filter((method) => !method.active);
  const editingMethod = active.find((method) => method.id === editingId);
  const editingChanged = Boolean(editingMethod && (
    editingLabel.trim() !== editingMethod.label || editingType !== editingMethod.type
  ));
  const hasUnsavedInput = editingChanged || Boolean(label.trim());
  useConfirmDiscardChanges(hasUnsavedInput);
  const methodMutationBusy = update.isPending || makeDefault.isPending || deactivate.isPending || reactivate.isPending;

  return (
    <AppScreen>
      <View accessibilityLabel="PAY-001" testID="screen-PAY-001" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow={isPixelLockBuild() ? evidenceId : "기록 설정"} onBack={() => router.back()} title="결제수단" subtitle="번호는 저장하지 않고 알아보기 쉬운 이름만 관리해요." />

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
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <PaymentMethodAction
                        accessibilityLabel={`${method.label} ${update.isPending ? "저장 중" : editingChanged ? "저장" : "변경 없음"}`}
                        disabled={!editingLabel.trim() || !editingChanged || update.isPending}
                        label={update.isPending ? "저장 중" : editingChanged ? "저장" : "변경 없음"}
                        onPress={() => update.mutate()}
                      />
                      <PaymentMethodAction accessibilityLabel={`${method.label} 수정 취소`} disabled={update.isPending} label="취소" onPress={() => setEditingId(null)} />
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
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, justifyContent: "flex-end" }}>
                      <PaymentMethodAction
                        accessibilityLabel={`${method.label} 수정`}
                        disabled={methodMutationBusy}
                        label="수정"
                        onPress={() => {
                          setEditingId(method.id);
                          setEditingLabel(method.label);
                          setEditingType(method.type);
                        }}
                      />
                      {!method.isDefault ? (
                        <PaymentMethodAction
                          accessibilityLabel={`${method.label} 기본 결제수단으로 설정`}
                          disabled={methodMutationBusy}
                          label={makeDefault.isPending && makeDefault.variables === method.id ? "변경 중" : "기본"}
                          onPress={() => makeDefault.mutate(method.id)}
                        />
                      ) : null}
                      <PaymentMethodAction
                        accessibilityLabel={`${method.label} 사용 중지`}
                        danger
                        disabled={methodMutationBusy}
                        label={deactivate.isPending && deactivate.variables === method.id ? "중지 중" : "사용 중지"}
                        onPress={() =>
                          Alert.alert("결제수단 사용을 중지할까요?", "새 지출에서는 선택할 수 없지만 과거 기록의 표시는 유지돼요. 나중에 다시 사용할 수 있어요.", [
                            { text: "취소", style: "cancel" },
                            { text: "사용 중지", style: "destructive", onPress: () => deactivate.mutate(method.id) }
                          ])
                        }
                      />
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
          {inactive.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>사용 중지한 결제수단 {inactive.length}개 · 과거 기록 연결은 유지돼요.</Text>
              {inactive.map((method) => (
                <View key={method.id} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>{method.label}</Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{paymentTypes.find((entry) => entry.value === method.type)?.label ?? "미지정"}</Text>
                  </View>
                  <PaymentMethodAction
                    accessibilityLabel={`${method.label} 다시 사용`}
                    disabled={methodMutationBusy}
                    label={reactivate.isPending && reactivate.variables === method.id ? "복구 중" : "다시 사용"}
                    onPress={() => reactivate.mutate(method.id)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {feedback ? <Toast message={feedback} tone="success" /> : null}
        {update.isError ? <Toast message="결제수단을 수정하지 못했어요. 다시 시도해 주세요." tone="error" /> : null}
        {makeDefault.isError ? <Toast message="기본 결제수단을 변경하지 못했어요. 다시 시도해 주세요." tone="error" /> : null}
        {deactivate.isError ? <Toast message="결제수단 사용을 중지하지 못했어요. 다시 시도해 주세요." tone="error" /> : null}
        {reactivate.isError ? <Toast message="결제수단을 다시 사용하도록 바꾸지 못했어요. 다시 시도해 주세요." tone="error" /> : null}

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
          <PrimaryButton disabled={!token || !label.trim() || create.isPending} label={create.isPending ? "추가하는 중" : "결제수단 추가"} onPress={() => create.mutate()} />
        </Card>

        <SecondaryButton label="설정으로 돌아가기" onPress={() => router.back()} />
      </View>
    </AppScreen>
  );
}
