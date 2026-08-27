/**
 * 라운드 41 UX-S: 가져오기 **첫 화면**(app/import/index.tsx)의 문구 단일 소스.
 *
 * 왜 모듈인가: 이 화면은 두 얼굴을 가진다.
 *  - 비로그인 = IMP-003 픽셀락 캡처 경로(app/pixel-lock.tsx가 세션을 지우고 /import로 보낸다).
 *    참고 시안 그대로의 목업(가짜 파일 카드 + "총 128건 · ₩1,245,700" 분류 미리보기)이 그려진다.
 *  - 로그인 = 실사용 경로. 여기서 목업을 그대로 보여 주면 **내 데이터가 아닌 숫자**를 내 화면이
 *    사실처럼 말하는 셈이라, 로그인 상태에서는 목업을 걷고 안내 + 실제 파일 상태만 남긴다.
 *
 * 두 얼굴의 문구가 화면 JSX 안에서 갈리지 않도록 여기 모아 둔다. react-native import 없음.
 */

import { maxImportFileSizeBytes } from "../import-file-validation";

/** 10MB(=`maxImportFileSizeBytes`)를 사람 말로. 상한이 바뀌면 문구도 같이 바뀐다. */
const maxImportFileSizeLabel = `${Math.round(maxImportFileSizeBytes / (1024 * 1024))}MB`;

/**
 * 로그인 상태에서 파일을 고르기 전에 보이는 안내. 목업 대신 **무엇을 하면 무엇이 나오는지**를
 * 말한다. 확장자·용량 상한은 validateImportFile이 거절하는 조건과 같은 값이다.
 */
export const IMPORT_UPLOAD_GUIDE_TEXT = `csv·xlsx 파일을 고르면 분석 결과를 보여드려요 · ${maxImportFileSizeLabel} 이하`;

/**
 * 비로그인 CTA("적용하고 리포트 보기")를 눌렀을 때의 안내.
 *
 * 예전에는 `if (canUpload)` 가드 안에서 아무 일도 하지 않아 **눌러도 무반응**이었다. 픽셀락
 * 캡처는 정지 화면이므로 Alert은 캡처에 잡히지 않는다 -- 렌더는 한 글자도 바뀌지 않으면서
 * 무반응만 없앤다.
 */
export const IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE = "로그인하면 내 파일을 가져올 수 있어요";
export const IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE =
  "지금 보이는 분류 미리보기는 예시예요. 로그인하고 아이를 고른 뒤에 내 csv·xlsx 파일을 올려 주세요.";

/** 파일을 고른 뒤 카드에 적히는 진행 상태. 목업의 "업로드 완료"는 여기 없다(아직 완료가 아니다). */
export type ImportUploadPhase = "picked" | "uploading" | "failed";

export function importUploadFileStatusText(phase: ImportUploadPhase): string {
  if (phase === "uploading") return "업로드하고 분석하는 중이에요";
  if (phase === "failed") return "업로드하지 못했어요";
  return "파일을 골랐어요";
}

/** 업로드 중인지로 위 단계를 정한다(오류가 있으면 실패가 먼저). */
export function importUploadPhase(input: { isUploading: boolean; hasError: boolean }): ImportUploadPhase {
  if (input.isUploading) return "uploading";
  if (input.hasError) return "failed";
  return "picked";
}
