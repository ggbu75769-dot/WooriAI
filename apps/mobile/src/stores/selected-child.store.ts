import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  fixtureRuntimeEnabled,
  LOCAL_CHILD_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID
} from "../api/fixture-identifiers";
import { zustandPersistStorage } from "./persist-storage";

export type SelectedChildState = {
  selectedChildId: string | null;
  selectedChildHouseholdId: string | null;
  selectedChildScopeKey: string | null;
  activeScopeKey: string | null;
  activateScope: (scopeKey: string | null) => void;
  setSelectedChildId: (childId: string, householdId?: string | null) => void;
  clearSelectedChildId: () => void;
};

/** Defensive shape check for a persisted blob from an unknown/older app version -- anything that
 * doesn't look like a valid selectedChildId falls back to null instead of feeding a malformed
 * value (wrong type) into the store, where it would silently break every screen's
 * `Boolean(authToken && childId)` gating. */
function sanitizedSelectedChildId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string" && value.length > 0) {
    // Local child IDs are reserved for the isolated qualification runtime. A
    // production upgrade clears every stale local selection, while the active
    // internal fixture may retain only its current canonical ID.
    if (value.startsWith("local-child-") && (!fixtureRuntimeEnabled || value !== LOCAL_CHILD_ID)) return null;
    return value;
  }
  return null;
}

export const useSelectedChildStore = create<SelectedChildState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      selectedChildHouseholdId: null,
      selectedChildScopeKey: null,
      activeScopeKey: null,
      activateScope: (scopeKey) => set((state) => state.selectedChildScopeKey === scopeKey
        ? { activeScopeKey: scopeKey }
        : {
            activeScopeKey: scopeKey,
            selectedChildId: null,
            selectedChildHouseholdId: null,
            selectedChildScopeKey: scopeKey
          }),
      setSelectedChildId: (childId, householdId) => set((state) => ({
        selectedChildId: childId,
        // A caller that only knows an ID must remain unscoped until the child
        // API resolves its authoritative household. Guessing the session's
        // default household can cross family data boundaries.
        selectedChildHouseholdId: householdId ?? null,
        selectedChildScopeKey: state.activeScopeKey
      })),
      clearSelectedChildId: () => set((state) => ({
        selectedChildId: null,
        selectedChildHouseholdId: null,
        selectedChildScopeKey: state.activeScopeKey
      }))
    }),
    {
      name: "wooriai-selected-child",
      storage: createJSONStorage(() => zustandPersistStorage),
      // MOB-107: no structural changes yet, but bumped so a future schema change has a `migrate`
      // hook to run against data written by this version.
      version: 4,
      migrate: (persisted) => ({
        selectedChildId: sanitizedSelectedChildId(
          persisted && typeof persisted === "object" ? (persisted as { selectedChildId?: unknown }).selectedChildId : undefined
        ),
        selectedChildHouseholdId:
          persisted &&
          typeof persisted === "object" &&
          typeof (persisted as { selectedChildHouseholdId?: unknown }).selectedChildHouseholdId === "string"
            ? (persisted as { selectedChildHouseholdId: string }).selectedChildHouseholdId
            : null,
        selectedChildScopeKey: persisted && typeof persisted === "object" && typeof (persisted as { selectedChildScopeKey?: unknown }).selectedChildScopeKey === "string"
          ? (persisted as { selectedChildScopeKey: string }).selectedChildScopeKey
          : null,
        activeScopeKey: null
      }),
      merge: (persisted, current) => ({
        ...current,
        selectedChildId: sanitizedSelectedChildId(
          persisted && typeof persisted === "object" ? (persisted as { selectedChildId?: unknown }).selectedChildId : undefined
        ),
        selectedChildHouseholdId:
          persisted &&
          typeof persisted === "object" &&
          typeof (persisted as { selectedChildHouseholdId?: unknown }).selectedChildHouseholdId === "string"
            ? (persisted as { selectedChildHouseholdId: string }).selectedChildHouseholdId
            : null,
        selectedChildScopeKey: persisted && typeof persisted === "object" && typeof (persisted as { selectedChildScopeKey?: unknown }).selectedChildScopeKey === "string"
          ? (persisted as { selectedChildScopeKey: string }).selectedChildScopeKey
          : null,
        activeScopeKey: null
      })
    }
  )
);

export function selectedChildScopeKey(userId: string, householdId: string) {
  return JSON.stringify([userId, householdId]);
}

/**
 * A selected child is authoritative for household scoping. Until that child's
 * household has been resolved, callers must remain unscoped instead of
 * falling back to the signed-in user's default household.
 */
export function householdIdForSelectedChildScope(
  selectedChildId: string | null,
  selectedChildHouseholdId: string | null,
  defaultHouseholdId: string | null
): string | null {
  return selectedChildId ? selectedChildHouseholdId : defaultHouseholdId;
}

/**
 * Local qualification sessions intentionally do not persist a real default
 * household. Feature screens still need the isolated fixture household, while
 * real sessions must keep the selected-child fail-closed boundary above.
 */
export function householdIdForFeatureScope(
  selectedChildId: string | null,
  selectedChildHouseholdId: string | null,
  defaultHouseholdId: string | null,
  isTestSession: boolean
): string | null {
  return isTestSession
    ? LOCAL_HOUSEHOLD_ID
    : householdIdForSelectedChildScope(
        selectedChildId,
        selectedChildHouseholdId,
        defaultHouseholdId
      );
}

export function selectedChildScopeKeyForSession(
  userId: string | null,
  householdId: string | null,
  isTestSession: boolean
) {
  const scopedUserId = userId ?? (isTestSession ? LOCAL_USER_ID : null);
  const scopedHouseholdId = householdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  return scopedUserId && scopedHouseholdId
    ? selectedChildScopeKey(scopedUserId, scopedHouseholdId)
    : null;
}
