import { BaseError, ContractFunctionRevertedError } from "viem";

// Known codes: relay API errors, MezherPay custom errors, Mezo revert strings, OZ ERC20 errors.
const COPY: [match: string, copy: string][] = [
  ["ERC20InsufficientBalance", "Your MUSD balance changed. Refresh the quote."],
  // Fee pull from the merchant (or a spent-down budget); the page checks activation first, so this is the late case.
  [
    "ERC20InsufficientAllowance",
    "This shop can't take payments right now. Ask the shop to activate payments, then try again.",
  ],
  ["IcrBelowFloor", "Your Trove would drop below your minimum ratio. Pay less or add collateral on Mezo."],
  // BorrowerOperations revert strings (musd BorrowerOperations.sol).
  ["Recovery Mode", "Mezo is in Recovery Mode, so borrowing is paused. Pay from your balance or try again later."],
  ["exceeds maxBorrowingCapacity", "This is above your Trove's borrow limit. Refinance your Trove to raise it."],
  ["ICR < MCR", "Your Trove would drop below Mezo's safe ratio. Pay less or add collateral on Mezo."],
  ["ICR >= CCR", "Your Trove would drop below Mezo's safe ratio. Pay less or add collateral on Mezo."],
  ["TCR < CCR", "Mezo's total ratio is too low for this borrow. Try again later."],
  ["below_min_ratio", "Your Trove would drop below the minimum ratio you chose. Lower it, or pay less."],
  ["No collateral available to claim", "There is nothing left to claim. Refresh the page."],
  // Before "reverted", which this also contains. Only the checkout's mined revert uses it (receiptEvent).
  [
    "pay_reverted",
    "This transaction failed, but the shop may already have the borrowed part if your signature was used first. Check the shop's payments and your Trove debt before you pay again.",
  ],
  ["reverted", "Mezo rejected the transaction. Nothing changed. Refresh and try again."],
  ["quote_changed", "Your Trove changed. Check the new numbers and press Pay again."],
  ["OrderAlreadySettled", "This order is already paid. Nothing was taken from you."],
  ["OrderExpired", "This payment request expired. Press Pay again."],
  ["BadOrderSignature", "Your signature did not match this payment. Press Pay again."],
  ["activate_relay_down", "Our gas relay is down. Try again in a minute."],
  ["ERC2612InvalidSigner", "Your signature did not match this wallet. Press Activate again."],
  ["ERC2612ExpiredSignature", "Your signature expired. Press Activate again."],
  ["own_gas_required", "This payment is too small for free gas. Pay with your own gas."],
  ["rate_limited", "Too many attempts. Wait a minute and try again."],
  ["relayer_unavailable", "Our gas relay is down. Pay with your own gas instead."],
  ["already_relayed", "This payment was already sent. Check your wallet activity before paying again."],
  ["Signature expired", "Your signature expired. Press Pay again."],
  // Mezo's nonce moved. A borrow signature used on its own already paid the shop, so "pay again" could pay twice.
  [
    "Invalid signature",
    "Your Mezo signature is no longer valid, so it may already have been used. Check your Trove debt and ask the shop if it got the money before you pay again.",
  ],
  ["User rejected", "You cancelled the signature. Press Pay when you are ready."],
];

export function errorCopy(code: string): string {
  const hit = COPY.find(([match]) => code.includes(match));
  return hit ? hit[1] : "Something went wrong (" + code + "). Try again.";
}

/** Custom error name or require() string from a decoded revert. viem names a require string "Error"; the text is in `reason`. */
export function revertName(revert: ContractFunctionRevertedError): string | undefined {
  const name = revert.data?.errorName;
  return name && name !== "Error" ? name : revert.reason;
}

/** Custom error name or revert string when the wallet surfaces one, else viem's short message. */
export function errorCode(err: unknown): string {
  if (!(err instanceof BaseError)) return err instanceof Error ? err.message : "unknown";
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    return revertName(revert) ?? err.shortMessage;
  }
  return err.shortMessage;
}
