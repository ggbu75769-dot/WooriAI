import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createExcelImport, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import {
  IMPORT_UPLOAD_GUIDE_TEXT,
  IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE,
  IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE,
  importUploadFileStatusText,
  importUploadPhase
} from "../../src/import/upload-copy";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { validateImportFile } from "../../src/import-file-validation";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { ExcelPreviewPixelStyles } from "../../src/pixelLock/styles";

// No "application/vnd.ms-excel" (.xls): validateImportFile only accepts .csv/.xlsx, so
// offering .xls in the picker would invite a selection that always gets rejected.
const importDocumentPickerTypes = [
  "text/csv",
  "text/comma-separated-values",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const importUploadScreenId = "pixel-screen-IMP-003 IMP-001 / IMP-002 / IMP-003";

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
  { icon: "♥", label: "기저귀/위생", amount: "₩425,000", percent: "34%", count: "42건", tone: "#FFF0EA", iconColor: theme.colors.mainCoral },
  { icon: "🍴", label: "식비/간식", amount: "₩298,500", percent: "24%", count: "31건", tone: "#FFF5D7", iconColor: theme.colors.warning },
  { icon: "▣", label: "분유/유제품", amount: "₩210,300", percent: "17%", count: "22건", tone: theme.colors.mint, iconColor: theme.colors.secondary500 },
  { icon: "◆", label: "의류/잡화", amount: "₩156,200", percent: "13%", count: "18건", tone: "#EAF7F2", iconColor: theme.colors.success },
  { icon: "✿", label: "장난감/도서", amount: "₩89,700", percent: "7%", count: "15건", tone: "#FFECE6", iconColor: theme.colors.subCoral },
  { icon: "●", label: "기타", amount: "₩66,000", percent: "5%", count: "9건", tone: "#ECECEC", iconColor: theme.colors.gray600 }
];

