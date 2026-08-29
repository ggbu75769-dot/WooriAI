import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createExcelImport, LOCAL_SESSION_TOKEN, undoImport, type Child } from "../../src/api/client";
// 라운드 68 트랙 B(#5): 다자녀 스코프 라벨의 해석·조립은 여덟 화면이 쓰는 **같은 순수 모듈 한 벌**
// 에서만 온다(새 어휘를 만들지 않는다 — 라운드 48 T4의 `resolveChildScopeLabel`).
import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";
import {
  importResumeCardAccessibilityLabel,
  importResumeCardSubtitle,
  importUndoActionAccessibilityLabel,
  importUndoCardAccessibilityLabel,
  importUndoCardSubtitle,
  importUndoConfirmMessage,
  importUndoResultMessage,
  resolveImportResumeCard,
  IMPORT_RESUME_CARD_TITLE,
  IMPORT_UNDO_ACTION_LABEL,
  IMPORT_UNDO_CARD_TITLE,
  IMPORT_UNDO_CONFIRM_TITLE,
  type ImportResumeEntry
} from "../../src/import/import-resume";
import {
  IMPORT_UPLOAD_GUIDE_TEXT,
  IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE,
  IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE,
  importUploadFileStatusText,
  importUploadPhase
} from "../../src/import/upload-copy";
// 라운드 71 트랙 A: 업로드·되돌리기 실패도 서버가 준 이름을 그대로 말한다(문구·판정은 순수 모듈).
import { importFailureMessage } from "../../src/import/import-failure-messages";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { validateImportFile } from "../../src/import-file-validation";
import { useImportResumeStore } from "../../src/stores/import-resume.store";
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

// PIX-133: 보정 변환은 IMP-003 캡처 빌드 전용.
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function excelPreviewPixelFrameStyle() {
  if (!isPixelLockCalibration) return undefined;
  return {
    transform: [
      { translateX: ExcelPreviewPixelStyles.horizontalOffset },
      { translateY: ExcelPreviewPixelStyles.topOffset },
      { scale: ExcelPreviewPixelStyles.scale },
      { scaleY: ExcelPreviewPixelStyles.scaleY }
    ]
  } as const;
}

/**
 * D1 후속(실기기 피드백 2): 카테고리 불릿을 텍스트 글리프(♥ 🍴 ▣ ◆ ✿ ●)에서 탭바와 같은
 * Ionicons outlined 계열로 통일했다 -- 이모지 하나(🍴)만 컬러로 튀고 나머지는 기기 폰트에
 * 따라 네모로 떨어져 6줄의 굵기·크기가 제각각이었다. 색·배경 톤·문구·순서는 그대로다.
 */
const excelPreviewRows = [
  { icon: "water-outline", label: "기저귀/위생", amount: "₩425,000", percent: "34%", count: "42건", tone: theme.colors.presentation.previewCoral, iconColor: theme.colors.mainCoral },
  { icon: "restaurant-outline", label: "식비/간식", amount: "₩298,500", percent: "24%", count: "31건", tone: theme.colors.presentation.previewYellow, iconColor: theme.colors.warning },
  { icon: "cafe-outline", label: "분유/유제품", amount: "₩210,300", percent: "17%", count: "22건", tone: theme.colors.mint, iconColor: theme.colors.secondary500 },
  { icon: "shirt-outline", label: "의류/잡화", amount: "₩156,200", percent: "13%", count: "18건", tone: theme.colors.presentation.previewGreen, iconColor: theme.colors.success },
  { icon: "book-outline", label: "장난감/도서", amount: "₩89,700", percent: "7%", count: "15건", tone: theme.colors.presentation.previewPeach, iconColor: theme.colors.subCoral },
  { icon: "ellipsis-horizontal-outline", label: "기타", amount: "₩66,000", percent: "5%", count: "9건", tone: theme.colors.presentation.previewNeutral, iconColor: theme.colors.gray600 }
] as const satisfies readonly { icon: keyof typeof Ionicons.glyphMap; label: string; amount: string; percent: string; count: string; tone: string; iconColor: string }[];

