import { describe, expect, it } from "vitest";
import { ADDRESSES, MEZO_TESTNET, explorerAddress, explorerTx } from "@/lib/mezo";

describe("mezo config", () => {
  it("targets Mezo testnet", () => {
    expect(MEZO_TESTNET.id).toBe(31611);
  });

  it("uses the MUSD address from ARCHITECTURE.md", () => {
    expect(ADDRESSES.musd).toBe("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503");
  });

  it("links transactions and addresses to the testnet explorer", () => {
    expect(explorerTx("0xabc")).toMatch(/^https:\/\/explorer\.test\.mezo\.org\/tx\//);
    expect(explorerAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503")).toMatch(
      /^https:\/\/explorer\.test\.mezo\.org\/address\//,
    );
  });
});
