import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("NOTI-102 relative timestamps (n분/시간/일 전)", () => {
  it("shows 방금 전 under a minute (and for future timestamps from clock skew)", () => {
    expect(formatRelativeTime(NOW, NOW)).toBe("방금 전");
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe("방금 전");
    expect(formatRelativeTime(NOW + 5 * MINUTE, NOW)).toBe("방금 전");
  });

  it("counts minutes up to an hour", () => {
    expect(formatRelativeTime(NOW - MINUTE, NOW)).toBe("1분 전");
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe("59분 전");
  });

  it("counts hours up to a day", () => {
    expect(formatRelativeTime(NOW - HOUR, NOW)).toBe("1시간 전");
    expect(formatRelativeTime(NOW - 23 * HOUR - 59 * MINUTE, NOW)).toBe("23시간 전");
  });

  it("counts days beyond that", () => {
    expect(formatRelativeTime(NOW - DAY, NOW)).toBe("1일 전");
    expect(formatRelativeTime(NOW - 10 * DAY - HOUR, NOW)).toBe("10일 전");
  });
});
