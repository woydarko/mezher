import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { ACTIVATION_BUDGET_WEI, createActivateHandler, type ActivateDeps } from "@/lib/activate";

const MEZHER_PAY = "0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f";
const MERCHANT = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const HASH = ("0x" + "ab".repeat(32)) as Hex;
const NOW_MS = 1_800_000_000_000;
const NOW_S = NOW_MS / 1000;

function body(over: { spender?: string; value?: bigint; deadline?: number } = {}) {
  return {
    permit: {
      owner: MERCHANT,
      spender: over.spender ?? MEZHER_PAY,
      value: String(over.value ?? ACTIVATION_BUDGET_WEI),
      deadline: String(over.deadline ?? NOW_S + 900),
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    },
  };
}

const req = (payload: unknown, ip = "1.2.3.4") =>
  new Request("http://localhost/api/activate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });

function setup(over: Partial<ActivateDeps> = {}) {
  const deps: ActivateDeps = {
    mezherPay: MEZHER_PAY,
    simulate: vi.fn(async () => ({ ok: true }) as const),
    send: vi.fn(async () => HASH),
    relayerBalanceWei: vi.fn(async () => 10n ** 16n),
    now: () => NOW_MS,
    ...over,
  };
  return { deps, handle: createActivateHandler(deps) };
}

describe("activate handler", () => {
  it("relays a budget permit for MezherPay", async () => {
    const { deps, handle } = setup();
    const res = await handle(req(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hash: HASH });
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("activate route only relays a permit for spender MezherPay", async () => {
    const { deps, handle } = setup();
    const res = await handle(req(body({ spender: "0x000000000000000000000000000000000000dEaD" })));
    expect(res.status).toBe(400);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("refuses a permit above the budget or for zero", async () => {
    const { deps, handle } = setup();
    expect((await handle(req(body({ value: ACTIVATION_BUDGET_WEI + 1n })))).status).toBe(400);
    expect((await handle(req(body({ value: 0n })))).status).toBe(400);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("rejects a deadline more than 1 hour ahead", async () => {
    const { handle } = setup();
    expect((await handle(req(body({ deadline: NOW_S + 3601 })))).status).toBe(400);
  });

  it("returns 422 simulation_failed and sends nothing", async () => {
    const { deps, handle } = setup({
      simulate: vi.fn(async () => ({ ok: false, reason: "ERC2612InvalidSigner" }) as const),
    });
    const res = await handle(req(body()));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "simulation_failed", reason: "ERC2612InvalidSigner" });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("rate-limits the 6th request from one merchant within 60 s", async () => {
    const { handle } = setup();
    for (let i = 0; i < 5; i++) await handle(req(body(), "10.0.0." + i));
    expect((await handle(req(body(), "10.0.0.99"))).status).toBe(429);
  });

  it("returns 503 when the relayer is out of gas money", async () => {
    const { deps, handle } = setup({ relayerBalanceWei: vi.fn(async () => 0n) });
    expect((await handle(req(body()))).status).toBe(503);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("rejects bodies over 4096 bytes with 413", async () => {
    const { handle } = setup();
    expect((await handle(req({ ...body(), pad: "x".repeat(4096) }))).status).toBe(413);
  });
});
