// Admin CMS API client. Talks to the NestJS admin endpoints under `/admin/*`
// using the `x-admin-token` header for auth. No runtime dependency beyond `fetch`.

export type NecessityLevel = "essential" | "convenience" | "optional";
export const NECESSITY_LEVELS: NecessityLevel[] = ["essential", "convenience", "optional"];
export const NECESSITY_LEVEL_LABELS: Record<NecessityLevel, string> = {
  essential: "필수",
  convenience: "편의",
  optional: "선택"
};

export type ChildStageCode =
  | "pregnancy_early"
  | "pregnancy_mid"
  | "pregnancy_late"
  | "newborn_0_3"
  | "infant_4_6"
  | "infant_7_12"
  | "toddler_1_3"
  | "kid_4_7"
  | "elementary"
  | "middle_school";

export const CHILD_STAGE_CODES: ChildStageCode[] = [
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "newborn_0_3",
  "infant_4_6",
  "infant_7_12",
  "toddler_1_3",
  "kid_4_7",
  "elementary",
  "middle_school"
];

export const CHILD_STAGE_LABELS: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "신생아 (0~3개월)",
  infant_4_6: "영아 (4~6개월)",
  infant_7_12: "영아 (7~12개월)",
  toddler_1_3: "유아 (1~3세)",
  kid_4_7: "유아동 (4~7세)",
  elementary: "초등학생",
  middle_school: "중학생"
};

export type ProductPlatform = "coupang" | "naver" | "custom";
export const PRODUCT_PLATFORMS: ProductPlatform[] = ["coupang", "naver", "custom"];
export const PRODUCT_PLATFORM_LABELS: Record<ProductPlatform, string> = {
  coupang: "쿠팡",
  naver: "네이버",
  custom: "기타"
};

export type ProductLink = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  active: boolean;
};

export type ItemTemplate = {
  id: string;
  name: string;
  necessityLevel: NecessityLevel;
  status: string;
  timingLabel?: string;
  priceBandText?: string;
  reasonText: string;
  skipReasonText?: string | null;
  usedSecondhandOk: boolean;
  safetyNote?: string | null;
  active: boolean;
  stageCodes: ChildStageCode[];
  productLinks: ProductLink[];
};

export type Disclosure = { key: string; text: string };

export type ClickSummary = {
  totalClicks: number;
  byPlatform: { platform: string; count: number }[];
};

export type ItemTemplateInput = {
  name?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  priceMinKrw?: number;
  priceMaxKrw?: number;
  reasonText?: string;
  skipReasonText?: string;
  usedSecondhandOk?: boolean;
  safetyNote?: string;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

export type ProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string;
  active?: boolean;
};

const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new AdminApiError(0, "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
  }

  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const code =
      body && typeof body === "object" && "code" in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).code)
        : undefined;
    throw new AdminApiError(response.status, "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", code);
  }

  return (body ?? ({} as unknown)) as T;
}

export function listItemTemplates(token: string) {
  return request<{ items: ItemTemplate[] }>("/admin/item-templates", token);
}

export function createItemTemplate(token: string, input: ItemTemplateInput) {
  return request<ItemTemplate>("/admin/item-templates", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateItemTemplate(token: string, itemTemplateId: string, input: ItemTemplateInput) {
  return request<ItemTemplate>(`/admin/item-templates/${itemTemplateId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function listProductLinks(token: string) {
  return request<{ links: ProductLink[] }>("/admin/product-links", token);
}

export function createProductLink(token: string, input: ProductLinkInput) {
  return request<ProductLink>("/admin/product-links", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateProductLink(token: string, productLinkId: string, input: ProductLinkInput) {
  return request<ProductLink>(`/admin/product-links/${productLinkId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function listDisclosures(token: string) {
  return request<{ disclosures: Disclosure[] }>("/admin/disclosures", token);
}

export function updateDisclosure(token: string, key: string, text: string) {
  return request<Disclosure>(`/admin/disclosures/${encodeURIComponent(key)}`, token, {
    method: "PUT",
    body: JSON.stringify({ text })
  });
}

export function getAffiliateClickSummary(token: string) {
  return request<ClickSummary>("/admin/affiliate-clicks/summary", token);
}

export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.status === 403);
}
