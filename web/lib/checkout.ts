import type { Address, Hex } from "viem";
import { errorCopy } from "./errors";

/** Mirrors MezherPay.PermitSig / BorrowSig. */
export type PermitSig = { deadline: bigint; v: number; r: Hex; s: Hex };
export type BorrowSig = { upperHint: Address; lowerHint: Address; deadline: bigint; signature: Hex };

export type CheckoutState = {
  step: "idle" | "signing_permit" | "signing_borrow" | "sending" | "confirming" | "paid" | "failed";
  address?: Address;
  permit?: PermitSig;
  borrow?: BorrowSig;
  hash?: Hex;
  error?: string;
};

export type CheckoutEvent =
  | { type: "ADDRESS_CHANGED"; address?: Address }
  | { type: "START" }
  | { type: "PERMIT_SIGNED"; permit: PermitSig }
  | { type: "BORROW_SIGNED"; borrow: BorrowSig }
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
      return { step: "signing_permit", address: s.address };
    case "PERMIT_SIGNED":
      return { ...s, step: "signing_borrow", permit: e.permit };
    case "BORROW_SIGNED":
      return { ...s, step: "sending", borrow: e.borrow };
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
