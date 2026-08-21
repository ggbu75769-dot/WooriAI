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
 * The holder is shaped like a React ref ({ current }) so the screen can pass `useRef` straight
 * in, while these functions stay pure and unit-testable without react-native.
 */

/** Mutable one-slot holder -- a `useRef<string | null>(null)` satisfies this shape. */
export type ChildCreateKeyHolder = { current: string | null };

/**
 * Not cryptographically random -- same rationale as the onboarding store's generator: the key
 * only has to be stable across retries of one submission and distinct across separate ones.
 * The `set-child-` prefix keeps settings-created children distinguishable from onboarding's
 * `onb-child-` keys in server-side idempotency records.
 */
export function generateChildCreateIdempotencyKey(): string {
  return `set-child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The key for the current input session, creating it on first use and reusing it on retries. */
export function getOrCreateChildCreateKey(holder: ChildCreateKeyHolder): string {
  if (!holder.current) {
    holder.current = generateChildCreateIdempotencyKey();
  }
  return holder.current;
}

/** Drops the current key so the next submission starts a fresh idempotency scope. */
export function rotateChildCreateKey(holder: ChildCreateKeyHolder): void {
  holder.current = null;
}
