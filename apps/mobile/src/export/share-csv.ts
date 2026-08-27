import { Platform, Share } from "react-native";
import { capCsvForShare } from "./share-payload";

/**
 * EXP-106 데이터 내보내기: hands the built CSV to the OS share sheet.
 *
 * Share-path decision (checked with `pnpm why expo-file-system expo-sharing`, no new
 * downloads allowed):
 * - `expo-file-system` exists only as a transitive dependency of `expo` inside the pnpm store
 *   (node_modules/.pnpm). Under pnpm's strict layout it is NOT resolvable from app code — it
 *   is neither a direct dependency in apps/mobile/package.json nor hoisted into any
 *   node_modules directory Metro's `resolver.nodeModulesPaths` searches — so importing the
 *   package from app code would fail to resolve at bundle time.
 * - `expo-sharing` is not installed anywhere in the workspace.
 * Adding either would mean a new package.json dependency + download, which this ticket
 * forbids. So the fallback path is used: React Native's built-in `Share.share({ message })`
 * with a ~100KB UTF-8 cap (capCsvForShare) applied at row boundaries; truncation is returned
 * to the caller so the UI can toast about it. If expo-file-system/expo-sharing are added as
 * real dependencies later, only this module needs to switch to the write-to-cacheDirectory +
 * share-file-URI path.
 */
export type ShareCsvOutcome = {
  /**
   * False only when we **know** the user dismissed the share sheet. `Share.dismissedAction` is
   * an iOS-only result, so on Android this stays true even when nothing was shared — read it
   * together with `outcomeKnown` before claiming success.
   */
  shared: boolean;
  /**
   * 라운드 45 O-8: 공유가 실제로 끝났는지 OS가 알려 주는가.
   *
   * iOS만 `sharedAction`/`dismissedAction`을 구분해 돌려준다. Android의 `Share.share`는 시트를
   * 띄운 뒤 항상 `{ action: "sharedAction" }`으로 resolve하므로, 사용자가 시트를 그냥 닫아도
   * 예전 코드는 "내보냈어요"라는 **허위 성공 토스트**를 띄웠다. 모르는 것을 안다고 말하지 않도록
   * 플랫폼을 그대로 싣고, 문구 선택은 호출부(ExpenseCsvExport.tsx)가 한다.
   */
  outcomeKnown: boolean;
  /** True when the ~100KB share cap dropped rows — surface in a toast. */
  truncated: boolean;
  droppedRows: number;
};

/**
 * 라운드 45 UX-AA(후보 7): 제목이 "(CSV)"라고만 적혀 있으면 받는 쪽은 첨부 파일을 기대한다 --
 * 실제로 가는 것은 위 주석대로 **본문 텍스트**다. 무엇이 가는지 제목에서 먼저 말한다
 * (화면 쪽 안내는 src/export/ExpenseCsvExport.tsx의 카드 문구).
 */
const CSV_SHARE_TITLE = "우리아이 지출 내역 (CSV 텍스트)";

export async function shareExpenseCsv(csv: string): Promise<ShareCsvOutcome> {
  const payload = capCsvForShare(csv);
  const result = await Share.share(
    { message: payload.message, title: CSV_SHARE_TITLE },
    { dialogTitle: CSV_SHARE_TITLE, subject: CSV_SHARE_TITLE }
  );
  return {
    shared: result.action !== Share.dismissedAction,
    outcomeKnown: Platform.OS === "ios",
    truncated: payload.truncated,
    droppedRows: payload.droppedRows
  };
}
