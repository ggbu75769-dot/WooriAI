import { buildNextStagePreview, type NextStagePreview } from "../items/next-stage-preview";
import type { StageBandLabel } from "../items/stage-bands";
import { objectParticle, subjectParticle } from "../text/korean-particles";
import type { AppNotificationCandidate } from "./notification.store";

/**
 * 토스 이월 해소 트랙 T-F — **시기 전환 D-7 예고 인앱 알림.**
 *
 * 직전 기능 라운드가 이월한 자리다: 배너(next-stage-preview)와 판정이 겹쳐 같은 라운드에 둘로
 * 쪼갤 수 없었고, 지금은 그 모듈이 머지돼 있으므로 **그 판정을 import해서 소비**한다.
 *
 * ## 판정 — next-stage-preview가 낸 답만 쓴다 (산술 복제 0건)
 *
 * "다음 전환이 언제인가"를 이 파일이 다시 계산하지 않는다. `buildNextStagePreview`
 * (src/items/next-stage-preview.ts)가 이미 답하고 있다 — 임신 갈래의 "다음 경계는 출산
 * 예정일" 규칙과 리뷰 H-1의 예외(임신 기본 칩 = 목적지 밴드여도 D-day는 유의미하다)까지
 * 포함해서. 여기서 도메인 개월 산술·밴드 매핑·일수 계산을 직접 부르면 배너와 알림이 조용히
 * 갈라진다 — 이월 사유가 바로 그 겹침이었다.
 *
 * 그 함수의 입력 둘(`selectedBand`·`celebrationVisible`)은 **화면 상태**이고 알림함에는 그
 * 개념이 없다. 그래서 이렇게 소비한다:
 *  - `celebrationVisible: false` — 알림함에는 배너 슬롯 경합이 없다(축하 배너 양보는 화면
 *    한 자리의 규칙이다).
 *  - `selectedBand`는 **탐침 두 번**으로 지운다: 서로 다른 밴드 둘을 차례로 넘겨 먼저 서는
 *    답을 쓴다. 출생 갈래의 "이미 그 밴드를 보는 중 → 숨김" 억제는 selectedBand가 목적지
 *    밴드와 같을 때만 서므로, **서로 다른 두 값 중 적어도 하나는 목적지와 다르다** — 달력
 *    사실(전환이 다가온다)은 두 번 안에 반드시 드러난다. 임신 갈래는 애초에 그 억제의
 *    예외라(H-1) 첫 탐침이 늘 답한다. 판정 로직을 옮겨 적지 않고 소비만 하기 위한 값이라,
 *    탐침 밴드 자체에는 아무 의미가 없다.
 *
 * ## 창 — 배너의 14일 안에서 **7일**만
 *
 * 배너는 D-14부터 서서 매일 화면에서 말하지만, 알림은 목록에 얼어붙는 스냅숏이라 더 급한
 * 사실만 남긴다 — 전환이 7일 이내로 들어온 그 시점 한 번. D-0(당일)과 지난 날은 배너 판정이
 * 이미 null이고(그날부터는 기본 칩과 stage_transition 알림이 새 시기를 말한다), D-8 밖은
 * 여기서 거른다.
 *
 * ## 멱등 — 같은 전환에 1회 (기존 generators 관례 그대로)
 *
 * dedupeKey가 `stage_transition_d7:{childId}:{전환 시작일}`이라, 스토어의 dedupe 메모리
 * (notification.store.ts seenDedupeKeys)가 D-7~D-1 사이의 재평가를 전부 막는다 — 키에
 * 오늘이나 D-N이 들어가면 매일 새 알림이 되므로 **전환 식별자(시작일)만** 담는다. 예정일·
 * 생일이 수정돼 전환일이 달라지면 키가 갈리며 새 사실로 다시 선다(재클릭이 새 clickedAt으로
 * 다시 서는 purchase_pending과 같은 성질).
 *
 * ## 종류 — `stage_transition`을 그대로 쓴다 (새 종류를 만들지 않는 이유)
 *
 * `KnownAppNotificationType`(notification.store.ts)은 닫힌 유니온이고, 저장본 검증
 * (`VALID_TYPES`)·설정 화면 스위치(NOTIFICATION_TYPE_OPTIONS)·알림함 아이콘 맵이 전부 그
 * 목록 위에 서 있다. 새 종류를 세우면 그 세 자리를 함께 고쳐야 하는데(전부 이 트랙의 소유
 * 밖), 고치지 않으면 재수화에서 항목이 조용히 떨어진다(sanitizedEntries). 이 알림이 말하는
 * 사실도 같은 가족이다 — "시기 변화"의 예고형. 그래서 종류를 재사용한다: 설정의 "시기 변화
 * 알림" 스위치가 예고까지 함께 끄고(같은 주제를 두 스위치로 쪼개지 않는다), 탭 목적지도
 * stage_transition의 관례 그대로 준비템 탭이다(notification-route.ts → "/(tabs)/items").
 * 구분은 dedupeKey 접두(`stage_transition_d7:`)가 진다 — 키를 파싱하는 자리는 오늘
 * purchase_pending·monthly_wrapup 둘뿐이라 접두가 갈려도 아무도 헛읽지 않는다.
 *
 * ## 문구 (DNC-018 해요체 · DNC-020 의료 조언 0글자)
 *
 * 시점어("곧"·"이번 주")를 넣지 않고 **전환 날짜**를 적는다 — 알림은 스냅숏이라 시점어는 한
 * 주 뒤 스스로 거짓이 된다(monthly_wrapup이 "지난달" 대신 "7월"이라 말하는 그 규칙).
 * 아이 이름 인접 조사는 값에서 고른다(src/text/korean-particles.ts — 태명은 사용자가 지은
 * 값이라 받침이 갈린다). 본문은 중립적 준비 안내 한 줄이다: 구매를 재촉하지 않고
 * (next-stage-preview 머리말의 규율), 발달·의료 정보를 말하지 않는다 — "시기"는 카탈로그의
 * 밴드 라벨일 뿐이다.
 *
 * ## standalone 패리티
 *
 * 순수 함수다: 시계를 읽지 않고(`todayIso` 주입 — next-stage-preview와 같은 관례), 요청을
 * 내지 않는다. 입력 셋(stageMode·dueDate·birthDate)은 화면이 이미 구독 중인 `["children"]`
 * 캐시의 행이고, 로컬 백엔드(src/api/local-backend.ts)도 같은 필드를 그대로 서빙하므로
 * 데모/스탠드얼론 세션에서도 실계정과 똑같이 돈다(notification.store.ts 머리말의 계약).
 * 서버 신규 엔드포인트 0건.
 *
 * ## 알려진 한계 — 발화 뒤의 문장은 노화한다 (라운드 98 리뷰 L-5)
 *
 * 문구는 발화 시점의 사실이다: "9월 15일이에요"는 예정일이 그 뒤 수정되거나 전환일이 지나면
 * 알림함 목록에 **거짓 시제로 얼어붙는다**. 이는 monthly_wrapup 등 목록형 알림 전부가 공유하는
 * 성질이고(발화 시점 스냅샷 — 목록은 이력이지 현재 상태가 아니다), 시점어("오늘"·"내일")를
 * 금지하는 이 모듈의 규칙은 노화 속도를 늦출 뿐 시제까지 막지는 못한다. 예정일이 갈리면 새
 * 키의 새 문장이 서고(테스트 "전환일이 달라지면 새 사실로 다시 선다"), 옛 문장은 남는다 —
 * 그 선택의 근거가 이 문단이다.
 */

