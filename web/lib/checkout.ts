import type { Address, Hex } from "viem";
import { errorCopy } from "./errors";

/** Mirrors MezherPay.Order / PermitSig / BorrowSig / OpenSig. */
export type Order = {
  payer: Address;
  merchant: Address;
  amount: bigint;
  fromBalance: bigint;
  minIcrAfter: bigint;
  orderId: Hex;
  deadline: bigint;
};
export type PermitSig = { deadline: bigint; v: number; r: Hex; s: Hex };
export type BorrowSig = { upperHint: Address; lowerHint: Address; deadline: bigint; signature: Hex };

export type OpenSig = BorrowSig & { debtAmount: bigint };

export type CheckoutState = {
  step: "idle" | "signing_order" | "signing_permit" | "signing_borrow" | "sending" | "confirming" | "paid" | "failed";
  address?: Address;
  orderSig?: Hex;
  permit?: PermitSig;
  borrow?: BorrowSig;
  open?: OpenSig;
  hash?: Hex;
  error?: string;
};

export type CheckoutEvent =
  | { type: "ADDRESS_CHANGED"; address?: Address }
  | { type: "START" }
  | { type: "ORDER_SIGNED"; orderSig: Hex }
  | { type: "PERMIT_SIGNED"; permit: PermitSig }
  | { type: "BORROW_SIGNED"; borrow: BorrowSig }
  | { type: "OPEN_SIGNED"; open: OpenSig }
  | { type: "SENT"; hash: Hex }
  | { type: "CONFIRMED" }
  | { type: "FAILED"; code: string }
  | { type: "RESET" };

export function checkoutReducer(s: CheckoutState, e: CheckoutEvent): CheckoutState {
  switch (e.type) {
    case "ADDRESS_CHANGED":
      // Signatures belong to one account; once a tx is out, the receipt stays.
      if (e.address === s.address || s.step === "confirming" || s.step === "paid") return s;
      return { step: "idle", address: e.address };
    case "START":
      return { step: "signing_order", address: s.address };
    case "ORDER_SIGNED":
      return { ...s, step: "signing_permit", orderSig: e.orderSig };
    case "PERMIT_SIGNED":
      return { ...s, step: "signing_borrow", permit: e.permit };
    case "BORROW_SIGNED":
      return { ...s, step: "sending", borrow: e.borrow };
    case "OPEN_SIGNED":
      return { ...s, step: "sending", open: e.open };
    case "SENT":
      return { ...s, step: "confirming", hash: e.hash };
    case "CONFIRMED":
      return { ...s, step: "paid" };
    case "FAILED":
      return { ...s, step: "failed", error: errorCopy(e.code) };
    case "RESET":
      return { step: "idle", address: s.address };
  }
}

/** A mined revert is not "nothing changed" here: a borrow signature front-run on its own reverts `pay` this way. */
export function receiptEvent(status: "success" | "reverted"): CheckoutEvent {
  return status === "success" ? { type: "CONFIRMED" } : { type: "FAILED", code: "pay_reverted" };
}

/** EIP-7702 delegation designator: the account is still an EOA that signs with ECDSA. */
const DELEGATION_PREFIX = "0xef0100";

/**
 * True for a contract wallet. The order, permit and Mezo signatures are all ECDSA (no ERC-1271), so a smart
 * account cannot pay and is sent to an EVM wallet account instead.
 */
export async function isSmartAccount(client: { getCode(a: { address: Address }): Promise<Hex | undefined> }, address: Address): Promise<boolean> {
  const code = (await client.getCode({ address })) ?? "0x";
  return code !== "0x" && !code.toLowerCase().startsWith(DELEGATION_PREFIX);
}

/**
 * OrangeKit (Passport's Bitcoin wallets: Unisat, OKX, Xverse) throws "Unsupported method" on signTypedData, so it
 * cannot sign the order or the permit, deployed account or not. Connector type "orangekit" in @mezo-org/passport.
 */
export const isBitcoinConnector = (connectorType: string | undefined) => connectorType === "orangekit";

/**
 * Whether the payer must sign an MUSD permit for `fromBalanceWei`. ERC-2612 permit overwrites the allowance, so a
 * merchant paying from balance would replace its fee budget with the payment amount and spend it to 0. When the
 * existing allowance already covers it, the order goes with an empty permit (the contract's try/catch ignores it)
 * and transferFrom spends the allowance down instead. `remainingWei` is the allowance left after this payment.
 */
export function permitPlan(allowanceWei: bigint, fromBalanceWei: bigint): { needed: boolean; remainingWei: bigint } {
  if (allowanceWei < fromBalanceWei) return { needed: true, remainingWei: 0n };
  return { needed: false, remainingWei: allowanceWei - fromBalanceWei };
}
