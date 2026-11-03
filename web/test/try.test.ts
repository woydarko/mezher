import { describe, expect, it } from "vitest";
import { isDemoMerchant, tryNote, tryScenarios } from "@/lib/try";

const ONE = 10n ** 18n;

describe("tryScenarios", () => {
  it("says no Trove yet only when none ever existed", () => {
    expect(tryScenarios(0, 0n)[0].text).toContain("You have no Trove yet.");
    for (const closed of [2, 3, 4]) {
      const t = tryScenarios(closed, 0n)[0];
      expect(t.kind).toBe("open");
      expect(t.text).not.toContain("no Trove yet");
      expect(t.text).toContain("closed");
    }
  });
  it("offers borrowing only for an active Trove", () => {
    expect(tryScenarios(1, 0n)[0].kind).toBe("borrow");
    expect(tryNote(1, ONE)).toBeDefined();
    expect(tryNote(2, ONE)).toBeUndefined();
  });
});

describe("isDemoMerchant", () => {
  const demo = "0x04911751A39A3364474A6D068584268Aef5911AA";
  it("matches ignoring case", () => expect(isDemoMerchant(demo.toLowerCase(), demo)).toBe(true));
  it("is false for another wallet, or when unset", () => {
    expect(isDemoMerchant("0xeff1342219369dd9d8eabd0460fbac27c9e9abf4", demo)).toBe(false);
    expect(isDemoMerchant(demo, undefined)).toBe(false);
    expect(isDemoMerchant(undefined, demo)).toBe(false);
  });
});
