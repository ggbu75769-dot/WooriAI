import { describe, expect, it } from "vitest";
import { isPrivateNetworkAddress } from "./safe-link-check";

describe("safe product link checks", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"])(
    "blocks private address %s",
    (address) => expect(isPrivateNetworkAddress(address)).toBe(true)
  );

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => expect(isPrivateNetworkAddress(address)).toBe(false)
  );
});
