import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createFaucetHandler, faucetClaimWei, MAX_CLAIM_WEI, type FaucetDeps } from "@/lib/faucet";
import { MIN_NET_DEBT_WEI, openTroveQuote, suggestedCollWei } from "@/lib/trove";

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
    const failed = await h(req({ address: A }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "faucet_unavailable" });
    expect((await h(req({ address: A }))).status).toBe(200);
  });

  it("rate limits per IP", async () => {
    const h = createFaucetHandler(deps({ balanceOf: async () => CLAIM })); // every request ends 409, none succeed
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const addr = "0x" + (i + 1).toString(16).padStart(40, "0");
      last = (await h(req({ address: addr }))).status;
    }
    expect(last).toBe(429);
  });

  it("allows one successful claim per IP per day", async () => {
    let t = 1_800_000_000_000;
    const h = createFaucetHandler(deps({ now: () => t }));
    expect((await h(req({ address: A }))).status).toBe(200);
    const second = await h(req({ address: B }));
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "ip_claimed" });
    t += 24 * 3600_000 + 1;
    expect((await h(req({ address: B }))).status).toBe(200);
  });

  it("keeps the one claim per IP when requests arrive at the same time", async () => {
    const d = deps();
    const h = createFaucetHandler(d);
    const res = await Promise.all([h(req({ address: A })), h(req({ address: B }))]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it("frees the IP again when a claim is not sent", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("rpc down")).mockResolvedValue(HASH);
    const h = createFaucetHandler(deps({ send }));
    expect((await h(req({ address: A }))).status).toBe(502);
    expect((await h(req({ address: B }))).status).toBe(200);
  });

  it("caps claims at 20 per hour across all IPs", async () => {
    let t = 1_800_000_000_000;
    const d = deps({ now: () => t });
    const h = createFaucetHandler(d);
    for (let i = 0; i < 20; i++) {
      const addr = "0x" + (i + 1).toString(16).padStart(40, "0");
      expect((await h(req({ address: addr }, "10.0.0." + i))).status).toBe(200);
    }
    const over = await h(req({ address: A }, "10.0.1.1"));
    expect(over.status).toBe(503);
    expect(await over.json()).toEqual({ error: "faucet_empty" });
    expect(d.send).toHaveBeenCalledTimes(20);
    t += 3600_000 + 1;
    expect((await h(req({ address: A }, "10.0.1.1"))).status).toBe(200);
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
  it("covers the checkout pre-fill plus 5% price drift and gas", () => {
    const price = 100_000n * 10n ** 18n;
    expect(faucetClaimWei(price, undefined)).toBe((suggestedCollWei(MIN_NET_DEBT_WEI, price) * 105n) / 100n + 10n ** 13n);
  });
  it("never exceeds the 0.1 BTC maximum, even at a very low price", () => {
    expect(faucetClaimWei(1_000n * 10n ** 18n, undefined)).toBe(MAX_CLAIM_WEI);
    expect(faucetClaimWei(100_000n * 10n ** 18n, "9" + "0".repeat(30))).toBe(MAX_CLAIM_WEI);
  });
  it("lets openTroveQuote say ok with the checkout's pre-filled values", () => {
    for (const usd of [60_000n, 81_000n, 100_000n, 120_000n]) {
      const price = usd * 10n ** 18n;
      const claim = faucetClaimWei(price, undefined);
      const debt = MIN_NET_DEBT_WEI;
      const q = openTroveQuote({ collWei: suggestedCollWei(debt, price), debtWei: debt, feeWei: (debt * 10n ** 15n) / 10n ** 18n, priceE18: price, btcBalanceWei: claim });
      expect(q.state).toBe("ok");
    }
  });
  it("uses the env override when set", () => {
    expect(faucetClaimWei(100_000n * 10n ** 18n, "123")).toBe(123n);
  });
});