/** 예고 창(일). 배너의 14일 안쪽 — 이 안으로 들어와야 알림이 선다. */
const PREVIEW_NOTIFICATION_WINDOW_DAYS = 7;

/**
 * 탐침 밴드 둘 — **서로 다르기만 하면 된다**(머리말의 소비 방식). 목적지 밴드가 첫 값과
 * 같아 출생 갈래 억제에 삼켜지는 경우에만 둘째 값이 쓰인다.
 */
const PROBE_BANDS: readonly [StageBandLabel, StageBandLabel] = ["0-6개월", "6-12개월"];

export type StagePreviewD7Input = {
  childId: string;
  /** 태명 — 조사가 받침에서 갈리므로 문구는 값에서 조사를 고른다. */
  childName: string;
  /** Child.stageMode — next-stage-preview가 "pregnant"·"born"만 판정한다(그 밖은 침묵). */
  stageMode: unknown;
  /** Child.dueDate ("YYYY-MM-DD") — 임신 갈래의 유일한 경계 입력. */
  dueDate?: unknown;
  /** Child.birthDate ("YYYY-MM-DD") — 출생 갈래의 유일한 경계 입력. */
  birthDate?: unknown;
  /** 서울 기준 오늘("YYYY-MM-DD") — 주입한다(이 모듈은 시계를 읽지 않는다). */
  todayIso: string;
};

