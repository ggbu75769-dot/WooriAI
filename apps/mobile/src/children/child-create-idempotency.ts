/**
 * FIX-118B(F2): Idempotency-Key for the *settings* 아이 추가 path (app/settings/children.tsx).
 *
 * Onboarding (ONB-002/MOB-101) already reuses one stable key per child-profile submission via
 * useOnboardingProgressStore.getOrCreateChildCreateIdempotencyKey, so a lost response can be
 * retried without the server creating a second child. The settings add-form had no key at all:
 * a timed-out POST /children that actually succeeded server-side turned a user retry into two
 * children for the household.
 *
 * The settings path deliberately gets its OWN key rather than sharing the onboarding store's:
 * that key is persisted to disk and cleared by onboarding's own lifecycle (resetOnboarding),
 * and its whole point is "the single onboarding child draft". Adding a second child from
 * settings is a different, deliberately repeatable action, so its key lives only as long as the
 * screen's input session:
 *
 *   - one key per input session -- created when the add form opens (or lazily on first submit)
 *     and reused by every retry of that same submission,
 *   - rotated on success -- so the next 아이 추가 is a genuinely new creation with a new key
 *     (never deduplicated against the child that was just created).
 *
 * ## 라운드 99 트랙 F1(M) — **키는 본문에 묶인다** (⚠️ 두 시점)
 *
 * 종전 홀더는 키 문자열 하나였다: "같은 입력 세션이면 같은 키"가 규칙이라, 사용자가 응답을
 * 잃은 뒤 **입력을 고쳐** 다시 제출해도 같은 키가 나갔다. 서버 멱등 인터셉터는 같은 키 +
 * **다른 본문**에 409 IDEMPOTENCY_KEY_CONFLICT를 24시간 동안 돌려주므로(apps/api
 * common/idempotency/idempotency.interceptor.ts), 그 사람은 무엇을 고쳐도 같은 409를 도는
 * 막다른 길에 갇혔다 — 게다가 그 코드는 오류 표에 없어 "네트워크를 확인하라"는 틀린 안내까지
 * 받았다(그 표 쪽 수리는 src/api/api-error.ts).
 *
 * 그래서 키를 만들 때 **제출 본문의 정규화 지문**을 함께 저장하고, 본문이 달라지면 새 키를
 * 발급한다. 멱등 보호가 지키려는 것은 애초에 "같은 제출의 재시도"뿐이다 — 본문이 다르면
 * 그것은 재시도가 아니라 새 제출이고, 그때 옛 키를 재사용하는 것이 곧 위 409였다.
 * 같은 규칙이 온보딩 쪽 키에도 선다(src/stores/onboarding-progress.store.ts).
 */

/**
 * 라운드 99 트랙 F1(M): 아이 생성 본문의 **정규화 지문**. 키 회전 판정("이 제출이 지난 제출과
 * 같은 본문인가")에만 쓰는 값이라 암호학적일 필요가 없다 — 필요한 성질은 같은 본문 → 같은 값,
 * 다른 본문 → (사실상 언제나) 다른 값, 둘뿐이다(FNV-1a 32비트).
 *
 * 정규화: 키를 정렬하고 `undefined` 필드를 떨군다. `buildCreateChildBody`는 단계가 바뀌면
 * 반대쪽 날짜 필드를 `undefined`로 남기는데, 그 부재가 직렬화마다 다르게 보이면 같은 본문이
 * 다른 지문을 얻는다(JSON.stringify는 undefined 값을 떨구지만, 명시적으로 걸러 그 사실에
 * 기대지 않는다).
 */
export function childCreateBodyFingerprint(body: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(body)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        if (body[key] !== undefined) normalized[key] = body[key];
        return normalized;
      }, {})
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Mutable one-slot holder -- a `useRef<...>(null)` satisfies this shape.
 * 라운드 99 트랙 F1(M): ⚠️ 두 시점 — 종전에는 `{ current: string | null }`(키 하나)였다.
 * 이제 키와 그 키를 발급받은 본문의 지문이 **한 슬롯**에 함께 산다: 지문 없는 키는 "어느
 * 본문의 키인지 모른다"는 뜻이라 재사용 판정을 할 수 없기 때문이다.
 */
export type ChildCreateKeyHolder = { current: { key: string; bodyFingerprint: string } | null };

/**
 * Not cryptographically random -- same rationale as the onboarding store's generator: the key
 * only has to be stable across retries of one submission and distinct across separate ones.
 * The `set-child-` prefix keeps settings-created children distinguishable from onboarding's
 * `onb-child-` keys in server-side idempotency records.
 */
export function generateChildCreateIdempotencyKey(): string {
  return `set-child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The key for the current submission, creating it on first use and reusing it on retries.
 *
 * 라운드 99 트랙 F1(M): ⚠️ 두 시점 — 종전 시그니처는 홀더 하나였다("같은 입력 세션 = 같은 키").
 * 이제 제출 본문의 지문을 함께 받아, **지문이 같을 때만** 키를 재사용한다. 본문이 달라졌으면
 * (사용자가 입력을 고쳐 재제출) 새 키를 발급해 서버 409(IDEMPOTENCY_KEY_CONFLICT) 루프를
 * 만들지 않는다 — 멱등 보호는 동일 본문 재시도에만 필요하다.
 */
export function getOrCreateChildCreateKey(holder: ChildCreateKeyHolder, bodyFingerprint: string): string {
  if (!holder.current || holder.current.bodyFingerprint !== bodyFingerprint) {
    holder.current = { key: generateChildCreateIdempotencyKey(), bodyFingerprint };
  }
  return holder.current.key;
}

/** Drops the current key so the next submission starts a fresh idempotency scope. */
export function rotateChildCreateKey(holder: ChildCreateKeyHolder): void {
  holder.current = null;
}