function ImportPreviewCategoryRow({ row }: { row: (typeof excelPreviewRows)[number] }) {
  return (
    <View style={[styles.previewRow, { minHeight: ExcelPreviewPixelStyles.rowHeight || 36 }]}>
      <View style={[styles.categoryIcon, { backgroundColor: row.tone }]}>
        <Ionicons name={row.icon} size={14} color={row.iconColor} />
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
  /**
   * 라운드 71 트랙 A — **실패한 그 순간의 연결 상태**(오프라인이면 "잠시 후 다시"가 거짓말이 된다).
   *
   * 판정은 point-in-time 폴 한 번이고(app/family/index.tsx가 쓰는 그 배선 — 새 훅을 만들지
   * 않는다), 기본값 true는 폴이 돌아오기 전과 판정 불가 플랫폼(web)에서 **종전 문구 그대로**를
   * 뜻한다. 매 시도 시작에서 다시 true로 되돌린다 — 앞 실패의 판정이 다음 실패에 얹히면
   * 화면이 없던 오프라인을 말하게 된다.
   */
  const [uploadFailureOnline, setUploadFailureOnline] = useState(true);
  // 라운드 56 D#5: 검토 도중 이탈해도 돌아올 길을 남긴다(규칙·문구는 src/import/import-resume.ts).
  const resumeEntry = useImportResumeStore((state) => state.entry);
  // 라운드 67 적대 리뷰 #1: 확정된 잡은 **다른 칸**에 있다 — 그래서 새 업로드가 이 입구를 덮지 않는다.
  const confirmedEntry = useImportResumeStore((state) => state.confirmed);
  const rememberImportReview = useImportResumeStore((state) => state.rememberImportReview);
  // 라운드 67 #3: 되돌린 뒤에는 그 카드를 지운다(되돌릴 것이 남지 않았다 — 되돌리기의 되돌리기는 없다).
  const forgetImportReview = useImportResumeStore((state) => state.forgetImportReview);
  const queryClient = useQueryClient();
  /**
   * 라운드 68 트랙 B(#5) — **이 파일이 어느 아이에게 붙는가**를 화면이 말한다.
   *
   * 고치는 문제: 이 화면은 `childId`를 읽어 `createExcelImport(authToken, childId, …)`로 넘기면서
   * 그 아이를 어디에도 그리지 않았다. 라운드 67 #3이 되돌리기(뒷수습)를 만든 그 사고 — "200행을
   * 올려 확정했는데 알고 보니 둘째로 전환한 상태였다" — 의 **앞막이**가 없었던 것이다. 파일을
   * 고르는 이 순간이 그 흐름에서 아이를 확인할 수 있는 마지막이자 가장 싼 자리다(그 뒤로는
   * 업로드 → 분석 대기 → 수백 행 검수가 이어진다).
   *
   * 새 어휘도 새 요청도 만들지 않는다: 예산·정기 지출·리포트 등 여덟 화면과 **같은 함수**를 쓰고
   * (`resolveChildScopeLabel`/`withChildScopeLabel` — 아이가 2명 이상일 때만, 이름을 못 풀면
   * 아무것도 붙이지 않는다), 목록은 이미 채워진 `["children"]` **캐시**에서만 읽는다.
   *
   * ⚠️ IMP-003 픽셀락 이중 게이트: 캡처는 **비로그인 경로**로 찍고(app/pixel-lock.tsx가 세션을
   * 지운 뒤 /import로 보낸다), ⓐ 세션이 없으면 아래 캐시 읽기 자체가 일어나지 않아 목록이
   * undefined이고, ⓑ `resolveChildScopeLabel`은 목록이 없으면 언제나 null이다. 라벨이 null이면
   * `withChildScopeLabel`이 **원문 그대로**를 돌려주므로 캡처는 한 픽셀도 바뀌지 않는다(외동
   * 계정에서도 마찬가지다).
   *
   * 검수 화면(app/import/[importJobId].tsx)의 방식과 섞지 않는다: 그쪽은 **잡에 박힌 아이**
   * (`job.childId`)를 말하고 여기는 **지금 고른 아이**를 말한다 — 아직 잡이 없는 화면에서
   * `job.childId`를 흉내 내면 없는 값을 짓게 된다(라운드 41 K-2가 세운 구분).
   */
  const cachedChildren = authToken
    ? queryClient.getQueryData<{ children: Child[] }>(["children"])?.children
    : undefined;
  const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);
  const upload = useMutation({
    mutationFn: (asset: DocumentPicker.DocumentPickerAsset) =>
      createExcelImport(authToken!, childId!, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType }),
    onMutate: () => {
      setUploadFailureOnline(true);
    },
    onError: () => {
      void isCurrentlyOnline().then(setUploadFailureOnline);
    },
    // 파일명은 **이번 업로드의 변수**에서 온다(화면 state가 아니라) -- state는 이 콜백이 만들어진
    // 렌더의 값이라 첫 업로드에서는 아직 null이다.
    onSuccess: (job, asset) => {
      // jobId가 실제로 생긴 **뒤에만** 적는다. 그 전에 적으면 존재하지 않는 잡을 가리키는
      // 카드가 남는다.
      rememberImportReview({
        childId: job.childId,
        jobId: job.id,
        fileName: asset.name,
        createdAt: new Date().toISOString()
      });
      router.push(`/import/${job.id}`);
    }
  });

  /**
   * 라운드 67 #3 — **확정한 가져오기 되돌리기.**
   *
   * 고치는 문제: 라운드 66이 서버에 출처(`expenses.import_job_id`)를 남기기 시작했지만, 앱에는
   * 확정한 200건을 되돌릴 길이 없었다 — 확정하는 순간 이 화면의 저장본이 지워졌고, 서버에는
   * "내 가져오기 목록"이 없어 그 잡으로 돌아갈 주소를 아는 곳이 아무 데도 없었다. 남는 수단은
   * 기록 탭에서 한 건씩 롱프레스해 지우는 것(200번)이었고, 어느 200건인지 가릴 방법도 없었다
   * (출처 행과 CSV 열이 말하는 것은 `"엑셀 가져오기"` 한 단어뿐이다).
   *
   * **새 화면을 만들지 않는다**: 재진입 카드와 같은 자리·같은 저장소에서, 확정된 잡이면 카드가
   * "방금 가져온 결과 · 되돌리기"로 바뀐다. 판정·문구는 전부 순수 모듈에 있다.
   *
   * 무효화 목록은 **확정이 태우는 그 넷 그대로**다(app/import/[importJobId].tsx의 onSuccess) —
   * 되돌리기는 확정의 반대 방향이고 숫자가 걸린 화면도 정확히 같다(리포트·홈·기록·예산).
   * 하나라도 빠지면 "되돌렸는데 총액이 그대로"가 된다.
   */
  const undo = useMutation({
    mutationFn: (jobId: string) => undoImport(authToken!, jobId),
    onSuccess: async (result, jobId) => {
      // 되돌린 잡의 카드는 사라진다 — 되돌리기의 되돌리기는 만들지 않는다.
      forgetImportReview(jobId);
      await queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
      // 건수는 **서버가 실제로 지운 값**이다(카드에 적힌 숫자가 아니다 — 그 사이 손으로 지운
      // 행이 있으면 둘이 다르고, 그때 카드의 숫자를 말하면 화면이 거짓을 말한다).
      Alert.alert(IMPORT_UNDO_CARD_TITLE, importUndoResultMessage(result.deletedCount));
    },
    // 라운드 71 트랙 A: 서버는 되돌릴 수 없는 이유를 코드로 말한다(`IMPORT_NOT_UNDOABLE` ·
    // `IMPORT_JOB_NOT_FOUND` · 403). 종전에는 표에 없어 전부 "되돌리지 못했어요. 잠시 후 다시
    // 시도해 주세요."로 접혔는데, 셋 다 다시 눌러도 같은 답이 오는 사실이다. 실패한 그 순간의
    // 연결 상태를 한 번 확인해 넘기는 배선은 가족 화면(app/family/index.tsx)의 그것과 같다.
    onError: (error) => {
      void isCurrentlyOnline().then((isOnline) => {
        Alert.alert(IMPORT_UNDO_CARD_TITLE, importFailureMessage("undo", error, { isOnline }));
      });
    }
  });

  const confirmUndo = (entry: ImportResumeEntry) => {
    if (undo.isPending) return;
    // 라운드 41 K-7과 같은 게이트: 서버도 되돌리기에 편집 권한을 요구한다
    // (`requireImportJobAccess(user, id, true)` → 403). 게이트가 없으면 보기 전용으로 역할이
    // 바뀐 사람이 확인 Alert까지 지난 뒤 "잠시 후 다시 시도해 주세요"라는 **틀린 이유**를
    // 받는다(다시 눌러도 결과가 같다).
    if (expenseGate.locked) {
      expenseGate.explain();
      return;
    }
    // 라운드 67 적대 리뷰(#2): 건수는 **확정 시점의 참고값**으로만 넘긴다 — 그 사이 손으로 지운
    // 행이 있으면 실제로 사라지는 수는 더 적다(문구가 크기를 주장하지 않는 이유는 순수 모듈 주석).
    Alert.alert(IMPORT_UNDO_CONFIRM_TITLE, importUndoConfirmMessage(entry.importedCount), [
      { text: "취소", style: "cancel" },
      { text: IMPORT_UNDO_ACTION_LABEL, style: "destructive", onPress: () => undo.mutate(entry.jobId) }
    ]);
  };

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
  /**
   * 라운드 56 D#5: "검토하던 가져오기 이어서 보기" 카드.
   *
   * 판정은 순수 모듈에 있다 -- 지금 고른 아이의 가져오기일 때만, 그리고 **로그인 상태에서만**
   * 그린다. 후자가 IMP-003 픽셀락 계약이다: 비로그인 렌더(=캡처 경로)에는 이 카드가 존재할 수
   * 없으므로 캡처 화면이 한 픽셀도 바뀌지 않는다.
   */
  const resumeCard = resolveImportResumeCard({ entry: resumeEntry, childId, canResume: canUpload });
  /**
   * 라운드 67 #3: **확정 칸**이 차 있으면 "방금 가져온 결과"(되돌리기 입구)가 선다.
   *
   * 라운드 67 적대 리뷰(#1)에서 이 카드의 근거가 바뀌었다. 종전에는 저장본이 한 칸이었고 그
   * 한 건이 건수를 달고 있으면 결과 카드로 **변신**했다 — 그래서 새 업로드가 그 칸을 덮는
   * 순간 되돌리기 입구가 영구히 사라졌다(잘못 확정한 사람이 올바른 파일을 다시 올리는 것이
   * 바로 그 경로다). 이제 칸이 둘이라 **두 카드가 동시에 설 수 있고**, 새 업로드는 위쪽
   * 검토 칸만 덮는다. 슬롯 가산은 하나뿐이라 "서버에 없는 목록을 지어내지 않는다"는 라운드
   * 56의 규율은 그대로다.
   *
   * 아이 스코프·로그인 게이트는 **같은 판정 하나**를 지난다: 비로그인 렌더(=IMP-003 픽셀락
   * 캡처 경로)에는 두 카드 모두 존재할 수 없으므로 캡처가 한 픽셀도 바뀌지 않는다.
   */
  const undoCard = resolveImportResumeCard({ entry: confirmedEntry, childId, canResume: canUpload });
  // 알림함과 같은 관례: "언제"는 렌더 시각 기준으로 한 번만 읽는다.
  const now = Date.now();

  return (
    <View testID={importUploadScreenId} style={[styles.screen, { paddingHorizontal: ExcelPreviewPixelStyles.screenPadding }, excelPreviewPixelFrameStyle()]}>
      <View style={styles.navigationBar}>
        {/* 라운드 69 E(#5): 이 뒤로가기만 44dp였다 — `styles.backButton`이 32×32라 32 + 2×6 = 44로
            이 저장소가 스스로 못박은 최소 타깃(`theme.touchTarget` = 48)에 미달이었다. 32는
            IMP-003 픽셀락 캡처의 값이라 높이로 벌 수 없으므로 **hitSlop만** 8로 올린다:
            32 + 2×8 = 48(커머스 상세의 `PRODUCT_DETAIL_CHROME_HIT_SLOP`이 34dp에 쓴 그 산수).
            `hitSlop`은 레이아웃 속성이 아니라 히트 영역이라 렌더는 한 픽셀도 바뀌지 않는다.
            산수 자체는 src/a11y-contract.test.ts가 소스에서 다시 계산해 붙든다. */}
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        {/* 라운드 68 B(#5): 다자녀 계정에서만 "다온이 — 엑셀 업로드"가 된다(외동·비로그인은 원문
            그대로 — 위 childScopeLabel 주석의 이중 게이트). 스타일·자리는 한 글자도 바뀌지 않는다. */}
        <Text style={styles.navigationTitle}>{withChildScopeLabel("엑셀 업로드", childScopeLabel)}</Text>
        <View style={styles.backButton} />
      </View>

      {/* 라운드 67 #3: 확정된 가져오기의 결과 카드 — 되돌리기의 유일한 입구다. 카드를 누르면
          그 잡의 결과 화면으로 가고, 옆 버튼이 그 파일에서 온 지출을 통째로 되돌린다(확인
          Alert가 건수와 "고친 기록도 함께 사라진다"를 먼저 말한다). 되돌린 뒤에는 저장본이
          지워져 이 카드도 사라진다 — 되돌리기의 되돌리기는 만들지 않는다. */}
      {undoCard ? (
        <View style={styles.resumeCard}>
          <View accessible={false} style={styles.fileIcon}>
            <Ionicons
              accessible={false}
              name="checkmark-done-outline"
              size={styles.fileIconText.fontSize}
              color={styles.fileIconText.color}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={importUndoCardAccessibilityLabel(undoCard, now)}
            onPress={() => router.push(`/import/${undoCard.jobId}`)}
            style={({ pressed }) => [styles.fileTextColumn, { opacity: pressed ? 0.82 : 1 }]}
          >
            <Text style={styles.fileName}>{IMPORT_UNDO_CARD_TITLE}</Text>
            <Text numberOfLines={1} style={styles.fileStatus}>
              {importUndoCardSubtitle(undoCard, now)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={importUndoActionAccessibilityLabel(undoCard)}
            accessibilityState={{ disabled: undo.isPending }}
            disabled={undo.isPending}
            hitSlop={12}
            onPress={() => confirmUndo(undoCard)}
            style={({ pressed }) => [styles.undoButton, { opacity: pressed || undo.isPending ? 0.82 : 1 }]}
          >
            <Text style={styles.undoButtonText}>{IMPORT_UNDO_ACTION_LABEL}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 라운드 56 D#5: 검토 중이던 가져오기로 돌아가는 카드. 서버에는 "내 가져오기 목록"이
          없으므로(엔드포인트 자체가 없다) 이 카드가 그 잡으로 가는 유일한 길이다. 취소된 잡과
          사라진 잡(404)은 검수 화면이 저장본을 지우므로 여기 남지 않고, 확정된 잡은 확정 칸으로
          옮겨 가 위 결과 카드로 선다(라운드 67 #3). 라운드 67 적대 리뷰 #1로 칸이 나뉜 뒤로는
          **두 카드가 함께 설 수 있다** — 확정한 뒤 새 파일을 올린 사람의 화면이 정확히 그렇다
          (위: 방금 확정한 것을 되돌리는 입구 / 아래: 방금 올려 검토 중인 파일). */}
      {resumeCard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={importResumeCardAccessibilityLabel(resumeCard, now)}
          onPress={() => router.push(`/import/${resumeCard.jobId}`)}
          style={({ pressed }) => [styles.resumeCard, { opacity: pressed ? 0.82 : 1 }]}
        >
          <View accessible={false} style={styles.fileIcon}>
            <Ionicons
              accessible={false}
              name="time-outline"
              size={styles.fileIconText.fontSize}
              color={styles.fileIconText.color}
            />
          </View>
          <View style={styles.fileTextColumn}>
            <Text style={styles.fileName}>{IMPORT_RESUME_CARD_TITLE}</Text>
            <Text numberOfLines={1} style={styles.fileStatus}>
              {importResumeCardSubtitle(resumeCard, now)}
            </Text>
          </View>
        </Pressable>
      ) : null}

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
            <Ionicons
              accessible={false}
              name="document-text-outline"
              size={styles.fileIconText.fontSize}
              color={styles.fileIconText.color}
            />
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
      {/* 라운드 45 UX-Z: 예전에는 어떤 실패든 "잠시 후 다시 시도해 주세요."였다. 그런데 서버가
          거절하는 대표적인 이유(2,000행 초과 · csv/xlsx 아님 · 10MB 초과)는 **다시 눌러도 절대
          성공하지 않는다** -- 그 사람에게 필요한 것은 재시도가 아니라 파일을 나누거나 바꾸라는
          사실이다. 아는 코드만 문구로 바꾸고, 나머지는 예전 문장 그대로 폴백한다.
          라운드 71 트랙 A: 그 판정이 여정 전용 모듈을 한 번 지난다 -- 표에 없던
          `IMPORT_FILE_INVALID`(사용자가 실제로 고칠 수 있는 유일한 실패)와 403·오프라인이
          여기서 갈린다. 세 줄(행 수·확장자·용량)의 문구는 여전히 앱 전역 표에서 온다.
          ⚠️ IMP-003 픽셀락: 이 텍스트 노드는 업로드 실패 상태에서만 서고 캡처는 비로그인
          경로라(upload.error가 없다) 캡처 화면은 한 픽셀도 바뀌지 않는다. */}
      {upload.error ? (
        <Text style={{ color: theme.colors.danger }}>
          {importFailureMessage("upload", upload.error, { isOnline: uploadFailureOnline })}
        </Text>
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
  // 라운드 56 D#5: "이어서 보기" 카드. 파일 카드(excelUploadedFileCardStyle)와 **같은 표면
  // 문법**을 쓰되 자리만 위(marginTop 20)다 -- 새 색·새 그림자를 만들지 않는다. 카드 전체가
  // 누를 수 있는 대상이므로 최소 터치 타깃을 보장한다.
  resumeCard: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    minHeight: theme.touchTarget,
    padding: 14,
    ...theme.shadows.card
  },
  // 라운드 67 #3: 결과 카드의 되돌리기 버튼. 되돌릴 수 없는 일괄 동작이라 색은 danger 토큰을
  // 쓰고(새 hex 없음), 터치 타깃은 hitSlop 12로 채운다 — 카드 안의 다른 누르는 자리와 같은
  // 관례다.
  // ⚠️ 표기 정정(라운드 67 트랙 F, 주석만 — 동작 0건): 이 저장소의 기준은 44가 아니라 자신의
  // 토큰 `theme.touchTarget`(=48dp)이다(A11Y 체크표 A-1 · a11y-contract.test.ts GAP-064 #6·65 #7).
  // 여기 값(글자 줄 + 세로 패딩 6×2 + hitSlop 12×2)은 그 48도 넘으므로 숫자를 바꾸지 않고
  // **기준의 이름만** 바로잡는다 — 44라고 적어 두면 다음 사람이 더 낮은 기준을 물려받는다.
  undoButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  undoButtonText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "800"
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
