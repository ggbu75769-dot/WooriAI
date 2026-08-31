import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";
import type { KnownAppNotificationType } from "./notification.store";

/**
 * 라운드 52 C-08 — 인앱 알림 종류별 끄기.
 *
 * 왜 필요한가: 설정→알림 화면(SET-006)에는 푸시 마스터 토글 하나뿐인데, 이 빌드에서는
 * expo-notifications가 없어 그 토글이 **영구 비활성**이다(push-token-source.ts). 즉 그 화면에서
 * 사용자가 할 수 있는 일이 0개였다. 그런데 실제로 뜨는 알림은 푸시가 아니라 인앱 알림함
 * (NOTI-102/103, generators.ts가 만드는 5종)이고, 그건 끌 방법이 전혀 없었다 — 주간 요약이
 * 거슬려도, 구매 확인이 반복돼도 사용자가 손댈 수 있는 스위치가 없다는 뜻이다.
 *
 * 이 모듈이 그 스위치의 **단일 소스**다: 어떤 종류가 있는지(순서 포함), 각 종류를 사용자에게
 * 뭐라고 부르는지, 무엇을 알려주는지, 그리고 지금 무엇이 꺼져 있는지. 화면(app/settings/
 * notifications.tsx)은 이 목록을 그대로 그리고, 생성 경로(notification.store.ts의 ingest)는
 * 이 목록을 그대로 필터에 쓴다 — 라벨과 실제 필터가 갈릴 수 없다.
 *
 * 저장 형태가 "꺼진 것들"(mutedTypes)인 이유: 기본값이 **전부 켬**이고, 나중에 알림 종류가
 * 늘어도 새 종류는 기본 켬으로 자연히 합류한다(켜진 목록을 저장하면 옛 blob에 없는 새 종류가
 * 조용히 꺼진 채로 시작한다). persist 관례는 저장소의 다른 스토어와 같다
 * (purchase-followup.store.ts / notification.store.ts): version + 방어적 sanitize를 migrate와
 * merge 양쪽에 물린다.
 *
 * ⚠️ 세션 교체(src/offline/session-teardown.ts)에서 **초기화하지 않는다**. 여기 담기는 값은
 * 계정 데이터가 아니라 "이 기기에서 어떤 알림을 보고 싶은가"라는 기기 단위 선택이고
 * (childId·금액·문구 어느 것도 들어오지 않는다), 계정이 바뀌었다고 사용자가 껐던 알림을 다시
 * 켜 주는 편이 더 놀랍다. 알림 이력·dedupe 키는 사용자 단위라 예전대로 notification.store의
 * resetAll이 지운다.
 */

export type NotificationTypeOption = {
  type: KnownAppNotificationType;
  /** 설정 화면의 스위치 이름. */
  label: string;
  /** 그 스위치가 무엇을 켜고 끄는지 한 줄 설명(DNC-018 해요체). */
  description: string;
};

/**
 * 화면에 보이는 순서 그대로의 7종(GAP-054 #6에서 record_gap이, GAP-066 #8에서 monthly_wrapup이
 * 합류했다). generators.ts가 실제로 만드는 종류와 1:1이고
 * (notification.store.ts의 `KnownAppNotificationType`이 그 계약을 타입으로 잡는다), 이 배열이
 * 설정 화면의 행 순서이기도 하다 — 예산 → 시기 → 구매 → 주간 → 기록 → 지난달.
 *
 * 문구는 "무엇이 있을 때 알리는가"만 말한다. 알림이 실제로 하는 일보다 크게 말하지 않는다
 * (예: 예산 알림은 이번 달 기준이고, 주간 요약은 한 주 합계다. 기록 리마인더도 "한 번"이라고
 * 밝힌다 -- 실제로 주 1회 dedupe라 매일 오지 않는다. 지난달 정리도 달마다 "한 번"이다).
 */
