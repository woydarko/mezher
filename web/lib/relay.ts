import { getAddress, isAddress, type Address, type Hex } from "viem";
import { z } from "zod";

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const DEDUPE_WINDOW_MS = 10 * 60_000;
export const MAX_DEADLINE_AHEAD_S = 3600n;
// 0.000001 BTC: Mezo testnet gas was 146 wei on 2026-10-19, so this covers ~10k pay() calls (~700k gas each).
export const MIN_RELAYER_BALANCE_WEI = 10n ** 12n;
import { MIN_SPONSORED_WEI } from "./mezo";
export { MIN_SPONSORED_WEI };

export const address = z
  .string()
  .refine((s) => isAddress(s), "invalid address")
  .transform((s) => getAddress(s) as Address);
export const uint = z
  .string()
  .regex(/^\d{1,78}$/, "decimal string expected")
  .transform((s) => BigInt(s));
export const bytes32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "32-byte hex expected")
  .transform((s) => s as Hex);
const hex = (minBytes: number) =>
  z
    .string()
    .regex(new RegExp("^0x([0-9a-fA-F]{2}){" + minBytes + ",}$"), "hex expected")
    .transform((s) => s as Hex);

/** v/r/s of an MUSD EIP-2612 permit. */
export const permitSigSchema = z.object({ v: z.union([z.literal(27), z.literal(28)]), r: bytes32, s: bytes32 });

export const relaySchema = z.object({
  order: z.object({
    payer: address,
    merchant: address,
    amount: uint,
    fromBalance: uint,
    minIcrAfter: uint,
    orderId: bytes32,
    deadline: uint,
  }),
  orderSig: hex(1),
  permit: permitSigSchema.extend({ deadline: uint }),
  // A balance-only payment borrows nothing, so its signature is empty ("0x").
  borrow: z.object({ upperHint: address, lowerHint: address, deadline: uint, signature: hex(0) }),
});

export type RelayRequest = z.infer<typeof relaySchema>;

export type RelayDeps = {
  simulate(req: RelayRequest): Promise<{ ok: true } | { ok: false; reason: string }>;
  send(req: RelayRequest): Promise<Hex>;
  relayerBalanceWei(): Promise<bigint>;
  now(): number; // ms
};

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

export function log(route: string, status: number, payer?: Address, hash?: Hex, error?: string) {
  // SECURITY.md: route, status, payer prefix, hash and a short error only; never bodies or signatures.
  console.info(JSON.stringify({ route, status, payer: payer?.slice(0, 6), hash, error }));
}

/** Reads a JSON body under the size limit and validates it; on failure `response` is the answer to send. */
export async function readBody<T extends z.ZodType>(
  req: Request,
  schema: T,
  route: string,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    log(route, 413);
    return { ok: false, response: json(413, { error: "body_too_large" }) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    log(route, 400);
    return { ok: false, response: json(400, { error: "invalid_input", details: "body is not JSON" }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    log(route, 400);
    return {
      ok: false,
      response: json(400, {
        error: "invalid_input",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Sliding window, 5 hits per key per minute; true when `key` is over. */
// shortcut: in-memory Map per serverless instance, move to Redis/Upstash if abused
export function createRateLimiter(): (key: string, now: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, now) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > RATE_LIMIT;
  };
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** viem's shortMessage has no request args (calldata carries the signatures); fall back to the class name. */
export function shortError(err: unknown): string {
  const short = (err as { shortMessage?: unknown })?.shortMessage;
  return typeof short === "string" ? short : err instanceof Error ? err.name : "unknown";
}

const ROUTE = "/api/relay";

export function createRelayHandler(deps: RelayDeps): (req: Request) => Promise<Response> {
  const overLimit = createRateLimiter();
  const relayed = new Map<string, number>();

  return async function handle(req: Request): Promise<Response> {
    const read = await readBody(req, relaySchema, ROUTE);
    if (!read.ok) return read.response;
    const body = read.data;
    const { payer, merchant, orderId } = body.order;

    const now = deps.now();
    const latestDeadline = BigInt(Math.floor(now / 1000)) + MAX_DEADLINE_AHEAD_S;
    if (
      body.order.deadline > latestDeadline ||
      body.permit.deadline > latestDeadline ||
      body.borrow.deadline > latestDeadline
    ) {
      log(ROUTE, 400, payer);
      return json(400, { error: "invalid_input", details: "deadline more than 1 hour ahead" });
    }

    if (body.order.amount < MIN_SPONSORED_WEI) {
      log(ROUTE, 422, payer);
      return json(422, { error: "own_gas_required" });
    }

    const payerLimited = overLimit("payer:" + payer, now);
    const ipLimited = overLimit("ip:" + clientIp(req), now);
    if (payerLimited || ipLimited) {
      log(ROUTE, 429, payer);
      return json(429, { error: "rate_limited" });
    }

    const dedupeKey = [merchant, orderId.toLowerCase(), payer].join(":");
    const relayedAt = relayed.get(dedupeKey);
    if (relayedAt !== undefined && now - relayedAt < DEDUPE_WINDOW_MS) {
      log(ROUTE, 409, payer);
      return json(409, { error: "already_relayed" });
    }

    try {
      if ((await deps.relayerBalanceWei()) < MIN_RELAYER_BALANCE_WEI) {
        log(ROUTE, 503, payer);
        return json(503, { error: "relayer_unavailable" });
      }

      const sim = await deps.simulate(body);
      if (!sim.ok) {
        log(ROUTE, 422, payer);
        return json(422, { error: "simulation_failed", reason: sim.reason });
      }

      const hash = await deps.send(body);
      relayed.set(dedupeKey, now);
      log(ROUTE, 200, payer, hash);
      return json(200, { hash });
    } catch (err) {
      // RPC or key failure: the client falls back to "Pay with my own gas".
      log(ROUTE, 503, payer, undefined, shortError(err));
      return json(503, { error: "relayer_unavailable" });
    }
  };
}
