import { getSeoulToday } from "@wooriai/domain";
import { formatSpentOn } from "../expenses/records-list-view";

/**
 * 라운드 45 UX-AA: 약관 및 개인정보 화면(SET-003)의 "동의 내역" 카드가 그리는 한 줄.
 *
 * 왜 모듈인가: 화면(app/settings/privacy.tsx)은 vitest에서 렌더할 수 없고(react-native 네이티브
 * 바인딩 없음), 이 카드가 말하는 것은 전부 **사실 진술**이다 -- 동의했는지, 언제 동의했는지.
 * 그 판정을 화면 안에 두면 검증할 방법이 소스 grep밖에 남지 않으므로 순수 함수로 분리한다.
 *
 * 정직성 규칙 두 가지:
 * - 동의 시각이 없으면 날짜를 **지어내지 않는다**. "동의함"까지만 말한다(서버 Consent.acceptedAt은
 *   accepted=false인 행에서 null이고, 예전 데모 상태에도 없을 수 있다).
 * - 날짜 표기는 기록 탭·홈의 지출 행과 같은 `formatSpentOn`("8월 4일") 관례를 그대로 쓴다.
 *   acceptedAt은 date-only가 아니라 **시각**(서버 Consent.acceptedAt의 ISO)이므로, 앞 10글자를
 *   자르면 UTC 기준 날짜가 되어 밤늦게 동의한 사람에게 하루 전 날짜를 보여주게 된다. 앱 전역의
 *   서울 시간 규칙(@wooriai/domain money-date.ts)으로 옮긴 뒤 포맷한다.
 */
export type ConsentSummaryInput = {
  title: string;
  accepted: boolean;
  acceptedAt?: string | null;
};

export type ConsentSummaryLine = {
  /** 목록 key 겸 표시 이름. */
  title: string;
  /** 오른쪽에 붙는 상태 문구. */
  statusText: string;
};

/** 동의 안 함 / 동의함 / "8월 4일 동의". */
export function consentStatusText(consent: ConsentSummaryInput): string {
  if (!consent.accepted) return "동의 안 함";
  const acceptedAt = typeof consent.acceptedAt === "string" ? new Date(consent.acceptedAt) : null;
  // 읽을 수 없는 값(빈 문자열·"언젠가"·구 데모 상태의 부재)은 날짜인 척하지 않고 버린다.
  if (!acceptedAt || Number.isNaN(acceptedAt.getTime())) return "동의함";
  return `${formatSpentOn(getSeoulToday(acceptedAt))} 동의`;
}

/**
 * 서버 GET /settings/privacy의 `consents`를 카드 줄로 바꾼다.
 *
 * 응답에 동의 항목이 없거나(구 서버·데모) 실패해서 undefined면 빈 배열이다 -- 화면은 그때
 * 카드를 통째로 생략한다(빈 카드를 그려 "동의 내역이 없다"고 말하지 않는다).
 */
export function buildConsentSummaryLines(
  consents: readonly ConsentSummaryInput[] | null | undefined
): ConsentSummaryLine[] {
  return (consents ?? [])
    .filter((consent) => typeof consent?.title === "string" && consent.title.trim().length > 0)
    .map((consent) => ({ title: consent.title.trim(), statusText: consentStatusText(consent) }));
}
