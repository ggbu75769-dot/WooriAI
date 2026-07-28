export const NOTIFICATION_ACK_FAILPOINT_FILE = "/tmp/wooriai-release4i-notification-ack-loss";

export function notificationAckFailpointEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.NODE_ENV !== "production"
    && environment.APP_ENV === "local_staging"
    && environment.RELEASE4I_NOTIFICATION_ACK_FAILPOINT === "1";
}
