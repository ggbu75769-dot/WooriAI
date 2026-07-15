import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1024 * 1024;

export class SafeLinkCheckError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateNetworkAddress(mapped) : false;
  }
  return true;
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:") throw new SafeLinkCheckError("LINK_HTTPS_REQUIRED");
  if (url.username || url.password) throw new SafeLinkCheckError("LINK_CREDENTIALS_BLOCKED");
  if (url.hostname === "localhost") throw new SafeLinkCheckError("LINK_PRIVATE_HOST_BLOCKED");
  if (isIP(url.hostname) && isPrivateNetworkAddress(url.hostname)) throw new SafeLinkCheckError("LINK_PRIVATE_IP_BLOCKED");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new SafeLinkCheckError("LINK_PRIVATE_DNS_BLOCKED");
  }
}

export async function checkPublicLink(
  initialUrl: string,
  allowed: (url: string) => boolean,
  fetcher: typeof fetch = fetch
): Promise<{ statusCode: number; finalUrl: string; redirected: boolean }> {
  let current = new URL(initialUrl);
  let redirected = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!allowed(current.toString())) throw new SafeLinkCheckError("LINK_DOMAIN_BLOCKED");
    await assertPublicHost(current);
    let response = await fetcher(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (response.status === 405 || response.status === 501) {
      response = await fetcher(current, {
        method: "GET",
        headers: { Range: "bytes=0-1023" },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000)
      });
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_RESPONSE_BYTES) throw new SafeLinkCheckError("LINK_RESPONSE_TOO_LARGE");
      await response.body?.cancel();
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new SafeLinkCheckError("LINK_REDIRECT_LOCATION_MISSING");
      current = new URL(location, current);
      redirected = true;
      continue;
    }
    return { statusCode: response.status, finalUrl: current.toString(), redirected };
  }
  throw new SafeLinkCheckError("LINK_REDIRECT_LIMIT_EXCEEDED");
}
