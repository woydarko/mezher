import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createFaucetHandler, faucetClaimWei, type FaucetDeps } from "@/lib/faucet";

const A = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const B = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const HASH = ("0x" + "ab".repeat(32)) as Hex;
const CLAIM = 5n * 10n ** 16n;

function deps(over: Partial<FaucetDeps> = {}): FaucetDeps {
  return {
    claimWei: async () => CLAIM,
    balanceOf: async () => 0n,
    faucetBalanceWei: async () => 10n ** 18n,
    send: vi.fn(async () => HASH),
    now: () => 1_800_000_000_000,
    ...over,
  };
}

function req(payload: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });
}

describe("faucet", () => {
  it("sends one claim and answers with the hash", async () => {
    const d = deps();
    const res = await createFaucetHandler(d)(req({ address: A }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hash: HASH });
    expect(d.send).toHaveBeenCalledWith(A, CLAIM);
  });

  it("refuses a second claim for the same address", async () => {
    const h = createFaucetHandler(deps());
    expect((await h(req({ address: A }))).status).toBe(200);
    const again = await h(req({ address: A.toLowerCase() }, "9.9.9.9"));
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already_claimed" });
  });

  it("does not record a claim when the send fails", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("rpc down")).mockResolvedValue(HASH);
    const h = createFaucetHandler(deps({ send }));
    expect((await h(req({ address: A }))).status).toBe(503);
    expect((await h(req({ address: A }))).status).toBe(200);
  });

  it("rate limits per IP", async () => {
    const h = createFaucetHandler(deps());
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const addr = "0x" + (i + 1).toString(16).padStart(40, "0");
      last = (await h(req({ address: addr }))).status;
    }
    expect(last).toBe(429);
  });

  it("stops when its balance is under the reserve", async () => {
    const d = deps({ faucetBalanceWei: async () => CLAIM });
    const res = await createFaucetHandler(d)(req({ address: A }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "faucet_empty" });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("rejects an invalid address", async () => {
    const res = await createFaucetHandler(deps())(req({ address: "0x123" }));
    expect(res.status).toBe(400);
  });

  it("rejects an address that already holds a claim", async () => {
    const d = deps({ balanceOf: async () => CLAIM });
    const res = await createFaucetHandler(d)(req({ address: B }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_funded" });
    expect(d.send).not.toHaveBeenCalled();
  });
});

describe("faucetClaimWei", () => {
  it("covers 2000 MUSD of debt at 200% plus the gas reserve", () => {
    // price $100,000: 2 * 2000 / 100000 = 0.04 BTC
    expect(faucetClaimWei(100_000n * 10n ** 18n, undefined)).toBe(4n * 10n ** 16n + 10n ** 13n);
  });
  it("uses the env override when set", () => {
    expect(faucetClaimWei(100_000n * 10n ** 18n, "123")).toBe(123n);
  });
});
