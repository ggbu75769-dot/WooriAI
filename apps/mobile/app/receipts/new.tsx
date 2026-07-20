import { useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { confirmReceiptDraft, createReceiptDraft, fixtureSessionToken } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { resolveOfflineScopeKey } from "../../src/offline/session-scope";
import {
  clearReceiptOfflineDraft,
  createReceiptOfflineDraft,
  readReceiptOfflineDraft,
  type ReceiptOfflineDraft,
  toReceiptConfirmationInput,
  updateReceiptOfflineDraft,
  writeReceiptOfflineDraft
} from "../../src/receipts/offline-draft";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";
import { theme } from "../../src/theme";
import { useEffect, useState } from "react";

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export default function ReceiptDraftScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const scopeKey = resolveOfflineScopeKey({ accessToken, userId, defaultHouseholdId, isTestSession });
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [draft, setDraft] = useState<ReceiptOfflineDraft | null>(null);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(getSeoulToday());
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState(categoryCatalog[0]!.id);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scopeKey) return;
    let cancelled = false;
    void readReceiptOfflineDraft(scopeKey).then((restored) => {
      if (cancelled || !restored) return;
      setDraft(restored);
      setItemName(restored.form.itemName);
      setAmount(restored.form.amount);
      setSpentOn(restored.form.spentOn);
      setMerchant(restored.form.merchant);
      setCategoryId(restored.form.categoryId);
      if (!restored.serverDraft) setMessage("저장된 영수증 초안이 있어요. 연결 후 다시 업로드해 주세요.");
    });
    return () => { cancelled = true; };
  }, [scopeKey]);

  useEffect(() => {
    if (!draft) return;
    const persisted = updateReceiptOfflineDraft(draft, {
      form: { itemName, amount, spentOn, merchant, categoryId },
      updatedAt: new Date().toISOString()
    });
    const timer = setTimeout(() => { void writeReceiptOfflineDraft(persisted); }, 150);
    return () => clearTimeout(timer);
  }, [amount, categoryId, draft, itemName, merchant, spentOn]);

  const upload = useMutation({
    mutationFn: (candidate: ReceiptOfflineDraft) => createReceiptDraft(token!, {
      childId: candidate.childId,
      contentHash: candidate.contentHash,
      fileName: candidate.fileName,
      mimeType: candidate.mimeType,
      fileSizeBytes: candidate.fileSizeBytes
    }),
    onSuccess: (result, candidate) => {
      setDraft((current) => {
        if (!current || current.localId !== candidate.localId) return current;
        const uploaded = updateReceiptOfflineDraft(current, {
          uploadState: "review_ready",
          serverDraft: { id: result.draft.id, version: result.draft.version },
          updatedAt: new Date().toISOString()
        });
        void writeReceiptOfflineDraft(uploaded);
        return uploaded;
      });
      setMessage(result.providerMode === "EXTERNAL_BLOCKED" ? "자동 인식 연결 전이라 주요 값을 직접 확인해 주세요." : null);
    },
    onError: (_error, candidate) => {
      setDraft((current) => {
        if (!current || current.localId !== candidate.localId) return current;
        const failed = updateReceiptOfflineDraft(current, { uploadState: "failed", updatedAt: new Date().toISOString() });
        void writeReceiptOfflineDraft(failed);
        return failed;
      });
      setMessage("초안은 이 계정과 가족에 저장했어요. 연결 후 다시 업로드해 주세요.");
    }
  });

  const pick = useMutation({ mutationFn: async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "application/pdf"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const size = asset.size ?? 0;
    if (!size || size > 15 * 1024 * 1024) throw new Error("영수증 파일은 15MB 이하만 선택할 수 있어요.");
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const contentHash = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes)));
    const mimeType = asset.mimeType === "image/jpeg" || asset.mimeType === "image/png" || asset.mimeType === "application/pdf"
      ? asset.mimeType
      : "application/pdf";
    const localDraft = createReceiptOfflineDraft({
      scopeKey: scopeKey!,
      localId: Crypto.randomUUID(),
      childId: childId!,
      assetUri: asset.uri,
      fileName: asset.name,
      mimeType,
      fileSizeBytes: size,
      contentHash,
      confirmationIdempotencyKey: Crypto.randomUUID(),
      form: { itemName: "", amount: "", spentOn: getSeoulToday(), merchant: "", categoryId: categoryCatalog[0]!.id },
      updatedAt: new Date().toISOString()
    });
    await writeReceiptOfflineDraft(localDraft);
    return localDraft;
  }, onSuccess: (result) => {
    if (!result) return;
    setDraft(result);
    setItemName("");
    setAmount("");
    setSpentOn(result.form.spentOn);
    setMerchant("");
    setCategoryId(result.form.categoryId);
    upload.mutate(result);
  }, onError: (error) => setMessage(error instanceof Error ? error.message : "파일을 확인하지 못했어요.") });
  const confirm = useMutation({
    mutationFn: () => {
      const current = updateReceiptOfflineDraft(draft!, {
        form: { itemName, amount, spentOn, merchant, categoryId },
        updatedAt: new Date().toISOString()
      });
      return confirmReceiptDraft(token!, current.serverDraft!.id, toReceiptConfirmationInput(current));
    },
    onSuccess: ({ expenseId }) => {
      // Cancel the persistence effect before deleting the stored draft. Without
      // clearing local state first, an already-scheduled debounce can recreate
      // the draft after a successful confirmation.
      setDraft(null);
      void clearReceiptOfflineDraft(scopeKey!);
      router.replace(`/expenses/${expenseId}`);
    },
    onError: () => setMessage("입력값과 연결 상태를 확인한 뒤 다시 저장해 주세요. 같은 요청은 중복 지출을 만들지 않아요.")
  });
  if (!token || !childId || (!isTestSession && !scopeKey)) return <Redirect href="/onboarding/child-status" />;
  if (isTestSession) return <AppScreen><ScreenHeader title="영수증 빠른 입력" /><EmptyStateCard title="샘플 계정에서는 영수증을 저장하지 않아요" actionLabel="실제 계정에서 이용해 주세요" /></AppScreen>;
  const canConfirm = Boolean(draft?.serverDraft && itemName.trim() && Number.isInteger(Number(amount)) && Number(amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(spentOn));
  return (
    <AppScreen>
      <ScreenHeader eyebrow="확인 후 저장" title="영수증 빠른 입력" subtitle="사용자가 최종 확인하기 전에는 지출이 생성되지 않아요." />
      <Card>
        <Text style={{ color: theme.colors.brown, fontWeight: "800" }}>{draft?.fileName ?? "영수증 이미지 또는 PDF를 선택해 주세요"}</Text>
        <SecondaryButton label={pick.isPending ? "파일 확인 중" : "영수증 선택"} disabled={pick.isPending || upload.isPending || confirm.isPending} onPress={() => pick.mutate()} />
        {draft && !draft.serverDraft ? <SecondaryButton label={upload.isPending ? "업로드 중" : "저장된 초안 다시 업로드"} disabled={upload.isPending || confirm.isPending} onPress={() => upload.mutate(draft)} /> : null}
      </Card>
      {draft?.serverDraft ? <Card>
        <TextInput accessibilityLabel="지출 항목명" placeholder="지출 항목명" value={itemName} onChangeText={setItemName} style={inputStyle} />
        <TextInput accessibilityLabel="금액" keyboardType="number-pad" placeholder="금액" value={amount} onChangeText={setAmount} style={inputStyle} />
        <TextInput accessibilityLabel="지출 날짜" placeholder="YYYY-MM-DD" value={spentOn} onChangeText={setSpentOn} style={inputStyle} />
        <TextInput accessibilityLabel="판매처" placeholder="판매처(선택)" value={merchant} onChangeText={setMerchant} style={inputStyle} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{categoryCatalog.map((category) => <CategoryChip key={category.id} label={category.label} selected={category.id === categoryId} onPress={() => setCategoryId(category.id)} />)}</View>
      </Card> : null}
      {message ? <Text accessibilityRole="alert" style={{ color: theme.colors.gray600 }}>{message}</Text> : null}
      <PrimaryButton label={confirm.isPending ? "저장 중" : "확인하고 지출 저장"} disabled={!canConfirm || confirm.isPending} onPress={() => confirm.mutate()} />
    </AppScreen>
  );
}

const inputStyle = { borderColor: theme.colors.gray300, borderRadius: 12, borderWidth: 1, color: theme.colors.brown, minHeight: 48, paddingHorizontal: 12 } as const;