function ImportPreviewCategoryRow({ row }: { row: (typeof excelPreviewRows)[number] }) {
  return (
    <View style={[styles.previewRow, { minHeight: ExcelPreviewPixelStyles.rowHeight || 36 }]}>
      <View style={[styles.categoryIcon, { backgroundColor: row.tone }]}>
        <Text style={{ color: row.iconColor, fontSize: 13, fontWeight: "800" }}>{row.icon}</Text>
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
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  // 라운드 40 J-6: 가져오기는 지출을 만드는 경로라 다른 진입점과 같은 판정을 쓴다.
  const expenseGate = useExpenseEntryGate();
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
      // 라운드 40 J-6: 업로드 자체가 서버에서 편집 권한을 요구한다(import-pipeline.service.ts의
      // `createImportJob` → `requireChildAccess(user, childId, true)`). 확정 단계에서야 막으면
      // 파일 고르기·분석 대기·수백 행 검수가 통째로 버려지므로, 첫 걸음에서 사실을 말한다.
      // 잠금은 실세션 + 보기 전용 역할에서만 참이라, 비로그인 IMP-003 경로(canUpload === false)는
      // 이 분기에 아예 오지 않는다 -- 픽셀락 캡처는 한 글자도 바뀌지 않는다.
      if (expenseGate.locked) {
        expenseGate.explain();
        return;
      }
      pickAndUpload();
      return;
    }
    // 라운드 41 UX-S: 예전에는 여기서 아무 일도 하지 않아 비로그인 상태의 CTA가 **눌러도
    // 무반응**이었다. Alert은 렌더 트리를 바꾸지 않으므로(정지 화면을 찍는 IMP-003 픽셀락 캡처에
    // 잡히지 않는다) 화면은 한 글자도 그대로 두고 막힌 길만 말해 준다.
    Alert.alert(IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE, IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE);
  };

  // 라운드 41 UX-S: 목업(가짜 파일 카드 + "총 128건 · ₩1,245,700" 분류 미리보기)은 **비로그인
  // 경로 전용**이다. 그 경로가 곧 IMP-003 픽셀락 캡처 경로이므로(app/pixel-lock.tsx가 세션을 지운
  // 뒤 /import로 보낸다) 캡처 화면은 예전과 완전히 동일하고, 로그인 사용자에게는 내 데이터가
  // 아닌 숫자를 사실처럼 보여 주지 않는다.
  const showPreviewMockup = !canUpload;
  const showFileCard = showPreviewMockup || Boolean(selectedFileName);
  const uploadPhase = importUploadPhase({ isUploading: upload.isPending, hasError: Boolean(upload.error) });

  return (
    <View testID={importUploadScreenId} style={[styles.screen, { paddingHorizontal: ExcelPreviewPixelStyles.screenPadding }, excelPreviewPixelFrameStyle()]}>
      <View style={styles.navigationBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" hitSlop={6} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.navigationTitle}>엑셀 업로드</Text>
        <View style={styles.backButton} />
      </View>

      {/* A11Y-117: 목업 파일 카드("5월 지출내역.xlsx / 업로드 완료")는 장식이므로 TalkBack에서
          통째로 숨긴다. 라운드 41 UX-S: 로그인 사용자에게는 이 카드가 **파일을 고른 뒤에만**
          나오고, 그때는 진짜 파일명과 진짜 진행 상태를 말하므로 접근성 트리에도 그대로 노출한다. */}
      {showFileCard ? (
        <View
          accessibilityElementsHidden={showPreviewMockup ? true : undefined}
          importantForAccessibility={showPreviewMockup ? "no-hide-descendants" : "auto"}
          style={excelUploadedFileCardStyle()}
        >
          <View accessible={false} style={styles.fileIcon}>
            <Text accessible={false} style={styles.fileIconText}>▣</Text>
          </View>
          <View style={styles.fileTextColumn}>
            <Text style={styles.fileName}>{showPreviewMockup ? "5월 지출내역.xlsx" : selectedFileName}</Text>
            <Text style={styles.fileStatus}>
              {showPreviewMockup ? "업로드 완료" : importUploadFileStatusText(uploadPhase)}
            </Text>
          </View>
          {/* 완료 체크는 목업에만 있다 -- 실제 업로드는 성공하면 곧바로 검수 화면으로 넘어가므로,
              이 화면에 남아 있는 동안의 ✓는 아직 사실이 아니다. */}
          {showPreviewMockup ? (
            <View style={styles.fileCheck}>
              <Text style={styles.fileCheckText}>✓</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 라운드 41 UX-S: 로그인 상태에서 파일을 고르기 전에는 목업 대신 이 안내만 남는다. */}
      {!showPreviewMockup && !selectedFileName ? (
        <View style={styles.guideCard}>
          <Text style={styles.guideText}>{IMPORT_UPLOAD_GUIDE_TEXT}</Text>
        </View>
      ) : null}

      {/* A11Y-117: 가짜 "총 128건 · ₩1,245,700" 분류 미리보기는 순수 장식 -- TalkBack이 실제
          데이터처럼 읽지 않도록 서브트리를 통째로 숨긴다. 기존에 accessibilityLabel로만 있던
          안내문은 아래 보이는 Text로 옮겨 모두가 읽을 수 있게 한다.
          라운드 41 UX-S: 숨기는 것으로는 부족했다(눈으로 보는 사람에게는 여전히 남의 숫자가
          내 화면에 사실처럼 떠 있었다) -- 로그인 상태에서는 아예 그리지 않는다. */}
      {showPreviewMockup ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.previewCard, { borderRadius: ExcelPreviewPixelStyles.cardRadius }]}
        >
          <Text style={styles.previewTitle}>AI 분류 미리보기</Text>
          <View style={styles.previewSummary}>
            <Text style={styles.previewSummaryLabel}>총 128건</Text>
            <Text style={styles.previewSummaryAmount}>₩1,245,700</Text>
          </View>
          {excelPreviewRows.map((row) => (
            <ImportPreviewCategoryRow key={row.label} row={row} />
          ))}
        </View>
      ) : null}

      <Text style={styles.previewNotice}>검수 후 승인하기 전까지는 지출로 저장되지 않아요.</Text>

      <View style={styles.footerSpacer} />
      <Pressable
        accessibilityRole="button"
        disabled={upload.isPending}
        onPress={applyPreview}
        style={({ pressed }) => [styles.applyButton, { bottom: 20 + ExcelPreviewPixelStyles.ctaBottomInset, height: ExcelPreviewPixelStyles.ctaHeight, opacity: pressed || upload.isPending ? 0.82 : 1 }]}
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
    backgroundColor: "#FFFCFA",
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
    height: 32,
    justifyContent: "center",
    width: 32
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
  // 라운드 41 UX-S: 로그인·파일 선택 전 안내 카드. 목업 카드와 같은 자리(marginTop 34)·같은
  // 표면 토큰을 쓴다 -- 새 hex 없이 기존 카드 문법 그대로다.
  guideCard: {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 34,
    padding: 16,
    ...theme.shadows.card
  },
  guideText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20
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
  previewNotice: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10
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
