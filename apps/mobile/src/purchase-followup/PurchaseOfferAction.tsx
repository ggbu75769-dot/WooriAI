import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { PrimaryButton } from "../design-system";
import { isSafePurchaseUrl, openPurchaseOffer } from "./link-orchestrator";
import type { PurchaseFollowupStorage } from "./store";

export type PurchaseOfferAccessState =
  | "checking"
  | "blocked"
  | "direct"
  | "followup";

async function openSellerUrl(url: string): Promise<unknown> {
  try {
    return await Linking.openURL(url);
  } catch (linkingError) {
    try {
      const result = await WebBrowser.openBrowserAsync(url);
      if (result.type === WebBrowser.WebBrowserResultType.LOCKED) {
        throw new Error("CUSTOM_TAB_LOCKED");
      }
      return result;
    } catch (browserError) {
      const diagnostic = (error: unknown) => error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      console.warn("[purchase-offer] seller URL openers failed", {
        linking: diagnostic(linkingError),
        browser: diagnostic(browserError)
      });
      throw browserError;
    }
  }
}

export function PurchaseOfferAction({
  accessState,
  childId,
  itemDefinitionId,
  offer,
  onMessage,
  scopeKey,
  dependencies
}: {
  accessState: PurchaseOfferAccessState;
  childId: string | null;
  itemDefinitionId: string;
  offer: { id: string; publicUrl: string };
  onMessage: (message: string) => void;
  scopeKey: string | null;
  dependencies?: {
    canOpenURL: (url: string) => Promise<boolean>;
    openURL: (url: string) => Promise<unknown>;
    storage?: PurchaseFollowupStorage;
  };
}) {
  const link = dependencies ?? {
    canOpenURL: (url: string) => Linking.canOpenURL(url),
    openURL: openSellerUrl
  };

  const open = async () => {
    if (accessState === "blocked") {
      onMessage("선택한 아이의 가족 권한을 확인하지 못해 판매처를 열지 않았어요.");
      return;
    }
    try {
      if (!isSafePurchaseUrl(offer.publicUrl)) {
        onMessage("안전하게 열 수 있는 판매처 주소가 아니에요.");
        return;
      }
      if (accessState === "followup" && childId && scopeKey) {
        const followup = await openPurchaseOffer(
          {
            scopeKey,
            childId,
            itemDefinitionId,
            offerId: offer.id,
            publicUrl: offer.publicUrl
          },
          link
        );
        onMessage(
          followup.state === "recorded_pending_sync"
            ? "판매처를 열었어요. 기존 지출 기록의 동기화 상태는 홈에서 계속 확인할 수 있어요."
            : "판매처에서 확인한 뒤 홈 화면으로 돌아오면 구매 여부를 다시 안내해 드릴게요."
        );
        return;
      }
      await link.canOpenURL(offer.publicUrl).catch(() => false);
      await link.openURL(offer.publicUrl);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PURCHASE_FOLLOWUP_PERSISTENCE_FAILED_AFTER_OPEN"
      ) {
        onMessage("판매처는 열었지만 구매 안내를 저장하지 못했어요. 구매했다면 지출 기록에서 직접 남겨 주세요.");
        return;
      }
      onMessage("판매처 페이지를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <PrimaryButton
      disabled={accessState === "checking"}
      label={accessState === "checking" ? "가족 권한 확인 중" : "판매처 일반 페이지 열기"}
      onPress={() => void open()}
    />
  );
}
