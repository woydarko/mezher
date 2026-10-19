import { getAddress, isAddress, maxUint256, pad, parseUnits, type Address, type Hex } from "viem";

export type PayLink = { to: Address; amountWei: bigint; orderId: Hex; orderRaw: string; label?: string };

type LinkInput = { to: string; amount: string; order: string; label?: string };
type LinkField = "to" | "amount" | "order" | "label";

const AMOUNT_RE = /^\d+(\.\d{1,18})?$/; // plain decimal: no sign, comma, exponent or spaces
const ORDER_RE = /^[0-9a-fA-F]{16,64}$/;
const MAX_LABEL = 60;

function amountWei(amount: string): bigint | null {
  if (!AMOUNT_RE.test(amount)) return null;
  const wei = parseUnits(amount, 18);
  return wei > 0n ? wei : null;
}

function validate(input: LinkInput): { field: LinkField; message: string } | null {
  if (!isAddress(input.to)) return { field: "to", message: "Enter a valid 0x address." };
  if (amountWei(input.amount) === null) return { field: "amount", message: "Enter an amount greater than 0." };
  if (!ORDER_RE.test(input.order)) return { field: "order", message: "Order id must be 16–64 hex characters." };
  if (input.label !== undefined && input.label.length > MAX_LABEL)
    return { field: "label", message: "Keep the label under 60 characters." };
  return null;
}

/** Validates checkout link params; anything malformed is "incomplete", never a best-effort parse. */
export function parseLink(params: URLSearchParams): { ok: true; link: PayLink } | { ok: false; error: "incomplete" } {
  const to = params.get("to");
  const amount = params.get("amount");
  const order = params.get("order");
  const label = params.get("label") ?? undefined;
  if (to === null || amount === null || order === null) return { ok: false, error: "incomplete" };
  if (validate({ to, amount, order, label })) return { ok: false, error: "incomplete" };

  const orderRaw = order.toLowerCase();
  return {
    ok: true,
    link: {
      to: getAddress(to),
      amountWei: amountWei(amount) as bigint,
      orderId: pad(("0x" + orderRaw) as Hex, { size: 32 }),
      orderRaw,
      ...(label ? { label } : {}),
    },
  };
}

export function buildLink(
  origin: string,
  input: LinkInput,
): { ok: true; url: string } | { ok: false; field: LinkField; message: string } {
  const error = validate(input);
  if (error) return { ok: false, ...error };

  const params = new URLSearchParams({ to: getAddress(input.to), amount: input.amount, order: input.order.toLowerCase() });
  if (input.label) params.set("label", input.label);
  return { ok: true, url: origin + "/pay?" + params.toString() };
}

export function randomOrder(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
