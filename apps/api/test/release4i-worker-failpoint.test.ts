import { describe, expect, it } from "vitest";
import {
  WORKER_CRASH_FAILPOINT_FILE,
  workerCrashFailpointEnabled
} from "../src/common/operations/worker-crash-failpoint";
import {
  NOTIFICATION_ACK_FAILPOINT_FILE,
  notificationAckFailpointEnabled
} from "../src/common/operations/notification-ack-failpoint";

describe("Release 4I worker crash failpoint", () => {
  it("is enabled only for an explicit local-staging process", () => {
    expect(workerCrashFailpointEnabled({
      NODE_ENV: "development",
      APP_ENV: "local_staging",
      RELEASE4I_WORKER_CRASH_FAILPOINT: "1"
    })).toBe(true);
    expect(workerCrashFailpointEnabled({
      NODE_ENV: "production",
      APP_ENV: "local_staging",
      RELEASE4I_WORKER_CRASH_FAILPOINT: "1"
    })).toBe(false);
    expect(workerCrashFailpointEnabled({
      NODE_ENV: "development",
      APP_ENV: "local_staging"
    })).toBe(false);
    expect(workerCrashFailpointEnabled({
      NODE_ENV: "development",
      APP_ENV: "production",
      RELEASE4I_WORKER_CRASH_FAILPOINT: "1"
    })).toBe(false);
  });

  it("uses one fixed non-command local sentinel", () => {
    expect(WORKER_CRASH_FAILPOINT_FILE).toBe("/tmp/wooriai-release4i-worker-crash");
  });

  it("keeps the acknowledgement-loss failpoint local and production-disabled", () => {
    expect(notificationAckFailpointEnabled({
      NODE_ENV: "development",
      APP_ENV: "local_staging",
      RELEASE4I_NOTIFICATION_ACK_FAILPOINT: "1"
    })).toBe(true);
    expect(notificationAckFailpointEnabled({
      NODE_ENV: "production",
      APP_ENV: "local_staging",
      RELEASE4I_NOTIFICATION_ACK_FAILPOINT: "1"
    })).toBe(false);
    expect(NOTIFICATION_ACK_FAILPOINT_FILE).toBe("/tmp/wooriai-release4i-notification-ack-loss");
  });
});
