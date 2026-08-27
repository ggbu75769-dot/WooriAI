/**
 * 라운드 40 J-3 — 역할 표를 **서버 기준으로 다시 확인하는** 순간 하나.
 *
 * 문제: 세션 스토어의 역할 표를 채우는 경로가 셋 다 사용자 행동에 달려 있었다.
 *  - 로그인 응답: 그 시점의 역할(그 뒤의 승격은 알 수 없다);
 *  - 초대 수락 응답: 방금 참여한 가구 하나;
 *  - 가족 화면 방문: `defaultHouseholdId` **한 가구**의 구성원 목록.
 * 그래서 보기 전용에서 공동부모로 승격된 사람은 가족 화면을 다시 열기 전까지 계속 잠긴 채였고,
 * 기본 가구가 아닌 가구의 승격은 그 화면이 아예 조회하지 않아 영영 반영되지 않았다. 잠긴 사람은
 * "기록은 관리자·공동부모가 남길 수 있어요"를 계속 보게 되는데, 서버에서는 이미 남길 수 있는
 * 사람일 수 있다는 뜻이다.
 *
 * 고치는 방향: **잠금 안내를 보여 주는 그 순간이 곧 재검증 트리거**다. 사용자가 기록을 하려다
 * 막힌 자리이므로 "지금 서버가 뭐라고 하는지"가 가장 필요한 시점이고, 새 화면·새 설정·주기적
 * 폴링을 만들지 않아도 된다. 조회는 백그라운드(fire-and-forget)라 안내는 지금 그대로 뜨고,
 * 승격돼 있었다면 표가 갱신되어 **다음 탭부터** 열린다.
 *
 * 이 모듈은 "언제 부를 것인가"만 안다 — 무엇을 부르는지(GET /me)도, 무엇을 갱신하는지(세션
 * 스토어)도 호출부가 넘긴다. react/react-native·스토어·네트워크에 의존하지 않아 vitest에서
 * 그대로 돌릴 수 있다(같은 폴더의 record-permissions.ts와 같은 관례).
 */

/** 재조회 최소 간격. 안내를 여러 번 눌러도 이 간격 안에서는 한 번만 나간다. */
export const ROLE_REVALIDATE_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type HouseholdRoleSnapshot = { id: string; role?: string | null };

export type RoleRevalidationRequest = {
  /** 지금 시각(Date.now()) — 모듈이 시계를 들지 않는다. */
  now: number;
  /**
   * 서버가 지금 말하는 가구·역할 목록(GET /me).
   *
   * 라운드 41 K-4: 반환 타입이 **목록 없음(undefined/null)까지** 포함한다. 호출부가 부재 응답을
   * `?? []`로 메워 넘기면 아래의 "목록이 없으면 표를 건드리지 않는다"는 계약이 그 자리에서
   * 무력화되고(빈 배열은 배열이다), 서버가 아무 말도 하지 않은 순간에 역할 표가 통째로
   * 지워진다 — 즉 잠겨 있어야 할 보기 전용 세션의 잠금이 근거 없이 풀린다.
   */
  fetchHouseholds: () => Promise<ReadonlyArray<HouseholdRoleSnapshot> | null | undefined>;
  /** 받아 온 목록으로 역할 표를 갈아 끼운다(세션 스토어의 setHouseholdRoles). */
  applyHouseholds: (households: ReadonlyArray<HouseholdRoleSnapshot>) => void;
  /**
   * 라운드 41 K-3: 스로틀을 건너뛴다(진행 중인 요청이 있으면 그래도 겹쳐 보내지 않는다).
   *
   * 스로틀의 전제는 "같은 사실을 반복해서 묻는다"이다 — 잠금 안내를 여러 번 누르는 자리가
   * 그렇다. 그런데 **표가 방금 바뀐 것을 아는 순간**(초대 수락 응답)은 그 전제가 성립하지
   * 않는다. 그 한 번을 스로틀에 먹히면 새 가구의 역할·가구 목록이 재로그인 전까지 갱신되지
   * 않아, K-3가 고치려는 "ids 영구 null" 상태가 그대로 남는다.
   */
  force?: boolean;
};

export type HouseholdRoleRevalidator = {
  /**
   * 재검증을 요청한다. 실제로 조회를 **시작했으면** true, 스로틀·중복 요청으로 건너뛰었으면
   * false. 어느 쪽이든 호출부의 안내는 지금 그대로 뜬다.
   */
  request: (input: RoleRevalidationRequest) => boolean;
};

