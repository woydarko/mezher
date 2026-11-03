"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { formatMusd } from "@/lib/format";
import { MEZO_TESTNET } from "@/lib/mezo";
import { redemptionAhead } from "@/lib/redemption";

/** Where the payer's Trove sits in the redemption queue. A failed read renders nothing; it must never block paying. */
export function RedemptionLine({ payer, enabled, className }: { payer: Address; enabled: boolean; className?: string }) {
  const client = usePublicClient({ chainId: MEZO_TESTNET.id });
  const q = useQuery({
    queryKey: ["redemption-ahead", payer],
    enabled: enabled && Boolean(client),
    refetchInterval: 30_000,
    retry: false,
    queryFn: () => redemptionAhead(client!, payer),
  });
  if (!q.data) return null;
  const { debtAheadWei, truncated } = q.data;
  const ahead = (truncated ? "At least " : "") + formatMusd(debtAheadWei) + " MUSD";
  return (
    <p className={className}>
      Redemption: anyone can swap MUSD for BTC against the lowest-ratio Troves first, which reduces both that
      Trove&apos;s debt and its BTC.{" "}
      {q.data.positionFromRisk === 0 && !truncated
        ? "Yours is the lowest ratio, so it is first in line."
        : ahead + " of debt is ahead of yours."}
    </p>
  );
}
