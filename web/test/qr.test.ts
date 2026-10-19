import { describe, expect, it } from "vitest";
import { qrSvg } from "@/lib/qr";

const URL_OK = "https://mezher.example/pay?to=0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2&amount=12&order=3f9a1c0d2b4e5f60";

describe("qrSvg", () => {
  it("renders an svg for a valid payment URL", async () => {
    const svg = await qrSvg(URL_OK);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
  });

  it("draws in ink on paper so the crayon page keeps one palette", async () => {
    const svg = (await qrSvg(URL_OK)).toLowerCase();
    expect(svg).toContain("#1f1b16");
    expect(svg).toContain("#fffdf7");
  });

  it("refuses an empty string instead of encoding nothing", async () => {
    await expect(qrSvg("")).rejects.toThrow();
  });
});