/**
 * 앱 세션 하나짜리 스로틀. 호출부(useExpenseEntryGate)는 이것을 **모듈 지역**에 하나 두므로
 * 화면 리마운트에는 살아남고 콜드 스타트에는 비워진다 — PurchaseFollowupPrompt의 세션 게이트와
 * 같은 수명 규칙이다.
 *
 * 실패해도 스로틀은 그대로 소진한다: 오프라인에서 안내를 누를 때마다 요청이 나가면 잠긴
 * 사용자에게만 조용한 재시도 폭풍이 생긴다. 다음 간격에 다시 시도하면 충분하고, 그때까지의
 * 결과는 "예전 표 그대로"라 아무것도 새로 잠기지 않는다.
 */
export function createHouseholdRoleRevalidator(options?: {
  minIntervalMs?: number;
}): HouseholdRoleRevalidator {
  const minIntervalMs = options?.minIntervalMs ?? ROLE_REVALIDATE_MIN_INTERVAL_MS;
  let lastRequestedAt: number | null = null;
  let inFlight = false;

  return {
    request: ({ now, fetchHouseholds, applyHouseholds, force }) => {
      if (inFlight) return false;
      if (!force && lastRequestedAt !== null && now - lastRequestedAt < minIntervalMs) return false;
      lastRequestedAt = now;
      inFlight = true;
      // 조회는 **지금 바로** 시작한다(마이크로태스크로 미루지 않는다) — 안내가 뜬 그 순간의
      // 서버 상태를 묻는 것이 요점이고, 동기 예외도 아래 catch가 함께 받는다.
      void (async () => fetchHouseholds())()
        .then((households) => {
          // 서버가 목록을 주지 않으면(예상치 못한 응답) 표를 건드리지 않는다 — 빈 표로
          // 덮어쓰면 "모름"이 되어 잠금이 풀릴 뿐이지만, 근거 없이 상태를 바꾸지는 않는다.
          if (Array.isArray(households)) applyHouseholds(households);
        })
        .catch(() => {
          // 조용히 실패한다. 사용자는 이미 안내를 봤고, 재조회는 부가 작업이다.
        })
        .finally(() => {
          inFlight = false;
        });
      return true;
    }
  };
}

/* ------------------------------------------------- 1회성 자가 치유 래치 (L-1) */

/**
 * 라운드 42 L-1 — "앱 세션당 한 번"짜리 시도를 묶는 래치.
 *
 * 왜 모듈로 빼는가: 라운드 41 K-3의 자가 치유(표는 있는데 가구 목록은 모름)는 호출부에서
 * **먼저 래치를 소진한 뒤** 재검증을 부르는 모양이었다. 그런데 재검증은 스로틀에 먹혀
 * 요청이 아예 나가지 않을 수 있다(초대 수락 직후 force 요청이 실패해 `lastRequestedAt`만
 * 세워진 경우가 정확히 그렇다). 그러면 **요청은 안 나갔는데 래치만 소진**되어, 그 앱 세션이
 * 끝날 때까지 다시는 시도하지 않는 막힌 상태가 남는다 — K-3가 고치려던 바로 그 상태다.
 *
 * 그래서 "소진 조건"을 여기 한 줄로 못 박는다: **실제로 발사됐을 때만** 소진한다.
 * 발사 여부는 `request`가 이미 boolean으로 돌려주고 있다(위 `HouseholdRoleRevalidator`).
 */
export type OneShotRevalidationLatch = {
  /**
   * 아직 소진되지 않았으면 `fire`를 부른다. `fire`가 true(실제 발사)를 돌려줬을 때만 래치를
   * 소진하고, false(스로틀·중복·비세션으로 건너뜀)면 **그대로 열어 둔다** — 다음 기회에 다시
   * 시도한다. 반환값은 이번에 실제로 발사됐는지 여부다.
   */
  attempt: (fire: () => boolean) => boolean;
  /** 래치를 다시 연다(로그아웃·세션 만료 — 다음 계정에는 그 계정 몫의 한 번이 필요하다). */
  reset: () => void;
  /** 이미 소진됐는가(테스트·진단용). */
  isSpent: () => boolean;
};

export function createOneShotRevalidationLatch(): OneShotRevalidationLatch {
  let spent = false;
  return {
    attempt: (fire) => {
      if (spent) return false;
      const fired = fire();
      if (fired) spent = true;
      return fired;
    },
    reset: () => {
      spent = false;
    },
    isSpent: () => spent
  };
}