export const NOTIFICATION_TYPE_OPTIONS: readonly NotificationTypeOption[] = [
  {
    type: "budget_80",
    label: "예산 80% 알림",
    description: "이번 달 예산의 80%를 쓰면 알림함에 남겨요."
  },
  {
    type: "budget_100",
    label: "예산 100% 알림",
    description: "이번 달 예산을 다 쓰거나 넘기면 알림함에 남겨요."
  },
  {
    type: "stage_transition",
    label: "시기 변화 알림",
    description: "아이가 새로운 시기에 들어서면 알림함에 남겨요."
  },
  {
    type: "purchase_pending",
    label: "구매 확인 알림",
    description: "구매 링크를 누른 뒤 기록이 남았는지 물어봐요."
  },
  {
    type: "weekly_summary",
    label: "주간 요약 알림",
    description: "한 주 지출을 모아 알림함에 남겨요."
  },
  {
    // GAP-054 #6. 새 종류가 이 배열에 합류하는 것만으로 설정 화면에 스위치가 생기고(화면은 이
    // 목록을 그대로 그린다) 끌 수 있게 된다 -- 저장 형태가 "꺼진 것들"이라 기존 사용자에게는
    // 기본 켬으로 들어간다(이 파일 머리말 참고).
    type: "record_gap",
    label: "기록 리마인더",
    description: "며칠 동안 기록이 없으면 한 번 알려드려요."
  },
  {
    // GAP-066 #8. record_gap과 같은 방식으로 합류한다 — 이 배열에 행 하나를 더하면 설정 화면에
    // 스위치가 생기고(화면은 이 목록을 그대로 그린다) 생성 경로의 필터도 같은 목록을 쓴다.
    // 저장 형태가 "꺼진 것들"이라 기존 사용자에게는 기본 켬으로 들어간다(이 파일 머리말).
    type: "monthly_wrapup",
    label: "지난달 정리 알림",
    description: "달이 바뀌면 지난달 지출을 한 번 알려드려요."
  }
] as const;

/**
 * 종류 → 라벨. 화면이 목록을 돌지 않고 한 종류만 이름 지을 때 쓴다(옛 저장본은 undefined).
 *
 * ⚠ **테스트 전용 export**(라운드 71 리뷰 S-8 관례 · 라운드 88 트랙 D가 이유를 대장에서 여기로
 * 옮겼다). 바로 위 한 줄이 `notificationTypeLabel`을 쓰는 조건을 적어 두었는데 **그 조건을
 * 만족하는 화면이 오늘 0건**이다 —
 * 설정 화면은 종류 하나를 이름 짓는 대신 `NOTIFICATION_TYPE_OPTIONS`를 그대로 돌면서 스위치를
 * 그리고, 라벨은 그 순회 안에서 이미 손에 있다. **지우지 않는다** — 알림 하나를 단독으로 이름
 * 짓는 자리(배지·상세)가 생기면 그때 필요한 것이 이 함수이고, 옛 저장본이 남긴 모르는 종류가
 * undefined로 떨어진다는 사실도 여기서만 이름으로 잡힌다.
 */
export function notificationTypeLabel(type: string): string | undefined {
  return NOTIFICATION_TYPE_OPTIONS.find((option) => option.type === type)?.label;
}

/** 이 문자열이 우리가 아는 알림 종류인가(옛/손상 blob 방어). */
export function isKnownNotificationType(value: unknown): value is KnownAppNotificationType {
  return typeof value === "string" && NOTIFICATION_TYPE_OPTIONS.some((option) => option.type === value);
}

/**
 * 이 종류의 알림을 지금 만들어도 되는가.
 *
 * 모르는 종류(옛 빌드가 남긴 후보 등)는 **켠 것으로 본다** — 설정 화면에 스위치가 없는 알림을
 * 조용히 막아 버리면 사용자가 되살릴 방법이 없다.
 */
