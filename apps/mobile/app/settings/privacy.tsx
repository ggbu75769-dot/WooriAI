import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, Pressable, ScrollView, View } from "react-native";
import {
  confirmAccountDeletion,
  confirmChildProfileDeletion,
  getPrivacySettings,
  previewAccountDeletion,
  previewChildProfileDeletion,
  previewHouseholdLeave,
  type SettingsPreview
} from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

function PreviewBox({ preview }: { preview?: SettingsPreview }) {
  if (!preview) return null;
  return (
    <View style={{ backgroundColor: theme.colors.primary100, borderRadius: 8, gap: 6, padding: 14 }}>
      <Text style={{ fontWeight: "700" }}>{preview.flowId}</Text>
      <Text>requiresSecondStep: {preview.requiresSecondStep ? "yes" : "no"}</Text>
      <Text>Type {preview.confirmationText} to confirm.</Text>
      {preview.impact.map((line) => (
        <Text key={line} style={{ color: theme.colors.textSecondary }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const clearSession = useSessionStore((state) => state.clearSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  const queryClient = useQueryClient();
  const privacy = useQuery({
    queryKey: ["privacy-settings"],
    enabled: Boolean(accessToken),
    queryFn: () => getPrivacySettings(accessToken!)
  });
  const childPreview = useMutation({
    mutationFn: () => previewChildProfileDeletion(accessToken!, childId!)
  });
  const childDelete = useMutation({
    mutationFn: () => confirmChildProfileDeletion(accessToken!, childId!, "DELETE CHILD"),
    onSuccess: async () => {
      clearChild();
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });
  const householdPreview = useMutation({
    mutationFn: () => previewHouseholdLeave(accessToken!, householdId!)
  });
  const accountPreview = useMutation({
    mutationFn: () => previewAccountDeletion(accessToken!)
  });
  const accountDelete = useMutation({
    mutationFn: () => confirmAccountDeletion(accessToken!, "DELETE ACCOUNT"),
    onSuccess: () => clearSession()
  });

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <View style={{ gap: 14, padding: 24 }}>
        <Text style={{ color: theme.colors.textSecondary }}>SET-003 / SET-004</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          Privacy and deletion
        </Text>
        {(privacy.data?.flows ?? []).map((flow) => (
          <View key={flow.id} style={{ backgroundColor: theme.colors.surface, borderRadius: 8, gap: 6, padding: 14 }}>
            <Text style={{ fontWeight: "700" }}>{flow.title}</Text>
            <Text>{flow.confirmationText}</Text>
          </View>
        ))}

        <Pressable onPress={() => childPreview.mutate()} disabled={!accessToken || !childId}>
          <Text>Preview child profile deletion</Text>
        </Pressable>
        <PreviewBox preview={childPreview.data} />
        <Pressable onPress={() => childDelete.mutate()} disabled={!childPreview.data}>
          <Text style={{ color: theme.colors.danger }}>Confirm child profile deletion</Text>
        </Pressable>

        <Pressable onPress={() => householdPreview.mutate()} disabled={!accessToken || !householdId}>
          <Text>Preview household leave</Text>
        </Pressable>
        <PreviewBox preview={householdPreview.data} />

        <Pressable onPress={() => accountPreview.mutate()} disabled={!accessToken}>
          <Text>Preview account deletion</Text>
        </Pressable>
        <PreviewBox preview={accountPreview.data} />
        <Pressable onPress={() => accountDelete.mutate()} disabled={!accountPreview.data}>
          <Text style={{ color: theme.colors.danger }}>Confirm account deletion</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
