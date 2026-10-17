// Known codes: relay API errors, MezherPay custom errors, Mezo revert strings, OZ ERC20 errors.
const COPY: [match: string, copy: string][] = [
  ["ERC20InsufficientBalance", "Your MUSD balance changed. Refresh the quote."],
  ["ERC20InsufficientAllowance", "Your MUSD balance changed. Refresh the quote."],
  ["IcrBelowFloor", "Your Trove would drop below 150%. Pay less or add collateral on Mezo."],
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
