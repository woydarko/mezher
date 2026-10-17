import { describe, expect, it } from "vitest";
import { formatMusd, formatRatio } from "@/lib/format";

describe("formatMusd", () => {
  it("shows 2 decimals with thousands separators, truncating", () => {
    expect(formatMusd(12n * 10n ** 18n)).toBe("12.00");
    expect(formatMusd(2_000_123_456_000_000_000_000n)).toBe("2,000.12");
    expect(formatMusd(0n)).toBe("0.00");
  });

  it("shows up to 4 decimals for fees", () => {
    expect(formatMusd(7n * 10n ** 15n, 4)).toBe("0.0070");
  });
});

describe("formatRatio", () => {
  it("shows a 1e18-scaled ratio as a percent with one decimal, rounded down", () => {
    expect(formatRatio(1_505_000_000_000_000_000n)).toBe("150.5%");
    expect(formatRatio(1_619_999_000_000_000_000n)).toBe("161.9%");
  });
});
