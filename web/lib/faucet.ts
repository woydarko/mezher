import type { Address, Hex } from "viem";
import { z } from "zod";
import { collateralFor, GAS_COMPENSATION_WEI, MIN_NET_DEBT_WEI, OPEN_GAS_RESERVE_WEI } from "./trove";
import { address, clientIp, createRateLimiter, json, log, readBody, shortError } from "./relay";

const ROUTE = "/api/faucet";
const FAUCET_ICR_E18 = 2n * 10n ** 18n;
/** What the faucet keeps back after a claim, for its own transfer gas. */
export const FAUCET_GAS_RESERVE_WEI = 10n ** 14n;

export const faucetSchema = z.object({ address });

/**
 * Test BTC per claim: collateral for the minimum Trove (1,800 MUSD net plus the 200 MUSD gas compensation = 2,000
 * total debt, fee ignored) at 200%, plus gas for opening it. `override` is env FAUCET_CLAIM_WEI.
 */
export function faucetClaimWei(priceE18: bigint, override: string | undefined): bigint {
  if (override && /^\d+$/.test(override)) return BigInt(override);
  return collateralFor(MIN_NET_DEBT_WEI + GAS_COMPENSATION_WEI, priceE18, FAUCET_ICR_E18) + OPEN_GAS_RESERVE_WEI;
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

  return async function handle(req: Request): Promise<Response> {
    const read = await readBody(req, faucetSchema, ROUTE);
    if (!read.ok) return read.response;
    const to = read.data.address;

    // shortcut: in-memory per serverless instance (limit and claims reset on cold start), move to Redis/Upstash if abused
    if (overLimit("ip:" + clientIp(req), deps.now())) {
      log(ROUTE, 429, to);
      return json(429, { error: "rate_limited" });
    }
    if (claimed.has(to) || inflight.has(to)) {
      log(ROUTE, 409, to);
      return json(409, { error: "already_claimed" });
    }

    inflight.add(to);
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
      claimed.add(to);
      log(ROUTE, 200, to, hash);
      return json(200, { hash });
    } catch (err) {
      log(ROUTE, 503, to, undefined, shortError(err));
      return json(503, { error: "faucet_empty" });
    } finally {
      inflight.delete(to);
    }
  };
}
