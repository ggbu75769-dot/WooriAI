import { useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
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
import {
  beginReceiptOperation,
  captureReceiptOperationOwner,
  receiptOperationOwnerIsActive
} from "../../src/receipts/operation-owner";
import { RemoteSyncCancelledError } from "../../src/offline/errors";
import {
  householdIdForSelectedChildScope,
  useSelectedChildStore
} from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, DateField, EmptyStateCard, FormField, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/design-system";
import { EXPENSE_AMOUNT_MAX_DIGITS, formatExpenseAmountInput, sanitizeExpenseAmountText, validateExpenseForm } from "../../src/expenses/form-contract";
import { theme } from "../../src/theme";
import { useEffect, useState } from "react";

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function isReceiptOperationCancellation(error: unknown): boolean {
  return (
    error instanceof RemoteSyncCancelledError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

class ReceiptFileSizeError extends Error {}

export default function ReceiptDraftScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const receiptHouseholdId = householdIdForSelectedChildScope(
    childId,
    selectedChildHouseholdId,
    defaultHouseholdId
  );
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const scopeKey = resolveOfflineScopeKey({
    accessToken,
    userId,
    defaultHouseholdId: receiptHouseholdId,
    isTestSession
  });
  const [draft, setDraft] = useState<ReceiptOfflineDraft | null>(null);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(getSeoulToday());
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState(categoryCatalog[0]!.id);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
    if (!scopeKey) {
      setItemName("");
      setAmount("");
      setMerchant("");
      return;
    }
    const owner = captureReceiptOperationOwner(token, scopeKey, childId);
    if (!owner) return;
    const operation = beginReceiptOperation(owner);
    void readReceiptOfflineDraft(scopeKey)
      .then((restored) => {
        operation.assertActive();
        if (!restored || restored.childId !== childId) return;
        setDraft(restored);
        setItemName(restored.form.itemName);
        setAmount(restored.form.amount);
        setSpentOn(restored.form.spentOn);
        setMerchant(restored.form.merchant);
        setCategoryId(restored.form.categoryId);
        if (!restored.serverDraft) setMessage("저장된 영수증 초안이 있어요. 연결 후 다시 업로드해 주세요.");
      })
      .catch(() => undefined)
      .finally(operation.release);
    return operation.release;
  }, [childId, scopeKey, token]);

  useEffect(() => {
    if (!draft || !scopeKey || !childId) return;
    if (draft.scopeKey !== scopeKey || draft.childId !== childId) return;
    const persisted = updateReceiptOfflineDraft(draft, {
      form: { itemName, amount, spentOn, merchant, categoryId },
      updatedAt: new Date().toISOString()
    });
    const timer = setTimeout(() => {
      const owner = captureReceiptOperationOwner(token, scopeKey, childId);
      if (!owner) return;
      const operation = beginReceiptOperation(owner);
      void writeReceiptOfflineDraft(persisted, undefined, {
        assertActive: operation.assertActive
      }).catch(() => undefined).finally(operation.release);
    }, 150);
    return () => clearTimeout(timer);
  }, [amount, categoryId, childId, draft, itemName, merchant, scopeKey, spentOn, token]);

  const upload = useMutation({
    mutationFn: async (candidate: ReceiptOfflineDraft) => {
      const owner = captureReceiptOperationOwner(token, scopeKey, childId);
      if (!owner || candidate.scopeKey !== owner.scopeKey || candidate.childId !== owner.childId) {
        throw new RemoteSyncCancelledError();
      }
      const operation = beginReceiptOperation(owner);
      try {
        operation.assertActive();
        const result = await createReceiptDraft(owner.token, {
          childId: candidate.childId,
          contentHash: candidate.contentHash,
          fileName: candidate.fileName,
          mimeType: candidate.mimeType,
          fileSizeBytes: candidate.fileSizeBytes
        }, operation.signal);
        operation.assertActive();
        return { result, owner };
      } finally {
        operation.release();
      }
    },
    onSuccess: ({ result, owner }, candidate) => {
      if (!receiptOperationOwnerIsActive(owner)) return;
      setDraft((current) => {
        if (!current || current.localId !== candidate.localId) return current;
        const uploaded = updateReceiptOfflineDraft(current, {
          uploadState: "review_ready",
          serverDraft: { id: result.draft.id, version: result.draft.version },
          updatedAt: new Date().toISOString()
        });
        const activeOwner = captureReceiptOperationOwner(token, scopeKey, childId);
        if (!activeOwner) return current;
        const operation = beginReceiptOperation(activeOwner);
        void writeReceiptOfflineDraft(uploaded, undefined, {
          assertActive: operation.assertActive
        }).catch(() => undefined).finally(operation.release);
        return uploaded;
      });
      setMessage(result.providerMode === "EXTERNAL_BLOCKED" ? "자동 인식 연결 전이라 주요 값을 직접 확인해 주세요." : null);
    },
    onError: (error, candidate) => {
      if (isReceiptOperationCancellation(error)) return;
      const owner = captureReceiptOperationOwner(token, scopeKey, childId);
      if (!owner || candidate.scopeKey !== owner.scopeKey || candidate.childId !== owner.childId) return;
      setDraft((current) => {
        if (!current || current.localId !== candidate.localId) return current;
        const failed = updateReceiptOfflineDraft(current, { uploadState: "failed", updatedAt: new Date().toISOString() });
        const operation = beginReceiptOperation(owner);
        void writeReceiptOfflineDraft(failed, undefined, {
          assertActive: operation.assertActive
        }).catch(() => undefined).finally(operation.release);
        return failed;
      });
      setMessage("초안은 이 계정과 가족에 저장했어요. 연결 후 다시 업로드해 주세요.");
    }
  });

  const pick = useMutation({ mutationFn: async () => {
    const owner = captureReceiptOperationOwner(token, scopeKey, childId);
    if (!owner) throw new RemoteSyncCancelledError();
    const operation = beginReceiptOperation(owner);
    try {
      operation.assertActive();
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "application/pdf"], copyToCacheDirectory: true });
      operation.assertActive();
      if (result.canceled || !result.assets[0]) return null;
      const asset = result.assets[0];
      const size = asset.size ?? 0;
      if (!size || size > 15 * 1024 * 1024) throw new ReceiptFileSizeError();
      const bytes = await (await fetch(asset.uri, { signal: operation.signal })).arrayBuffer();
      operation.assertActive();
      const contentHash = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes)));
      operation.assertActive();
      const mimeType = asset.mimeType === "image/jpeg" || asset.mimeType === "image/png" || asset.mimeType === "application/pdf"
        ? asset.mimeType
        : "application/pdf";
      const localDraft = createReceiptOfflineDraft({
        scopeKey: owner.scopeKey,
        localId: Crypto.randomUUID(),
        childId: owner.childId,
        assetUri: asset.uri,
        fileName: asset.name,
        mimeType,
        fileSizeBytes: size,
        contentHash,
        confirmationIdempotencyKey: Crypto.randomUUID(),
        form: { itemName: "", amount: "", spentOn: getSeoulToday(), merchant: "", categoryId: categoryCatalog[0]!.id },
        updatedAt: new Date().toISOString()
      });
      await writeReceiptOfflineDraft(localDraft, undefined, {
        assertActive: operation.assertActive
      });
      operation.assertActive();
      return { draft: localDraft, owner };
    } finally {
      operation.release();
    }
  }, onSuccess: (result) => {
    if (!result || !receiptOperationOwnerIsActive(result.owner)) return;
    setDraft(result.draft);
    setItemName("");
    setAmount("");
    setSpentOn(result.draft.form.spentOn);
    setMerchant("");
    setCategoryId(result.draft.form.categoryId);
    upload.mutate(result.draft);
  }, onError: (error) => {
    if (isReceiptOperationCancellation(error)) return;
    setMessage(error instanceof ReceiptFileSizeError ? "영수증 파일은 15MB 이하만 선택할 수 있어요." : "파일을 확인하지 못했어요.");
  } });
  const confirm = useMutation({
    mutationFn: async () => {
      const owner = captureReceiptOperationOwner(token, scopeKey, childId);
      if (
        !owner ||
        !draft ||
        draft.scopeKey !== owner.scopeKey ||
        draft.childId !== owner.childId ||
        !draft.serverDraft
      ) {
        throw new RemoteSyncCancelledError();
      }
      const operation = beginReceiptOperation(owner);
      try {
        operation.assertActive();
        const serverDraftId = draft.serverDraft.id;
        const current = updateReceiptOfflineDraft(draft, {
          form: { itemName, amount, spentOn, merchant, categoryId },
          updatedAt: new Date().toISOString()
        });
        const result = await confirmReceiptDraft(
          owner.token,
          serverDraftId,
          toReceiptConfirmationInput(current),
          operation.signal
        );
        operation.assertActive();
        return { result, owner };
      } finally {
        operation.release();
      }
    },
    onSuccess: async ({ result, owner }) => {
      if (!receiptOperationOwnerIsActive(owner)) return;
      // Cancel the persistence effect before deleting the stored draft. Without
      // clearing local state first, an already-scheduled debounce can recreate
      // the draft after a successful confirmation.
      setDraft(null);
      await clearReceiptOfflineDraft(owner.scopeKey);
      if (!receiptOperationOwnerIsActive(owner)) return;
      router.replace({ pathname: "/expenses/[expenseId]", params: { expenseId: result.expenseId } });
    },
    onError: (error) => {
      if (isReceiptOperationCancellation(error)) return;
      setMessage("입력값과 연결 상태를 확인한 뒤 다시 저장해 주세요. 같은 요청은 중복 지출을 만들지 않아요.");
    }
  });
  if (!token || !childId || (!isTestSession && !scopeKey)) return <Redirect href="/onboarding/child-status" />;
  if (isTestSession) return <AppScreen><ScreenHeader onBack={() => router.back()} title="영수증 빠른 입력" /><EmptyStateCard title="현재 영수증을 저장할 수 없어요." actionLabel="직접 지출을 입력해 주세요" /></AppScreen>;
  const receiptValidation = validateExpenseForm({ itemName, amountText: amount, spentOn });
  const canConfirm = Boolean(draft?.serverDraft && receiptValidation.valid);
  return (
    <AppScreen>
      <ScreenHeader eyebrow="확인 후 저장" onBack={() => router.back()} title="영수증 빠른 입력" subtitle="사용자가 최종 확인하기 전에는 지출이 생성되지 않아요." />
      <Card>
        <Text style={{ color: theme.colors.brown, fontWeight: "800" }}>{draft?.fileName ?? "영수증 이미지 또는 PDF를 선택해 주세요"}</Text>
        <SecondaryButton label={pick.isPending ? "파일 확인 중" : "영수증 선택"} disabled={pick.isPending || upload.isPending || confirm.isPending} onPress={() => pick.mutate()} />
        {draft && !draft.serverDraft ? <SecondaryButton label={upload.isPending ? "업로드 중" : "저장된 초안 다시 업로드"} disabled={upload.isPending || confirm.isPending} onPress={() => upload.mutate(draft)} /> : null}
        {draft ? (
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 19 }}>
            {upload.isPending ? "영수증 초안을 확인하고 있어요." : draft.serverDraft ? "초안 준비 완료 · 아래 내용을 확인해 주세요." : "기기에 안전하게 저장됨 · 연결 후 다시 업로드할 수 있어요."}
          </Text>
        ) : null}
      </Card>
      {draft?.serverDraft ? <Card>
        <FormField error={receiptValidation.itemNameError} label="지출 항목" maxLength={100} onChangeText={setItemName} placeholder="예: 기저귀" value={itemName} />
        <View style={{ gap: 6 }}>
          <FormField
            error={receiptValidation.amountError}
            keyboardType="number-pad"
            label="금액"
            maxLength={EXPENSE_AMOUNT_MAX_DIGITS}
            onChangeText={(value) => setAmount(sanitizeExpenseAmountText(value).slice(0, EXPENSE_AMOUNT_MAX_DIGITS))}
            placeholder="0"
            value={amount}
          />
          {amount && !receiptValidation.amountError ? <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>{formatExpenseAmountInput(amount)}원</Text> : null}
        </View>
        <DateField clearable={false} error={receiptValidation.dateError} label="지출 날짜" onChange={(value) => setSpentOn(value ?? getSeoulToday())} value={spentOn} />
        <FormField label="판매처" maxLength={100} onChangeText={setMerchant} optional placeholder="예: 우리상점" value={merchant} />
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "700" }}>분류</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{categoryCatalog.map((category) => <CategoryChip key={category.id} label={category.label} selected={category.id === categoryId} onPress={() => setCategoryId(category.id)} />)}</View>
        </View>
      </Card> : null}
      {message ? <Text accessibilityRole="alert" style={{ color: theme.colors.gray600 }}>{message}</Text> : null}
      <PrimaryButton label={confirm.isPending ? "저장 중" : "확인하고 지출 저장"} disabled={!canConfirm || confirm.isPending} onPress={() => confirm.mutate()} />
    </AppScreen>
  );
}
