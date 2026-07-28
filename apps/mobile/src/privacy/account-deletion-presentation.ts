export type AccountDeletionPresentation = {
  mode: "blocked" | "processing" | "grace";
  title: string;
  notice: string;
  canCancel: boolean;
};

export function accountDeletionPresentation(
  deletion: { state: string; dueAt?: string | null },
  nowMs = Date.now()
): AccountDeletionPresentation {
  if (deletion.state === "failed") {
    return {
      mode: "blocked",
      title: "가족 소유권 이전 필요",
      notice: "삭제는 시작되지 않았고 계정 접근도 그대로 유지돼요. 가족 소유권을 이전한 뒤 다시 시도해 주세요.",
      canCancel: true
    };
  }
  const dueAtMs = deletion.dueAt ? new Date(deletion.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (dueAtMs <= nowMs) {
    return {
      mode: "processing",
      title: "삭제 처리 재개 중",
      notice: "소유권 확인을 마쳐 삭제 처리를 재개했어요. 곧 계정 접근이 중단될 수 있어요.",
      canCancel: false
    };
  }
  return {
    mode: "grace",
    title: "삭제 유예 중",
    notice: "예정 시각 전까지 로그인과 데이터 이용이 유지돼요.",
    canCancel: true
  };
}
