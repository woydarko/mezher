import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { buildLink, embedSnippet, linkQuery, parseLink, randomOrder } from "@/lib/link";

const ORIGIN = "https://mezher.example";
const TO = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const ORDER = "3f9a1c0d2b4e5f60";

function params(over: Record<string, string>) {
  return new URLSearchParams({ to: TO, amount: "12", order: ORDER, ...over });
}

describe("buildLink + parseLink", () => {
  it("round-trips a valid link", () => {
    const built = buildLink(ORIGIN, { to: TO, amount: "12", order: ORDER, label: "Coffee" });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const parsed = parseLink(new URL(built.url).searchParams);
    expect(parsed).toEqual({
      ok: true,
      link: {
        to: TO,
        amountWei: 12n * 10n ** 18n,
        orderId: "0x" + "0".repeat(48) + ORDER,
        orderRaw: ORDER,
        label: "Coffee",
      },
    });
  });

  it("builds a /pay URL on the given origin", () => {
    const built = buildLink(ORIGIN, { to: TO, amount: "12", order: ORDER });
    expect(built.ok && built.url.startsWith(ORIGIN + "/pay?")).toBe(true);
  });

  it.each(["0", "", "1.0000000000000000001", "-1"])("rejects amount %j", (amount) => {
    expect(parseLink(params({ amount }))).toEqual({ ok: false, error: "incomplete" });
  });

  it("parseLink rejects locale and scientific formats", () => {
    for (const amount of ["12,5", "1e3", " 12"]) {
      expect(parseLink(params({ amount }))).toEqual({ ok: false, error: "incomplete" });
    }
  });

  it("rejects amounts that do not fit uint256", () => {
    expect(parseLink(params({ amount: "1" + "0".repeat(60) }))).toEqual({ ok: false, error: "incomplete" });
  });

  it("accepts 18 decimals exactly", () => {
    const parsed = parseLink(params({ amount: "0.000000000000000001" }));
    expect(parsed.ok && parsed.link.amountWei).toBe(1n);
  });

  it("rejects a bad address", () => {
    expect(parseLink(params({ to: "0x1234" }))).toEqual({ ok: false, error: "incomplete" });
  });

  it.each(["a".repeat(15), "a".repeat(65), "zz" + "a".repeat(14)])("rejects order %j", (order) => {
    expect(parseLink(params({ order }))).toEqual({ ok: false, error: "incomplete" });
  });

  it("rejects missing params", () => {
    expect(parseLink(new URLSearchParams({ to: TO, amount: "12" }))).toEqual({ ok: false, error: "incomplete" });
  });

  it("buildLink rejects a 61-char label", () => {
    expect(buildLink(ORIGIN, { to: TO, amount: "12", order: ORDER, label: "x".repeat(61) })).toEqual({
      ok: false,
      field: "label",
      message: "Keep the label under 60 characters.",
    });
  });

  it("buildLink reports the failing field with DESIGN_SYSTEM copy", () => {
    expect(buildLink(ORIGIN, { to: TO, amount: "0", order: ORDER })).toEqual({
      ok: false,
      field: "amount",
      message: "Enter an amount greater than 0.",
    });
    expect(buildLink(ORIGIN, { to: "nope", amount: "1", order: ORDER })).toEqual({
      ok: false,
      field: "to",
      message: "Enter a valid 0x address.",
    });
    expect(buildLink(ORIGIN, { to: TO, amount: "1", order: "abc" })).toEqual({
      ok: false,
      field: "order",
      message: "Order id must be 16–64 hex characters.",
    });
  });
});

describe("randomOrder", () => {
  it("returns 16 lowercase hex chars", () => {
    expect(randomOrder()).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("embedSnippet", () => {
  it("renders a script tag with the order as data attributes", () => {
    expect(embedSnippet(ORIGIN, { to: TO.toLowerCase(), amount: "12", order: ORDER.toUpperCase() })).toEqual({
      ok: true,
      html: `<script src="${ORIGIN}/embed.js" data-to="${TO}" data-amount="12" data-order="${ORDER}" async></script>`,
    });
  });

  it("escapes the label so it cannot break out of the attribute", () => {
    const out = embedSnippet(ORIGIN, { to: TO, amount: "1", order: ORDER, label: `a"><img src=x>&` });
    expect(out.ok && out.html).toContain(`data-label="a&quot;>&lt;img src=x>&amp;"`);
  });

  it("rejects what buildLink rejects", () => {
    expect(embedSnippet(ORIGIN, { to: TO, amount: "0", order: ORDER })).toEqual({
      ok: false,
      field: "amount",
      message: "Enter an amount greater than 0.",
    });
  });
});

describe("public/embed.js", () => {
  const source = readFileSync(new URL("../public/embed.js", import.meta.url), "utf8");

  // Runs the script against a minimal DOM and returns the link it inserted, if any.
  function run(dataset: Record<string, string>) {
    let inserted: { href: string; target: string; rel: string; textContent: string } | undefined;
    const script = {
      src: ORIGIN + "/embed.js",
      dataset,
      insertAdjacentElement: (_: string, el: typeof inserted) => (inserted = el),
    };
    const document = {
      currentScript: script,
      createElement: () => ({ setAttribute() {} }),
    };
    runInNewContext(source, { document, URL, URLSearchParams, console: { warn() {} } });
    return inserted;
  }

  it("inserts a new-tab link to the same /pay URL buildLink makes", () => {
    const a = run({ to: TO, amount: "12", order: ORDER, label: "Coffee" });
    const built = buildLink(ORIGIN, { to: TO, amount: "12", order: ORDER, label: "Coffee" });
    expect(built.ok && a?.href).toBe(built.ok && built.url);
    expect(parseLink(new URL(a!.href).searchParams).ok).toBe(true);
    expect(a).toMatchObject({ target: "_blank", rel: "noopener", textContent: "Pay 12 MUSD with Bitcoin" });
  });

  it("renders nothing when a required field is missing", () => {
    expect(run({ to: TO, amount: "12" })).toBeUndefined();
  });
});

describe("linkQuery", () => {
  const query = "to=" + TO + "&amount=12&order=" + ORDER;

  it("accepts a full pasted URL, a /pay path and a bare query", () => {
    for (const input of [ORIGIN + "/pay?" + query, "  /pay?" + query + "  ", "?" + query, query]) {
      expect(new URLSearchParams(linkQuery(input) ?? "").get("order")).toBe(ORDER);
    }
  });

  it("rejects text that is not a valid payment link", () => {
    for (const input of ["", "hello", ORIGIN + "/pay?to=" + TO + "&amount=12", ORDER]) {
      expect(linkQuery(input)).toBeNull();
    }
  });
});
