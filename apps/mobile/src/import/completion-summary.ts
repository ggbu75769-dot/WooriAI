export function importCompletionSummary(rowCount: number, importedCount: number) {
  const safeRowCount = Math.max(0, Math.trunc(rowCount));
  const safeImportedCount = Math.max(0, Math.min(safeRowCount, Math.trunc(importedCount)));
  return {
    importedCount: safeImportedCount,
    excludedCount: safeRowCount - safeImportedCount
  };
}
