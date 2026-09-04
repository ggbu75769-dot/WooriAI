import { useCallback, useEffect, useRef, useState } from "react";

/**
 * T1(디자인 시스템) — **성공/실패 토스트의 수명 한 벌.**
 *
 * 같은 "잠깐 보였다 사라지는 안내"가 화면마다 다른 수명으로 살고 있었다(설정 → 아이 관리·더보기
 * 내보내기의 3200ms 타이머-in-ref 관례가 한쪽이고, 준비템 상세의 memoNotice처럼 **지워지지 않고
 * 화면 이탈까지 남는** 자리가 다른 쪽). 이 훅은 그 관례 중 이미 옳게 서 있던 쪽
 * (app/settings/children.tsx · app/(tabs)/more.tsx — 타이머를 ref에 들고, 겹치면 앞 타이머를
 * 걷고, 언마운트 뒤 setState를 막는다)을 그대로 한 벌로 올린 것이다.
 *
 * 호출부 채택(memoNotice 등)은 이번 라운드 범위 밖이다 — 이 파일은 API만 세운다.
 *
 * 시계 주입 규율: 이 훅은 절대 시각을 읽지 않는다. setTimeout은 경과를 기다릴 뿐 시각 값을
 * 만들지 않고, 테스트는 vi.useFakeTimers로 주입할 수 있다.
 */
export type TransientNoticeTone = "success" | "error";

export type TransientNotice = {
  message: string;
  tone: TransientNoticeTone;
};

/**
 * 기본 수명. 값의 출처는 이 저장소에서 이미 살아 있는 토스트 관례다
 * (app/settings/children.tsx의 showToast — "more.tsx's export toast와 같은 규율" 주석의 3200).
 * 새 수명을 짓지 않고 그 값을 단일 소스로 올린다.
 */
export function transientNoticeDurationMs(): number {
  return 3200;
}

export function useTransientNotice(durationMs?: number): {
  notice: TransientNotice | null;
  show: (message: string, tone?: TransientNoticeTone) => void;
  clear: () => void;
} {
  const duration = durationMs ?? transientNoticeDurationMs();
  const [notice, setNotice] = useState<TransientNotice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 뒤 setState 금지 -- 살아 있는 타이머를 걷는다(설정 → 아이 관리의 그 규율).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotice(null);
  }, []);

  const show = useCallback(
    (message: string, tone: TransientNoticeTone = "success") => {
      // 겹치면 앞 타이머를 걷는다 -- 두 번째 안내가 첫 타이머에 의해 조기 소멸하지 않는다.
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotice({ message, tone });
      timerRef.current = setTimeout(() => {
        setNotice(null);
        timerRef.current = null;
      }, duration);
    },
    [duration]
  );

  return { notice, show, clear };
}
