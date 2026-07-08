import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { createInvite, type InviteRole } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

const roles: Array<{ role: InviteRole; label: string }> = [
  { role: "co_parent", label: "공동부모" },
  { role: "viewer", label: "보기 전용" },
  { role: "gift_participant", label: "선물 참여" }
];

export default function FamilyInviteScreen() {
  const [role, setRole] = useState<InviteRole>("co_parent");
  const accessToken = useSessionStore((state) => state.accessToken);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const invite = useMutation({
    mutationFn: () => createInvite(accessToken!, householdId!, role, "link")
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 14, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>FAM-002</Text>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>가족 초대</Text>
      {roles.map((option) => (
        <Pressable
          key={option.role}
          onPress={() => setRole(option.role)}
          style={{
            backgroundColor: role === option.role ? theme.colors.primary100 : theme.colors.surface,
            borderRadius: 8,
            padding: 14
          }}
        >
          <Text>{option.label}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => invite.mutate()}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.primary500,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ fontWeight: "700" }}>초대 링크 생성</Text>
      </Pressable>
      {invite.data ? (
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 8, gap: 8, padding: 14 }}>
          <Text>{invite.data.inviteUrl}</Text>
          <Text>만료 {invite.data.expiresAt}</Text>
        </View>
      ) : null}
    </View>
  );
}
