import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { checkoutReducer, isSmartAccount, permitPlan, type BorrowSig, type CheckoutState, type PermitSig } from "@/lib/checkout";
import { errorCopy } from "@/lib/errors";

const A = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const B = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const HASH = ("0x" + "ab".repeat(32)) as Hex;
const ORDER_SIG = ("0x" + "44".repeat(65)) as Hex;
const permit: PermitSig = { deadline: 1n, v: 27, r: ("0x" + "11".repeat(32)) as Hex, s: ("0x" + "22".repeat(32)) as Hex };
const borrow: BorrowSig = {
  upperHint: "0x0000000000000000000000000000000000000000",
  lowerHint: "0x0000000000000000000000000000000000000000",
  deadline: 1n,
  signature: ("0x" + "33".repeat(65)) as Hex,
};

describe("checkoutReducer", () => {
  it("checkoutReducer resets signatures when address changes", () => {
    const s: CheckoutState = { step: "signing_borrow", address: A, permit };
    expect(checkoutReducer(s, { type: "ADDRESS_CHANGED", address: B })).toEqual({ step: "idle", address: B });
  });

  it("ignores ADDRESS_CHANGED for the same address", () => {
    const s: CheckoutState = { step: "signing_borrow", address: A, permit };
    expect(checkoutReducer(s, { type: "ADDRESS_CHANGED", address: A })).toBe(s);
  });

  it("walks the happy path and keeps the hash", () => {
    let s: CheckoutState = { step: "idle", address: A };
    s = checkoutReducer(s, { type: "START" });
    expect(s.step).toBe("signing_order");
    s = checkoutReducer(s, { type: "ORDER_SIGNED", orderSig: ORDER_SIG });
    expect(s.step).toBe("signing_permit");
    s = checkoutReducer(s, { type: "PERMIT_SIGNED", permit });
    expect(s.step).toBe("signing_borrow");
    s = checkoutReducer(s, { type: "BORROW_SIGNED", borrow });
    expect(s.step).toBe("sending");
    s = checkoutReducer(s, { type: "SENT", hash: HASH });
    expect(s.step).toBe("confirming");
    s = checkoutReducer(s, { type: "CONFIRMED" });
    expect(s).toEqual({ step: "paid", address: A, orderSig: ORDER_SIG, permit, borrow, hash: HASH });
  });

  it("checkout moves through order, permit and open signing steps for a new Trove", () => {
    let s: CheckoutState = { step: "idle", address: A };
    s = checkoutReducer(s, { type: "START" });
    s = checkoutReducer(s, { type: "ORDER_SIGNED", orderSig: ORDER_SIG });
    s = checkoutReducer(s, { type: "PERMIT_SIGNED", permit });
    expect(s.step).toBe("signing_borrow");
    s = checkoutReducer(s, { type: "OPEN_SIGNED", open: { ...borrow, debtAmount: 1n } });
    expect(s.step).toBe("sending");
    expect(s.open).toMatchObject({ debtAmount: 1n });
  });

  it("keeps a submitted payment when the account changes", () => {
    const s: CheckoutState = { step: "confirming", address: A, permit, borrow, hash: HASH };
    expect(checkoutReducer(s, { type: "ADDRESS_CHANGED", address: B })).toBe(s);
  });

  it("stores the copy for a failure code", () => {
    const s = checkoutReducer({ step: "sending", address: A, permit, borrow }, { type: "FAILED", code: "rate_limited" });
    expect(s).toMatchObject({ step: "failed", error: errorCopy("rate_limited"), permit, borrow });
  });

  it("RESET returns to idle and keeps the address", () => {
    const s = checkoutReducer({ step: "failed", address: A, error: "x", permit }, { type: "RESET" });
    expect(s).toEqual({ step: "idle", address: A });
  });
});

describe("errorCopy", () => {
  it("errorCopy maps ERC20InsufficientBalance to balance-changed copy", () => {
    expect(errorCopy("ERC20InsufficientBalance")).toBe("Your MUSD balance changed. Refresh the quote.");
  });

  it.each([
    ["IcrBelowFloor", "Your Trove would drop below your minimum ratio. Pay less or add collateral on Mezo."],
    ["OrderAlreadySettled", "This order is already paid. Nothing was taken from you."],
    ["OrderExpired", "This payment request expired. Press Pay again."],
    ["BadOrderSignature", "Your signature did not match this payment. Press Pay again."],
    ["ERC20InsufficientAllowance", "This shop can't take payments right now. Ask the shop to activate payments, then try again."],
    ["activate_relay_down", "Our gas relay is down. Try again in a minute."],
    ["ERC2612InvalidSigner", "Your signature did not match this wallet. Press Activate again."],
    ["ERC2612ExpiredSignature", "Your signature expired. Press Activate again."],
    ["own_gas_required", "This payment is too small for free gas. Pay with your own gas."],
    ["rate_limited", "Too many attempts. Wait a minute and try again."],
    ["relayer_unavailable", "Our gas relay is down. Pay with your own gas instead."],
    ["Signature expired", "Your signature expired. Press Pay again."],
  ])("maps %s", (code, copy) => {
    expect(errorCopy(code)).toBe(copy);
  });

  it("names unknown codes", () => {
    expect(errorCopy("weird_thing")).toBe("Something went wrong (weird_thing). Try again.");
  });
});

describe("isSmartAccount", () => {
  const client = (code: Hex | undefined) => ({ getCode: async () => code });

  it("isSmartAccount is true for an address with code and false for an EOA", async () => {
    expect(await isSmartAccount(client("0x6080604052"), A)).toBe(true);
    expect(await isSmartAccount(client(undefined), A)).toBe(false);
    expect(await isSmartAccount(client("0x"), A)).toBe(false);
  });

  it("treats an EIP-7702 delegated EOA as an EOA", async () => {
    expect(await isSmartAccount(client(("0xef0100" + "ab".repeat(20)) as Hex), A)).toBe(false);
  });
});

describe("permitPlan", () => {
  it("signs a permit when the allowance cannot cover the balance part", () => {
    expect(permitPlan(0n, 5n)).toEqual({ needed: true, remainingWei: 0n });
    expect(permitPlan(4n, 5n)).toEqual({ needed: true, remainingWei: 0n });
  });

  it("skips the permit and spends the allowance down when it already covers it (permit would overwrite a merchant budget)", () => {
    expect(permitPlan(5n, 5n)).toEqual({ needed: false, remainingWei: 0n });
    expect(permitPlan(10_000n, 5n)).toEqual({ needed: false, remainingWei: 9_995n });
  });
});
