import { createHash } from "node:crypto";

export type NotificationProviderResult = {
  state: "sent" | "failed" | "unknown";
  providerDeliveryId: string | null;
  failureCode: string | null;
  retryable: boolean;
};

export type NotificationProviderRequest = {
  idempotencyKey: string;
  deliveryId: string;
  eventType: string;
  userId: string;
};

export interface NotificationProviderAdapter {
  readonly mode: "mock" | "live_unavailable";
  send(request: NotificationProviderRequest): Promise<NotificationProviderResult>;
  lookup(request: Pick<NotificationProviderRequest, "idempotencyKey" | "deliveryId"> & { providerDeliveryId: string | null }): Promise<NotificationProviderResult>;
}

export const NOTIFICATION_PROVIDER_ADAPTER = Symbol("NOTIFICATION_PROVIDER_ADAPTER");

function mockProviderId(idempotencyKey: string) {
  return `mock-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)}`;
}

export class MockNotificationProviderAdapter implements NotificationProviderAdapter {
  readonly mode = "mock" as const;

  async send(request: NotificationProviderRequest): Promise<NotificationProviderResult> {
    return {
      state: "sent",
      providerDeliveryId: mockProviderId(request.idempotencyKey),
      failureCode: null,
      retryable: false
    };
  }

  async lookup(request: Pick<NotificationProviderRequest, "idempotencyKey" | "deliveryId"> & { providerDeliveryId: string | null }): Promise<NotificationProviderResult> {
    return {
      state: "sent",
      providerDeliveryId: request.providerDeliveryId ?? mockProviderId(request.idempotencyKey),
      failureCode: null,
      retryable: false
    };
  }
}

export class UnavailableNotificationProviderAdapter implements NotificationProviderAdapter {
  readonly mode = "live_unavailable" as const;

  async send(): Promise<NotificationProviderResult> {
    return { state: "failed", providerDeliveryId: null, failureCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED", retryable: false };
  }

  async lookup(): Promise<NotificationProviderResult> {
    return { state: "failed", providerDeliveryId: null, failureCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED", retryable: false };
  }
}

export function createNotificationProviderAdapter(): NotificationProviderAdapter {
  const mockAllowed = process.env.NODE_ENV !== "production" && process.env.NOTIFICATION_PROVIDER_MODE !== "live";
  return mockAllowed ? new MockNotificationProviderAdapter() : new UnavailableNotificationProviderAdapter();
}
