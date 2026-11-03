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

describe("mezherPayCallAbi", () => {
  it("names the MUSD allowance revert so a wallet-sent call shows the right copy", async () => {
    const { decodeErrorResult, encodeErrorResult } = await import("viem");
    const { mezherPayCallAbi } = await import("@/lib/mezo");
    const data = encodeErrorResult({
      abi: mezherPayCallAbi,
      errorName: "ERC20InsufficientAllowance",
      args: ["0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", 0n, 5n],
    });
    expect(decodeErrorResult({ abi: mezherPayCallAbi, data }).errorName).toBe("ERC20InsufficientAllowance");
  });
});
