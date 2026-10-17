import { formatUnits } from "viem";

/** Display only: truncates (never rounds up) to `decimals` places, adds thousands separators. */
export function formatMusd(wei: bigint, decimals = 2): string {
  const [whole, frac = ""] = formatUnits(wei, 18).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return grouped + "." + frac.padEnd(decimals, "0").slice(0, decimals);
}

/** 1e18 = 100%; one decimal, rounded down. */
export function formatRatio(e18: bigint): string {
  const tenths = e18 / 10n ** 15n;
  return (tenths / 10n).toString() + "." + (tenths % 10n).toString() + "%";
}
