import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

export default function SettingsScreen() {
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 14, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>SET-001 / SET-002</Text>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" }}>Settings</Text>
      <View style={{ backgroundColor: theme.colors.surface, borderRadius: 8, gap: 6, padding: 14 }}>
        <Text>Household: {householdId ?? "not selected"}</Text>
        <Text>Child profile: {childId ?? "not selected"}</Text>
      </View>
      <Pressable
        onPress={() => router.push("/settings/privacy")}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.primary500,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ fontWeight: "700" }}>Privacy and deletion</Text>
      </Pressable>
    </View>
  );
}
