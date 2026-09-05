import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { createExcelImport, fixtureSessionToken } from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { validateImportFile } from "../../src/import-file-validation";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { ExcelPreviewPixelStyles } from "../../src/pixelLock/styles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { AppIcon, SampleDataBanner, type AppIconName } from "../../src/ui";

// No "application/vnd.ms-excel" (.xls): validateImportFile only accepts .csv/.xlsx, so
// offering .xls in the picker would invite a selection that always gets rejected.
const importDocumentPickerTypes = [
  "text/csv",
  "text/comma-separated-values",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const importUploadScreenId = pixelEvidenceId("IMP-003 IMP-001 / IMP-002 / IMP-003");
const isPixelLockMode = isPixelLockBuild();

function excelPreviewPixelFrameStyle() {
  return {
    transform: [
      { translateX: ExcelPreviewPixelStyles.horizontalOffset },
      { translateY: ExcelPreviewPixelStyles.topOffset },
      { scale: ExcelPreviewPixelStyles.scale },
      { scaleY: ExcelPreviewPixelStyles.scaleY }
    ]
  } as const;
}

const excelPreviewRows = [
  { icon: "baby-face-outline", label: "기저귀·위생", amount: "425,000원", percent: "34%", count: "42건", tone: theme.colors.presentation.previewCoral, iconColor: theme.colors.mainCoral },
  { icon: "food-apple-outline", label: "수유·이유식", amount: "298,500원", percent: "24%", count: "31건", tone: theme.colors.presentation.previewYellow, iconColor: theme.colors.warning },
  { icon: "hospital-box-outline", label: "병원·건강", amount: "210,300원", percent: "17%", count: "22건", tone: theme.colors.mint, iconColor: theme.colors.secondary500 },
  { icon: "tshirt-crew-outline", label: "의류·세탁", amount: "156,200원", percent: "13%", count: "18건", tone: theme.colors.presentation.previewGreen, iconColor: theme.colors.success },
  { icon: "toy-brick-outline", label: "장난감·책", amount: "89,700원", percent: "7%", count: "15건", tone: theme.colors.presentation.previewPeach, iconColor: theme.colors.subCoral },
  { icon: "dots-horizontal-circle-outline", label: "기타", amount: "66,000원", percent: "5%", count: "9건", tone: theme.colors.presentation.previewNeutral, iconColor: theme.colors.gray600 }
] satisfies Array<{ icon: AppIconName; label: string; amount: string; percent: string; count: string; tone: string; iconColor: string }>;

function ImportPreviewCategoryRow({ row }: { row: (typeof excelPreviewRows)[number] }) {
  return (
    <View style={[styles.previewRow, { minHeight: ExcelPreviewPixelStyles.rowHeight || 36 }]}>
      <View style={[styles.categoryIcon, { backgroundColor: row.tone }]}>
        <AppIcon color={row.iconColor} name={row.icon} size={17} />
      </View>
      <View style={styles.categoryLabelColumn}>
        <Text style={styles.categoryLabel}>{row.label}</Text>
        <Text style={styles.categorySubLabel}>+ 육아</Text>
      </View>
      <View style={styles.categoryAmountColumn}>
        <Text style={styles.categoryAmount}>{row.amount}</Text>
        <Text style={styles.categorySubLabel}>{row.count}</Text>
      </View>
      <Text style={styles.categoryPercent}>{row.percent}</Text>
    </View>
  );
}

export default function ImportUploadScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (asset: DocumentPicker.DocumentPickerAsset) =>
      createExcelImport(authToken!, childId!, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType }),
    onSuccess: (job) => {
      router.push(`/import/${job.id}`);
    }
  });
  const canUpload = Boolean(authToken && childId);
  const showPixelPreview = isPixelLockMode && !canUpload;

  if (!canUpload && !isPixelLockMode) {
    return <Redirect href="/onboarding/child-status" />;
  }
  const pickAndUpload = async () => {
    setValidationMessage(null);
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: importDocumentPickerTypes,
        copyToCacheDirectory: true
      });
    } catch {
      // The system picker can throw (e.g. no document provider available); surface it as a
      // user-facing message instead of an unhandled rejection.
      setValidationMessage("파일 선택 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    const validation = validateImportFile(asset.name, asset.size);
    if (!validation.ok) {
      setValidationMessage(validation.message);
      return;
    }
    setSelectedFileName(asset.name);
    upload.mutate(asset);
  };
  const applyPreview = () => {
    if (canUpload) {
      pickAndUpload();
    }
  };

  return (
    <View accessibilityLabel={importUploadScreenId} style={[styles.screen, isPixelLockMode ? { paddingHorizontal: ExcelPreviewPixelStyles.screenPadding } : undefined, isPixelLockMode ? excelPreviewPixelFrameStyle() : undefined]}>
      {isTestSession ? <SampleDataBanner /> : null}
      <View style={styles.navigationBar}>
        <Pressable accessibilityLabel="뒤로" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name="chevron-left" size={isPixelLockMode ? 22 : 26} />
        </Pressable>
        <Text style={styles.navigationTitle}>엑셀 업로드</Text>
        <View style={styles.backButton} />
      </View>

      {showPixelPreview || selectedFileName ? <View style={excelUploadedFileCardStyle()}>
        <View style={[styles.fileIcon, showPixelPreview ? { backgroundColor: theme.colors.mint } : undefined]}>
          <AppIcon color={showPixelPreview ? theme.colors.success : theme.colors.mainCoral} name="file-excel-outline" size={22} />
        </View>
        <View style={styles.fileTextColumn}>
          <Text style={styles.fileName}>{selectedFileName ?? "5월 지출내역.xlsx"}</Text>
          <Text style={styles.fileStatus}>{selectedFileName ? "분석 중" : "업로드 완료"}</Text>
        </View>
        <View style={styles.fileCheck}>
          <AppIcon color={theme.colors.white} name="check" size={18} />
        </View>
      </View> : null}

      {showPixelPreview ? <View accessibilityLabel="검수 후 승인하기 전까지는 지출로 저장되지 않아요." style={[styles.previewCard, { borderRadius: ExcelPreviewPixelStyles.cardRadius }]}>
        <Text style={styles.previewTitle}>AI 분류 미리보기</Text>
        <View style={styles.previewSummary}>
          <Text style={styles.previewSummaryLabel}>총 128건</Text>
          <Text style={styles.previewSummaryAmount}>1,245,700원</Text>
        </View>
        {excelPreviewRows.map((row) => (
          <ImportPreviewCategoryRow key={row.label} row={row} />
        ))}
      </View> : (
        <View style={[styles.previewCard, { borderRadius: ExcelPreviewPixelStyles.cardRadius, marginTop: 34 }]}>
          <AppIcon color={theme.colors.coral[600]} name="file-table-outline" size={36} />
          <Text style={styles.previewTitle}>엑셀 또는 CSV 파일을 선택해 주세요.</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
            분석 결과를 미리 확인하고 승인하기 전에는 지출로 저장하지 않아요.
          </Text>
        </View>
      )}

      <View style={styles.footerSpacer} />
      <Pressable
        accessibilityLabel={upload.isPending ? "파일 분석 중" : "엑셀 또는 CSV 파일 선택"}
        accessibilityRole="button"
        accessibilityState={{ busy: upload.isPending, disabled: upload.isPending }}
        disabled={upload.isPending}
        onPress={applyPreview}
        style={({ pressed }) => [styles.applyButton, showPixelPreview ? { backgroundColor: theme.colors.coral[400] } : undefined, { bottom: 20 + ExcelPreviewPixelStyles.ctaBottomInset, height: ExcelPreviewPixelStyles.ctaHeight, opacity: pressed || upload.isPending ? 0.82 : 1 }]}
      >
        <Text style={styles.applyButtonText}>
          {upload.isPending ? "분석 중..." : canUpload ? "엑셀 파일 선택하기" : "적용하고 리포트 보기"}
        </Text>
      </Pressable>
      {validationMessage ? <Text style={{ color: theme.colors.danger }}>{validationMessage}</Text> : null}
      {upload.error ? (
        <Text style={{ color: theme.colors.danger }}>업로드하지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
      ) : null}
    </View>
  );
}