export function isNotificationTypeEnabled(mutedTypes: readonly string[], type: string): boolean {
  return !mutedTypes.includes(type);
}

/**
 * 스위치 하나를 켜고 끈 뒤의 mutedTypes. 값이 바뀌지 않으면 **같은 배열**을 돌려준다
 * (zustand 구독자가 헛돌지 않게 — notification.store.ts의 markAllNotificationsRead와 같은 관례).
 */
export function setNotificationTypeMuted(
  mutedTypes: readonly string[],
  type: KnownAppNotificationType,
  muted: boolean
): readonly string[] {
  const alreadyMuted = mutedTypes.includes(type);
  if (alreadyMuted === muted) return mutedTypes;
  return muted ? [...mutedTypes, type] : mutedTypes.filter((muted_) => muted_ !== type);
}

/**
 * C-08(b) — 생성 경로의 필터. 꺼진 종류의 후보를 **ingest에 닿기 전에** 떨어뜨린다.
 *
 * 여기가 핵심 계약이다: 떨어뜨린 후보는 `addNotifications`를 보지 못하므로 그 **dedupeKey가
 * 소모되지 않는다**. 즉 "끈 동안에는 만들지 않을 뿐"이고, 사용자가 다시 켜면 다음 평가에서
 * 평소대로 발화한다(이번 달 예산 80% 알림을 껐다가 같은 달에 다시 켜면 그 달의 알림을 그대로
 * 받는다). 반대로 dedupe 메모리에 키를 남기며 거르면, 껐다 켠 사용자는 그 달·그 주의 알림을
 * 영영 못 받는다 — "끄기"가 "영구 삭제"로 조용히 바뀌는 셈이라 그렇게 하지 않는다.
 *
 * 그래서 이 함수는 순수하고 스토어를 모른다(단위 테스트 대상). 호출부는 notification.store.ts의
 * ingest 하나뿐이라, 어느 경로로 들어온 후보든 같은 규칙을 지난다.
 */
export function filterMutedNotificationCandidates<T extends { type: string }>(
  candidates: readonly T[],
  mutedTypes: readonly string[]
): readonly T[] {
  if (mutedTypes.length === 0) return candidates;
  return candidates.filter((candidate) => isNotificationTypeEnabled(mutedTypes, candidate.type));
}

export type NotificationPreferencesState = {
  /** 사용자가 끈 알림 종류. 기본값 [] = 전부 켬. */
  mutedTypes: string[];
  setTypeEnabled: (type: KnownAppNotificationType, enabled: boolean) => void;
  /** 전부 다시 켠다(설정 화면에는 아직 노출하지 않는다 — 테스트/향후 복구용). */
  enableAll: () => void;
};

/** 저장된 blob에서 살릴 수 있는 값만 남긴다: 우리가 아는 종류의 문자열, 중복 없이. */
function sanitizedMutedTypes(value: unknown): string[] {
  const list = value && typeof value === "object" ? (value as { mutedTypes?: unknown }).mutedTypes : undefined;
  if (!Array.isArray(list)) return [];
  const muted: string[] = [];
  for (const candidate of list) {
    if (isKnownNotificationType(candidate) && !muted.includes(candidate)) muted.push(candidate);
  }
  return muted;
}

function sanitizedState(persisted: unknown) {
  return { mutedTypes: sanitizedMutedTypes(persisted) };
}

export const useNotificationPreferencesStore = create<NotificationPreferencesState>()(
  persist(
    (set) => ({
      mutedTypes: [],
      setTypeEnabled: (type, enabled) =>
        set((state) => {
          const next = setNotificationTypeMuted(state.mutedTypes, type, !enabled);
          return next === state.mutedTypes ? state : { mutedTypes: [...next] };
        }),
      enableAll: () => set((state) => (state.mutedTypes.length === 0 ? state : { mutedTypes: [] }))
    }),
    {
      name: "wooriai-notification-preferences",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
