import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, router } from "expo-router";
import { Pressable, TextInput, View } from "react-native";
import { KoreanText as Text } from "../src/design-system/components/KoreanText";
import { applyCustomBundle, createCustomBundle, fixtureSessionToken, listCatalogItems, listCustomBundles } from "../src/api/client";
import { householdIdForFeatureScope, useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, SampleDataBanner, ScreenHeader, SecondaryButton } from "../src/ui";
import { theme } from "../src/theme";
import { useState } from "react";

export default function CustomBundlesScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const householdId = householdIdForFeatureScope(
    childId,
    selectedChildHouseholdId,
    defaultHouseholdId,
    isTestSession
  );
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const bundles = useQuery({ queryKey: ["custom-bundles", householdId], enabled: Boolean(token && householdId), queryFn: () => listCustomBundles(token!, householdId!) });
  const catalog = useQuery({ queryKey: ["custom-bundle-catalog"], enabled: Boolean(token && !isTestSession), queryFn: () => listCatalogItems(token!, { limit: 8 }) });
  const create = useMutation({ mutationFn: () => createCustomBundle(token!, householdId!, { title: title.trim(), scopeType: "child", items: selected.map((itemDefinitionId) => ({ itemDefinitionId, defaultQuantity: 1 })) }), onSuccess: () => { setTitle(""); setSelected([]); void queryClient.invalidateQueries({ queryKey: ["custom-bundles", householdId] }); } });
  const apply = useMutation({ mutationFn: (bundle: { id: string; version: number }) => applyCustomBundle(token!, householdId!, bundle.id, { childId: childId!, expectedVersion: bundle.version, idempotencyKey: Crypto.randomUUID() }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["home", childId] }) });
  if (!token || !householdId || !childId) return <Redirect href="/onboarding/child-status" />;
  return (
    <AppScreen>
      {isTestSession ? <SampleDataBanner /> : null}
      <ScreenHeader eyebrow="반복 준비 저장" onBack={() => router.back()} title="사용자 정의 묶음" subtitle="기존 준비 상태는 덮어쓰지 않아요." />
      {isTestSession ? (
        <Card>
          <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>
            테스트 모드에서는 저장된 묶음만 확인할 수 있어요. 묶음 생성과 적용은 실제 계정에서 사용할 수 있어요.
          </Text>
        </Card>
      ) : <Card>
        <TextInput accessibilityLabel="묶음 이름" placeholder="예: 여름 외출 준비" value={title} onChangeText={setTitle} style={inputStyle} />
        <View style={{ gap: 8 }}>{catalog.data?.items.map((item) => {
          const active = selected.includes(item.id);
          return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => setSelected((values) => active ? values.filter((id) => id !== item.id) : [...values, item.id])} style={choiceStyle(active)}><Text style={{ color: theme.colors.brown, flex: 1 }}>{item.nameKo}</Text><Text>{active ? "선택됨" : "선택"}</Text></Pressable>;
        })}</View>
        <PrimaryButton label={create.isPending ? "저장 중" : "묶음 저장"} disabled={!title.trim() || selected.length === 0 || create.isPending} onPress={() => create.mutate()} />
      </Card>}
      {bundles.data?.bundles.length === 0 ? <EmptyStateCard title="저장한 묶음이 없어요" actionLabel={isTestSession ? "실제 계정에서 묶음을 만들 수 있어요" : "위에서 첫 묶음을 만들어 보세요"} /> : null}
      {bundles.data?.bundles.map((bundle) => <Card key={bundle.id}><Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{bundle.title}</Text><Text style={{ color: theme.colors.gray600 }}>{bundle.items.length}개 준비 항목 · 버전 {bundle.version}</Text><SecondaryButton label="이 아이에게 적용" disabled={apply.isPending} onPress={() => apply.mutate(bundle)} /></Card>)}
    </AppScreen>
  );
}

const inputStyle = { borderColor: theme.colors.gray300, borderRadius: 12, borderWidth: 1, color: theme.colors.brown, minHeight: 48, paddingHorizontal: 12 } as const;
const choiceStyle = (active: boolean) => ({ alignItems: "center", backgroundColor: active ? theme.colors.coral[50] : theme.colors.white, borderColor: active ? theme.colors.coral[600] : theme.colors.gray300, borderRadius: 12, borderWidth: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 12 } as const);
