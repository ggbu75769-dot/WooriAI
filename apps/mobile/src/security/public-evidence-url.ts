import { Linking } from "react-native";

function blockedIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandedIpv6(hostname: string) {
  const value = hostname.toLowerCase();
  if (value.includes("%") || value.split("::").length > 2) return null;
  const [left = "", right = ""] = value.split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const missing = 8 - leftParts.length - rightParts.length;
  if ((!value.includes("::") && missing !== 0) || missing < 0) return null;
  const parts = [
    ...leftParts,
    ...Array.from({ length: value.includes("::") ? missing : 0 }, () => "0"),
    ...rightParts
  ].map((part) => Number.parseInt(part || "0", 16));
  return parts.length === 8 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff)
    ? parts
    : null;
}

function blockedIpv6(hostname: string) {
  const parts = expandedIpv6(hostname);
  if (!parts) return true;
  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = parts as [
    number, number, number, number, number, number, number, number
  ];
  const allZeroPrefix = first === 0 && second === 0 && third === 0 && fourth === 0 && fifth === 0;
  if (parts.every((part) => part === 0) || (parts.slice(0, 7).every((part) => part === 0) && eighth === 1)) return true;
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && second === 0x0db8) return true;
  if (first === 0x0100 && second === 0 && third === 0 && fourth === 0) return true;
  if (allZeroPrefix && (sixth === 0 || sixth === 0xffff)) {
    return blockedIpv4(`${seventh >> 8}.${seventh & 0xff}.${eighth >> 8}.${eighth & 0xff}`);
  }
  return false;
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const isIpv6 = host.includes(":");
  return (
    !host ||
    host === "localhost" ||
    (isIpv4 && blockedIpv4(host)) ||
    (isIpv6 && blockedIpv6(host)) ||
    [".localhost", ".local", ".test", ".example", ".invalid"].some((suffix) => host.endsWith(suffix)) ||
    ["example.com", "example.org", "example.net"].some(
      (reserved) => host === reserved || host.endsWith(`.${reserved}`)
    )
  );
}

export function verifiedPublicEvidenceUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PUBLIC_EVIDENCE_URL_BLOCKED");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    blockedHost(hostname)
  ) {
    throw new Error("PUBLIC_EVIDENCE_URL_BLOCKED");
  }
  parsed.hostname = hostname;
  return parsed.toString();
}

export async function openPublicEvidenceUrl(
  value: string,
  opener: (url: string) => Promise<unknown> = Linking.openURL
) {
  return opener(verifiedPublicEvidenceUrl(value));
}
