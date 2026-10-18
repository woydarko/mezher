import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createRelayHandler, type RelayDeps } from "@/lib/relay";

const PAYER = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const MERCHANT = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const HASH = ("0x" + "ab".repeat(32)) as Hex;
const NOW_MS = 1_800_000_000_000;
const NOW_S = NOW_MS / 1000;

function body(over: { payer?: string; orderId?: string; deadline?: number } = {}) {
  const deadline = String(over.deadline ?? NOW_S + 900);
  return {
    payment: {
      payer: over.payer ?? PAYER,
      merchant: MERCHANT,
      amount: "12000000000000000000",
      fromBalance: "5000000000000000000",
      orderId: over.orderId ?? "0x" + "0".repeat(48) + "3f9a1c0d2b4e5f60",
    },
    permit: { deadline, v: 27, r: "0x" + "11".repeat(32), s: "0x" + "22".repeat(32) },
    borrow: {
      upperHint: "0x0000000000000000000000000000000000000000",
      lowerHint: "0x0000000000000000000000000000000000000000",
      deadline,
      signature: "0x" + "33".repeat(65),
    },
  };
}

function req(payload: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function setup(over: Partial<RelayDeps> = {}) {
  let now = NOW_MS;
  const deps: RelayDeps = {
    simulate: vi.fn(async () => ({ ok: true }) as const),
    send: vi.fn(async () => HASH),
    relayerBalanceWei: vi.fn(async () => 10n ** 16n),
    now: () => now,
    ...over,
  };
  return { deps, handle: createRelayHandler(deps), advance: (ms: number) => (now += ms) };
}

describe("relay handler", () => {
  it("simulates, sends once and returns the hash", async () => {
    const { deps, handle } = setup();
    const res = await handle(req(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hash: HASH });
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed body with 400 invalid_input", async () => {
    const { deps, handle } = setup();
    const res = await handle(req({ payment: { payer: "nope" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("rejects non-JSON with 400 invalid_input", async () => {
    const { handle } = setup();
    expect((await handle(req("{not json"))).status).toBe(400);
  });

  it("rejects bodies over 4096 bytes with 413", async () => {
    const { handle } = setup();
    const res = await handle(req(JSON.stringify({ ...body(), pad: "x".repeat(4096) })));
    expect(res.status).toBe(413);
  });

  it("returns 422 simulation_failed with the reason and sends nothing", async () => {
    const { deps, handle } = setup({ simulate: vi.fn(async () => ({ ok: false, reason: "IcrBelowFloor" }) as const) });
    const res = await handle(req(body()));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "simulation_failed", reason: "IcrBelowFloor" });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("rate-limits the 6th request from one payer within 60 s", async () => {
    const { handle, advance } = setup();
    for (let i = 0; i < 5; i++) {
      const order = "0x" + String(i).padStart(64, "0");
      expect((await handle(req(body({ orderId: order }), "10.0.0." + i))).status).toBe(200);
      advance(1000);
    }
    const res = await handle(req(body({ orderId: "0x" + "9".repeat(64) }), "10.0.0.99"));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("rate-limits the 6th request from one IP within 60 s", async () => {
    const { handle } = setup();
    for (let i = 0; i < 5; i++) {
      const payer = "0x" + String(i + 1).padStart(40, "0");
      await handle(req(body({ payer })));
    }
    const res = await handle(req(body({ payer: "0x" + "7".repeat(40) })));
    expect(res.status).toBe(429);
  });

  it("allows a payer again after the minute passes", async () => {
    const { handle, advance } = setup();
    for (let i = 0; i < 5; i++) await handle(req(body({ orderId: "0x" + String(i).padStart(64, "0") }), "10.1.0." + i));
    advance(61_000);
    expect((await handle(req(body({ orderId: "0x" + "8".repeat(64) }), "10.1.0.50"))).status).toBe(200);
  });

  it("returns 409 for the same (merchant, orderId, payer) within 10 minutes", async () => {
    const { deps, handle, advance } = setup();
    expect((await handle(req(body()))).status).toBe(200);
    advance(60_000);
    const res = await handle(req(body(), "9.9.9.9"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_relayed");
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("returns 503 relayer_unavailable when the relayer balance is under 0.000001 BTC", async () => {
    const { deps, handle } = setup({ relayerBalanceWei: vi.fn(async () => 10n ** 12n - 1n) });
    const res = await handle(req(body()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("relayer_unavailable");
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("relays when the relayer balance is exactly 0.000001 BTC", async () => {
    const { deps, handle } = setup({ relayerBalanceWei: vi.fn(async () => 10n ** 12n) });
    const res = await handle(req(body()));
    expect(res.status).toBe(200);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("rejects deadlines more than 1 hour ahead with 400", async () => {
    const { handle } = setup();
    const res = await handle(req(body({ deadline: NOW_S + 3601 })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
  });
});
