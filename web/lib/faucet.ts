import type { Address, Hex } from "viem";
import { z } from "zod";
import { MIN_NET_DEBT_WEI, OPEN_GAS_RESERVE_WEI, suggestedCollWei } from "./trove";
import { address, clientIp, createRateLimiter, json, log, readBody, shortError } from "./relay";

const ROUTE = "/api/faucet";
/** What the faucet keeps back after a claim, for its own transfer gas. */
export const FAUCET_GAS_RESERVE_WEI = 10n ** 14n;
/** No claim is ever larger than 0.1 BTC, whatever the oracle says. */
export const MAX_CLAIM_WEI = 10n ** 17n;
const DRIFT_PERCENT = 5n;
const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;
const MAX_CLAIMS_PER_HOUR = 20;

export const faucetSchema = z.object({ address });

/**
 * Test BTC per claim: exactly what the checkout pre-fills for the minimum Trove (250% of 1,800 MUSD plus fee and
 * gas compensation) plus 5% for price drift and gas to open it, capped at 0.1 BTC. `override` is env FAUCET_CLAIM_WEI.
 */
export function faucetClaimWei(priceE18: bigint, override: string | undefined): bigint {
  const claim =
    override && /^\d+$/.test(override)
      ? BigInt(override)
      : (suggestedCollWei(MIN_NET_DEBT_WEI, priceE18) * (100n + DRIFT_PERCENT)) / 100n + OPEN_GAS_RESERVE_WEI;
  return claim < MAX_CLAIM_WEI ? claim : MAX_CLAIM_WEI;
}

export type FaucetDeps = {
  claimWei(): Promise<bigint>;
  balanceOf(addr: Address): Promise<bigint>;
  faucetBalanceWei(): Promise<bigint>;
  /** Plain value transfer on Mezo testnet. */
  send(to: Address, wei: bigint): Promise<Hex>;
  now(): number; // ms
};

export function createFaucetHandler(deps: FaucetDeps): (req: Request) => Promise<Response> {
  const overLimit = createRateLimiter();
  const claimed = new Set<Address>();
  const inflight = new Set<Address>();
  // shortcut: all of this state is in memory per serverless instance (a cold start resets it), move to Redis/Upstash when abused
  const ipClaimedAt = new Map<string, number>();
  let claimTimes: number[] = [];

  return async function handle(req: Request): Promise<Response> {
    const read = await readBody(req, faucetSchema, ROUTE);
    if (!read.ok) return read.response;
    const to = read.data.address;

    const now = deps.now();
    const ip = clientIp(req);
    if (overLimit("ip:" + ip, now)) {
      log(ROUTE, 429, to);
      return json(429, { error: "rate_limited" });
    }
    if (claimed.has(to) || inflight.has(to)) {
      log(ROUTE, 409, to);
      return json(409, { error: "already_claimed" });
    }

    // one successful claim per IP per day
    const last = ipClaimedAt.get(ip);
    if (last !== undefined && now - last < DAY_MS) {
      log(ROUTE, 429, to);
      return json(429, { error: "rate_limited" });
    }
    // global cap, counting claims still being sent
    claimTimes = claimTimes.filter((t) => now - t < HOUR_MS);
    if (claimTimes.length + inflight.size >= MAX_CLAIMS_PER_HOUR) {
      log(ROUTE, 503, to);
      return json(503, { error: "faucet_empty" });
    }

    inflight.add(to);
    // Taken before any await, so parallel requests from one IP cannot each claim.
    ipClaimedAt.set(ip, now);
    let sent = false;
    try {
      const claim = await deps.claimWei();
      if ((await deps.balanceOf(to)) >= claim) {
        log(ROUTE, 409, to);
        return json(409, { error: "already_funded" });
      }
      if ((await deps.faucetBalanceWei()) < claim + FAUCET_GAS_RESERVE_WEI) {
        log(ROUTE, 503, to);
        return json(503, { error: "faucet_empty" });
      }
      const hash = await deps.send(to, claim);
      sent = true;
      claimed.add(to);
      claimTimes.push(now);
      log(ROUTE, 200, to, hash);
      return json(200, { hash });
    } catch (err) {
      log(ROUTE, 502, to, undefined, shortError(err));
      return json(502, { error: "faucet_unavailable" });
    } finally {
      inflight.delete(to);
      if (!sent) ipClaimedAt.delete(ip);
    }
  };
}
