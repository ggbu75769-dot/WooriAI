import { Share } from "react-native";
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
  /** False when the user dismissed the share sheet (iOS reports this; Android always shares). */
  shared: boolean;
  /** True when the ~100KB share cap dropped rows — surface in a toast. */
  truncated: boolean;
  droppedRows: number;
};

export async function shareExpenseCsv(csv: string): Promise<ShareCsvOutcome> {
  const payload = capCsvForShare(csv);
  const result = await Share.share(
    { message: payload.message, title: "우리아이 지출 내역 (CSV)" },
    { dialogTitle: "우리아이 지출 내역 (CSV)", subject: "우리아이 지출 내역 (CSV)" }
  );
  return {
    shared: result.action !== Share.dismissedAction,
    truncated: payload.truncated,
    droppedRows: payload.droppedRows
  };
}