function excelUploadedFileCardStyle() {
  return {
    alignItems: "center" as const,
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: ExcelPreviewPixelStyles.cardRadius,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 34,
    padding: 14,
    ...theme.shadows.card
  };
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.presentation.importCanvas,
    flex: 1,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 8
  },
  navigationBar: {
    alignItems: "center",
    flexDirection: "row",
    height: 46,
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48
  },
  backIcon: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 32
  },
  navigationTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800"
  },
  fileIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.mint,
    borderRadius: 10,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  fileIconText: {
    color: theme.colors.secondary500,
    fontSize: 17,
    fontWeight: "900"
  },
  fileTextColumn: {
    flex: 1,
    gap: 4
  },
  fileName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800"
  },
  fileStatus: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  fileCheck: {
    alignItems: "center",
    backgroundColor: theme.colors.success,
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  fileCheckText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "900"
  },
  previewCard: {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 22,
    overflow: "hidden",
    padding: 15,
    ...theme.shadows.card
  },
  previewTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4
  },
  previewSummary: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  previewSummaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  previewSummaryAmount: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  previewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  categoryIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  categoryLabelColumn: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  categoryLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "800"
  },
  categorySubLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "600"
  },
  categoryAmountColumn: {
    alignItems: "flex-end",
    gap: 2,
    width: 72
  },
  categoryAmount: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "900"
  },
  categoryPercent: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    width: 28
  },
  footerSpacer: {
    height: 86
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: theme.colors.mainCoral,
    borderRadius: 16,
    bottom: 20,
    height: theme.ctaHeight,
    justifyContent: "center",
    left: 20,
    position: "absolute",
    right: 20
  },
  applyButtonText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "900"
  }
});
