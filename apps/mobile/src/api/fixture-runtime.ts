import * as fixtureBackend from "./local-backend";
import {
  fixtureRuntimeEnabled,
  fixtureSessionToken,
  LOCAL_CHILD_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID,
  pixelEvidenceId
} from "./fixture-identifiers";
import { localCategoryNameKo } from "./local-fixtures";

export { LOCAL_CHILD_ID, LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID };
export { fixtureRuntimeEnabled, fixtureSessionToken, pixelEvidenceId };
export { fixtureBackend };
export { localCategoryNameKo };
export const ensureLocalBackendSeeded = fixtureBackend.ensureLocalBackendSeeded;
export const startLocalOnboardingSession = fixtureBackend.startLocalOnboardingSession;
export const resetLocalBackend = fixtureBackend.resetLocalBackend;
