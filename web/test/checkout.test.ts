import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { checkoutReducer, isBitcoinConnector, isSmartAccount, permitPlan, receiptEvent, type BorrowSig, type CheckoutState, type PermitSig } from "@/lib/checkout";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { errorCode, errorCopy } from "@/lib/errors";
import { revertReason } from "@/lib/relayer";

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

  it("a mined revert tells the payer to check before paying again, since a front-run borrow reverts this way", () => {
    const s = checkoutReducer({ step: "confirming", address: A, hash: "0x1" }, receiptEvent("reverted"));
    expect(s.step).toBe("failed");
    expect(s.hash).toBe("0x1"); // the page links the wallet's explorer page only when a tx was mined
    expect(s.error).toBe(
      "This transaction failed, but the shop may already have the borrowed part if your signature was used first. Check the shop's payments and your Trove debt before you pay again.",
    );
    expect(s.error).not.toContain("Nothing changed");
  });

  it("a successful receipt confirms the payment", () => {
    expect(receiptEvent("success")).toEqual({ type: "CONFIRMED" });
  });

  it("keeps the plain reverted copy for the Trove actions and activation", () => {
    expect(errorCopy("reverted")).toBe("Mezo rejected the transaction. Nothing changed. Refresh and try again.");
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
    // A borrow signature used on its own already paid the shop, so this must not simply say "pay again".
    [
      "BorrowerOperationsSignatures: Invalid signature",
      "Your Mezo signature is no longer valid, so it may already have been used. Check your Trove debt and ask the shop if it got the money before you pay again.",
    ],
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

describe("errorCode with Mezo revert strings", () => {
  const abi = [{ type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }] as const;
  const revertWith = (message: string) =>
    new BaseError("call failed", {
      cause: new ContractFunctionRevertedError({
        abi,
        functionName: "pay",
        data: encodeErrorResult({ abi, errorName: "Error", args: [message] }),
      }),
    });

  it.each([
    ["BorrowerOps: Operation not permitted during Recovery Mode", "Mezo is in Recovery Mode, so borrowing is paused. Pay from your balance or try again later."],
    ["BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted", "This is above your Trove's borrow limit. Refinance your Trove to raise it."],
    ["BorrowerOps: An operation that would result in ICR < MCR is not permitted", "Your Trove would drop below Mezo's safe ratio. Pay less or add collateral on Mezo."],
  ])("turns the revert string %s into copy", (reason, copy) => {
    const code = errorCode(revertWith(reason));
    expect(code).toBe(reason);
    expect(errorCopy(code)).toBe(copy);
  });
});

describe("below_min_ratio", () => {
  it("blames the payer's own minimum, not Mezo", () => {
    expect(errorCopy("below_min_ratio")).toBe("Your Trove would drop below the minimum ratio you chose. Lower it, or pay less.");
  });
});

describe("revertReason", () => {
  const abi = [{ type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }] as const;
  const revertWith = (message: string) =>
    new BaseError("call failed", {
      cause: new ContractFunctionRevertedError({ abi, functionName: "pay", data: encodeErrorResult({ abi, errorName: "Error", args: [message] }) }),
    });

  it("returns the require string, not viem's generic name 'Error'", () => {
    expect(revertReason(revertWith("Invalid signature"))).toBe("Invalid signature");
  });
  it("a failed simulation with Invalid signature gives the check-first copy", () => {
    expect(errorCopy(revertReason(revertWith("Invalid signature")))).toMatch(/Check your Trove debt/);
  });
  it("rethrows anything that is not a revert", () => {
    expect(() => revertReason(new Error("rpc down"))).toThrow("rpc down");
  });
});

describe("isBitcoinConnector", () => {
  it("flags only OrangeKit's connector type", () => {
    expect(isBitcoinConnector("orangekit")).toBe(true);
    expect(isBitcoinConnector("injected")).toBe(false);
    expect(isBitcoinConnector(undefined)).toBe(false);
  });
});
