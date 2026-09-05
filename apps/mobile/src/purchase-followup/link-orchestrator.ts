import {
  beginPurchaseFollowup,
  loadRecordedPurchaseFollowupForItem,
  markPurchaseFollowupOpened,
  removePurchaseFollowup,
  type PurchaseFollowup,
  type PurchaseFollowupStorage
} from "./store";

type OpenPurchaseOfferInput = {
  scopeKey: string;
  childId: string;
  itemDefinitionId: string;
  offerId: string;
  publicUrl: string;
};

type PurchaseLinkDependencies = {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
  storage?: PurchaseFollowupStorage;
  now?: () => number;
};

const openingFlights = new Map<string, Promise<PurchaseFollowup>>();

export function isSafePurchaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function openPurchaseOffer(
  input: OpenPurchaseOfferInput,
  dependencies: PurchaseLinkDependencies
): Promise<PurchaseFollowup> {
  const flightKey = `${input.scopeKey}:${input.childId}:${input.itemDefinitionId}`;
  const existing = openingFlights.get(flightKey);
  if (existing) return existing;

  const operation = (async () => {
    if (!isSafePurchaseUrl(input.publicUrl)) throw new Error("PURCHASE_URL_UNSAFE");
    // `canOpenURL` is only a hint on Android: package visibility and a browser's
    // first-run state can report false even when ACTION_VIEW succeeds. The
    // guarded `openURL` call below is the final authority, and its failure still
    // removes the transient follow-up before surfacing the error.
    await dependencies.canOpenURL(input.publicUrl).catch(() => false);

    const nowMs = dependencies.now?.() ?? Date.now();
    const recorded = await loadRecordedPurchaseFollowupForItem(
      {
        scopeKey: input.scopeKey,
        childId: input.childId,
        itemDefinitionId: input.itemDefinitionId
      },
      { nowMs, storage: dependencies.storage }
    ).catch(() => null);
    if (recorded) {
      await dependencies.openURL(input.publicUrl);
      return recorded;
    }
    let opening: PurchaseFollowup;
    try {
      opening = await beginPurchaseFollowup(
        {
          scopeKey: input.scopeKey,
          childId: input.childId,
          itemDefinitionId: input.itemDefinitionId,
          offerId: input.offerId
        },
        { nowMs, storage: dependencies.storage }
      );
    } catch {
      await dependencies.openURL(input.publicUrl);
      throw new Error("PURCHASE_FOLLOWUP_PERSISTENCE_FAILED_AFTER_OPEN");
    }
    try {
      await dependencies.openURL(input.publicUrl);
    } catch (error) {
      await removePurchaseFollowup(opening.intentId, dependencies.storage).catch(() => undefined);
      throw error;
    }
    try {
      const pending = await markPurchaseFollowupOpened(opening.intentId, {
        nowMs: dependencies.now?.() ?? Date.now(),
        storage: dependencies.storage
      });
      if (!pending) throw new Error("PURCHASE_FOLLOWUP_TRANSITION_FAILED");
      return pending;
    } catch {
      await removePurchaseFollowup(opening.intentId, dependencies.storage).catch(() => undefined);
      throw new Error("PURCHASE_FOLLOWUP_PERSISTENCE_FAILED_AFTER_OPEN");
    }
  })().finally(() => {
    openingFlights.delete(flightKey);
  });
  openingFlights.set(flightKey, operation);
  return operation;
}
