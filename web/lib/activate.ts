import { getAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { ACTIVATION_BUDGET_WEI } from "./mezo";
import {
  MAX_DEADLINE_AHEAD_S,
  MIN_RELAYER_BALANCE_WEI,
  address,
  clientIp,
  createRateLimiter,
  json,
  log,
  permitSigSchema,
  readBody,
  shortError,
  uint,
} from "./relay";

export { ACTIVATION_BUDGET_WEI };

const ROUTE = "/api/activate";

export const activateSchema = z.object({
  permit: permitSigSchema.extend({
    owner: address,
    spender: address,
    value: uint.refine((v) => v > 0n && v <= ACTIVATION_BUDGET_WEI, "value must be 1 wei to the activation budget"),
    deadline: uint,
  }),
});

export type ActivateRequest = z.infer<typeof activateSchema>;

export type ActivateDeps = {
  /** The only spender this route relays a permit for. */
  mezherPay: Address;
  simulate(req: ActivateRequest): Promise<{ ok: true } | { ok: false; reason: string }>;
  send(req: ActivateRequest): Promise<Hex>;
  relayerBalanceWei(): Promise<bigint>;
  now(): number; // ms
};

/** Relays a merchant's MUSD permit to MezherPay so the merchant needs no BTC for gas to activate. */
export function createActivateHandler(deps: ActivateDeps): (req: Request) => Promise<Response> {
  const overLimit = createRateLimiter();
  const mezherPay = getAddress(deps.mezherPay);

  return async function handle(req: Request): Promise<Response> {
    const read = await readBody(req, activateSchema, ROUTE);
    if (!read.ok) return read.response;
    const body = read.data;
    const { owner, spender, deadline } = body.permit;

    if (spender !== mezherPay) {
      log(ROUTE, 400, owner);
      return json(400, { error: "invalid_input", details: "spender must be MezherPay" });
    }
    const now = deps.now();
    if (deadline > BigInt(Math.floor(now / 1000)) + MAX_DEADLINE_AHEAD_S) {
      log(ROUTE, 400, owner);
      return json(400, { error: "invalid_input", details: "deadline more than 1 hour ahead" });
    }

    const ownerLimited = overLimit("owner:" + owner, now);
    const ipLimited = overLimit("ip:" + clientIp(req), now);
    if (ownerLimited || ipLimited) {
      log(ROUTE, 429, owner);
      return json(429, { error: "rate_limited" });
    }

    try {
      if ((await deps.relayerBalanceWei()) < MIN_RELAYER_BALANCE_WEI) {
        log(ROUTE, 503, owner);
        return json(503, { error: "relayer_unavailable" });
      }
      const sim = await deps.simulate(body);
      if (!sim.ok) {
        log(ROUTE, 422, owner);
        return json(422, { error: "simulation_failed", reason: sim.reason });
      }
      const hash = await deps.send(body);
      log(ROUTE, 200, owner, hash);
      return json(200, { hash });
    } catch (err) {
      log(ROUTE, 503, owner, undefined, shortError(err));
      return json(503, { error: "relayer_unavailable" });
    }
  };
}
