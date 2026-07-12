/**
 * Pure client-side validation for a file picked via expo-document-picker before it is
 * handed to createExcelImport. Kept dependency-free (no react-native / expo imports) so it
 * can be unit tested directly and reused by the import screen.
 */

export const maxImportFileSizeBytes = 10 * 1024 * 1024; // 10MB

const allowedExtensions = [".csv", ".xlsx"];

export type ImportFileValidationResult = { ok: true } | { ok: false; message: string };

function hasAllowedExtension(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return allowedExtensions.some((extension) => lowerName.endsWith(extension));
}

/**
 * Validates a picked file's name and size before upload.
 * `size` may be null/undefined on some platforms (expo-document-picker doesn't always report
 * it) -- in that case the size check is skipped rather than treated as a failure.
 */
export function validateImportFile(fileName: string, size?: number | null): ImportFileValidationResult {
  if (!hasAllowedExtension(fileName)) {
    return { ok: false, message: "csv 또는 xlsx 파일만 올릴 수 있어요" };
  }
  if (typeof size === "number" && size > maxImportFileSizeBytes) {
    return { ok: false, message: "10MB 이하 파일만 올릴 수 있어요" };
  }
  return { ok: true };
}
