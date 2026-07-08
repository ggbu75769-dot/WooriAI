import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { acceptInvite, getInvite } from "../../../src/api/client";
import { useSessionStore } from "../../../src/stores/session.store";
import { theme } from "../../../src/theme";

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = String(params.token ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const invite = useQuery({
    queryKey: ["invite", token],
    enabled: Boolean(token),
    queryFn: () => getInvite(token)
  });
  const accept = useMutation({
    mutationFn: () => acceptInvite(accessToken!, token),
    onSuccess: (result) => {
      useSessionStore.setState({ defaultHouseholdId: result.household.id });
      router.replace("/(tabs)");
    }
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 14, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>FAM-003</Text>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>초대 수락</Text>
      {invite.data ? (
        <>
          <Text>{invite.data.householdName}</Text>
          <Text>{invite.data.role}</Text>
          <Text>만료 {invite.data.expiresAt}</Text>
        </>
      ) : (
        <Text>{invite.isLoading ? "불러오는 중" : "초대 정보를 불러오지 못했어요."}</Text>
      )}
      <Pressable
        onPress={() => accept.mutate()}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.primary500,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ fontWeight: "700" }}>가족에 참여하기</Text>
      </Pressable>
    </View>
  );
}