/**
 * `stage_transition_d7:{childId}:{전환 시작일}` — 키를 만드는 자리가 여기 하나다
 * (monthlyWrapupDedupeKey와 같은 관례: 형식을 두 번 적지 않는다).
 */
export function stagePreviewD7DedupeKey(childId: string, startDateIso: string): string {
  return `stage_transition_d7:${childId}:${startDateIso}`;
}

/**
 * 다가온 전환 판정 — next-stage-preview에 **묻기만** 한다(머리말의 탐침 두 번).
 * 화면 상태가 없는 자리라 celebrationVisible은 늘 false다.
 */
function upcomingTransition(input: StagePreviewD7Input): NextStagePreview | null {
  const base = {
    stageMode: input.stageMode,
    dueDate: input.dueDate,
    birthDate: input.birthDate,
    todayIso: input.todayIso,
    celebrationVisible: false
  };
  return (
    buildNextStagePreview({ ...base, selectedBand: PROBE_BANDS[0] }) ??
    buildNextStagePreview({ ...base, selectedBand: PROBE_BANDS[1] })
  );
}

/**
 * 시기 전환 D-7 예고 한 건. 세울 이유가 없으면 null — 전환이 7일 밖이거나, 당일·지난 날이거나
 * (배너 판정이 이미 null), 수동 단계·날짜 없음·형식 오류(지어내지 않는다 — 전부
 * next-stage-preview의 숨김 규칙 그대로다).
 */
export function stagePreviewD7Notification(input: StagePreviewD7Input): AppNotificationCandidate | null {
  const preview = upcomingTransition(input);
  if (preview === null) return null;
  if (preview.daysUntil > PREVIEW_NOTIFICATION_WINDOW_DAYS) return null;

  // 전환 날짜는 판정이 낸 startDateIso에서 되읽는다(형식은 판정이 이미 보증한 "YYYY-MM-DD" —
  // monthly_wrapup이 yearMonth에서 달을 되읽는 것과 같은 방식).
  const month = Number(preview.startDateIso.slice(5, 7));
  const day = Number(preview.startDateIso.slice(8, 10));

  // 임신 갈래의 경계는 출산 예정일 그 자체다. 라운드 98 리뷰 L-6: 갈래도 판정이 낸 값
  // (preview.kind)에서 읽는다 — 종전에는 stageMode를 다시 봤고(오늘은 동치), 그건
  // next-stage-preview가 갈래 조건을 바꾸는 날 조용히 어긋나는 미세 복제였다.
  const title =
    preview.kind === "birth"
      ? `『${input.childName}』${objectParticle(input.childName)} 만날 예정일이 ${month}월 ${day}일이에요.`
      : `『${input.childName}』${subjectParticle(input.childName)} ${month}월 ${day}일에 ${preview.band} 시기에 들어서요.`;

  return {
    type: "stage_transition",
    title,
    // 중립적 준비 안내만(DNC-020) — 구매 재촉도, 발달·의료 정보도 없다. 어휘는 배너의
    // "준비물을 미리"를 그대로 문다(같은 판정의 두 표면이 같은 말을 쓴다).
    body: `${preview.band} 준비물을 미리 확인해 보세요.`,
    dedupeKey: stagePreviewD7DedupeKey(input.childId, preview.startDateIso),
    childId: input.childId
  };
}
