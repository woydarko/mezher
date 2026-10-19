import { getAddress, isAddress, type Address, type Hex } from "viem";
import { z } from "zod";

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const DEDUPE_WINDOW_MS = 10 * 60_000;
const MAX_DEADLINE_AHEAD_S = 3600n;
// 0.000001 BTC: Mezo testnet gas was 146 wei on 2026-10-19, so this covers ~10k pay() calls (~700k gas each).
const MIN_RELAYER_BALANCE_WEI = 10n ** 12n;

const address = z
  .string()
  .refine((s) => isAddress(s), "invalid address")
  .transform((s) => getAddress(s) as Address);
const uint = z
  .string()
  .regex(/^\d{1,78}$/, "decimal string expected")
  .transform((s) => BigInt(s));
const bytes32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "32-byte hex expected")
  .transform((s) => s as Hex);

export const relaySchema = z.object({
  payment: z.object({ payer: address, merchant: address, amount: uint, fromBalance: uint, orderId: bytes32 }),
  permit: z.object({ deadline: uint, v: z.union([z.literal(27), z.literal(28)]), r: bytes32, s: bytes32 }),
  borrow: z.object({
    upperHint: address,
    lowerHint: address,
    deadline: uint,
    signature: z
      .string()
      .regex(/^0x([0-9a-fA-F]{2})+$/, "hex expected")
      .transform((s) => s as Hex),
  }),
});

export type RelayRequest = z.infer<typeof relaySchema>;

export type RelayDeps = {
  simulate(req: RelayRequest): Promise<{ ok: true } | { ok: false; reason: string }>;
  send(req: RelayRequest): Promise<Hex>;
  relayerBalanceWei(): Promise<bigint>;
  now(): number; // ms
};

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function log(status: number, payer?: Address, hash?: Hex, error?: string) {
  // SECURITY.md: route, status, payer prefix, hash and a short error only; never bodies or signatures.
  console.info(JSON.stringify({ route: "/api/relay", status, payer: payer?.slice(0, 6), hash, error }));
}

/** viem's shortMessage has no request args (calldata carries the signatures); fall back to the class name. */
function shortError(err: unknown): string {
  const short = (err as { shortMessage?: unknown })?.shortMessage;
  return typeof short === "string" ? short : err instanceof Error ? err.name : "unknown";
}

export function createRelayHandler(deps: RelayDeps): (req: Request) => Promise<Response> {
  // shortcut: in-memory Maps per serverless instance, move to Redis/Upstash if abused
  const hits = new Map<string, number[]>();
  const relayed = new Map<string, number>();

  function overLimit(key: string, now: number): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > RATE_LIMIT;
  }

  return async function handle(req: Request): Promise<Response> {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      log(413);
      return json(413, { error: "body_too_large" });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      log(400);
      return json(400, { error: "invalid_input", details: "body is not JSON" });
    }
    const parsed = relaySchema.safeParse(raw);
    if (!parsed.success) {
      log(400);
      return json(400, {
        error: "invalid_input",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const body = parsed.data;
    const { payer, merchant, orderId } = body.payment;

    const now = deps.now();
    const latestDeadline = BigInt(Math.floor(now / 1000)) + MAX_DEADLINE_AHEAD_S;
    if (body.permit.deadline > latestDeadline || body.borrow.deadline > latestDeadline) {
      log(400, payer);
      return json(400, { error: "invalid_input", details: "deadline more than 1 hour ahead" });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const payerLimited = overLimit("payer:" + payer, now);
    const ipLimited = overLimit("ip:" + ip, now);
    if (payerLimited || ipLimited) {
      log(429, payer);
      return json(429, { error: "rate_limited" });
    }

    const dedupeKey = [merchant, orderId.toLowerCase(), payer].join(":");
    const relayedAt = relayed.get(dedupeKey);
    if (relayedAt !== undefined && now - relayedAt < DEDUPE_WINDOW_MS) {
      log(409, payer);
      return json(409, { error: "already_relayed" });
    }

    try {
      if ((await deps.relayerBalanceWei()) < MIN_RELAYER_BALANCE_WEI) {
        log(503, payer);
        return json(503, { error: "relayer_unavailable" });
      }

      const sim = await deps.simulate(body);
      if (!sim.ok) {
        log(422, payer);
        return json(422, { error: "simulation_failed", reason: sim.reason });
      }

      const hash = await deps.send(body);
      relayed.set(dedupeKey, now);
      log(200, payer, hash);
      return json(200, { hash });
    } catch (err) {
      // RPC or key failure: the client falls back to "Pay with my own gas".
      log(503, payer, undefined, shortError(err));
      return json(503, { error: "relayer_unavailable" });
    }
  };
}
