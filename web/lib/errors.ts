// Known codes: relay API errors, MezherPay custom errors, Mezo revert strings, OZ ERC20 errors.
const COPY: [match: string, copy: string][] = [
  ["ERC20InsufficientBalance", "Your MUSD balance changed. Refresh the quote."],
  // Fee pull from the merchant (or a spent-down budget); the page checks activation first, so this is the late case.
  [
    "ERC20InsufficientAllowance",
    "This shop can't take payments right now. Ask the shop to activate payments, then try again.",
  ],
  ["IcrBelowFloor", "Your Trove would drop below your minimum ratio. Pay less or add collateral on Mezo."],
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
  ["Invalid signature", "Your signature did not match this payment. Press Pay again."],
  ["User rejected", "You cancelled the signature. Press Pay when you are ready."],
];

export function errorCopy(code: string): string {
  const hit = COPY.find(([match]) => code.includes(match));
  return hit ? hit[1] : "Something went wrong (" + code + "). Try again.";
}
