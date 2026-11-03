"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import { errorCode, errorCopy } from "@/lib/errors";
import { formatMusd } from "@/lib/format";
import { getBorrowHints } from "@/lib/hints";
import { ADDRESSES, borrowerOperationsAbi, collSurplusPoolAbi, explorerTx, MEZO_TESTNET, troveManagerAbi } from "@/lib/mezo";
import { maxBorrowWei, UI_ICR_FLOOR_E18 } from "@/lib/quote";
import { readQuoteInputs } from "@/lib/quote-read";
import { readRefinanceFee } from "@/lib/redemption";

const POLL_MS = 15_000;
const FEE_RATE_E18 = 10n ** 15n; // Mezo's 0.1% borrowing fee

type Tx = { phase: "idle" | "wallet" | "pending" | "done" | "error"; hash?: Hex; error?: string };

/** One wallet-sent Mezo call: wait for the receipt (same check as /pay), then refetch. */
function useTroveTx(onDone: () => Promise<unknown> | void, refreshKey: string) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<Tx>({ phase: "idle" });

  async function run(send: () => Promise<Hex>) {
    setTx({ phase: "wallet" });
    try {
      const hash = await send();
      setTx({ phase: "pending", hash });
      const receipt = await publicClient!
        .waitForTransactionReceipt({ hash, timeout: 60_000 })
        // shortcut: Mezo RPC sometimes stalls this poll; one direct read after the timeout, as on /pay
        .catch(() => publicClient!.getTransactionReceipt({ hash }));
      if (receipt.status !== "success") return setTx({ phase: "error", hash, error: errorCopy("reverted") });
      // Stay busy until fresh data is in, so a second click cannot repeat the call on stale numbers.
      await Promise.all([queryClient.invalidateQueries({ queryKey: [refreshKey] }), onDone()]);
      setTx({ phase: "done", hash });
    } catch (err) {
      setTx({ phase: "error", error: errorCopy(errorCode(err)) });
    }
  }

  let status: ReactNode = null;
  if (tx.phase === "wallet") status = <StatusLine tone="info">Confirm in your wallet…</StatusLine>;
  if (tx.phase === "pending")
    status = (
      <StatusLine tone="info" href={tx.hash && explorerTx(tx.hash)}>
        Waiting for Mezo to confirm…
      </StatusLine>
    );
  if (tx.phase === "done")
    status = (
      <StatusLine tone="success" href={tx.hash && explorerTx(tx.hash)}>
        Done.
      </StatusLine>
    );
  if (tx.phase === "error") status = <StatusLine tone="error">{tx.error}</StatusLine>;
  const busy = tx.phase === "wallet" || tx.phase === "pending";
  return { run, status, busy, writeContractAsync, publicClient };
}

/** Refinance resets the borrow limit to today's price. Shown only when that limit, not the 150% line, stops borrowing. */
export function RefinanceAction({
  address,
  trove,
  priceE18,
  noteClass,
  onDone,
}: {
  address: Address;
  trove: { collWei: bigint; debtWei: bigint };
  priceE18: bigint;
  noteClass?: string;
  onDone: () => Promise<unknown> | void;
}) {
  const t = useTroveTx(onDone, "trove-limits");
  const info = useQuery({
    queryKey: ["trove-limits", address],
    enabled: Boolean(t.publicClient),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const [inputs, refinanceFeeWei] = await Promise.all([
        readQuoteInputs(t.publicClient!, address, 0n),
        readRefinanceFee(t.publicClient!, trove.debtWei),
      ]);
      return { capacityWei: inputs.capacityWei, recoveryMode: inputs.recoveryMode, refinanceFeeWei };
    },
  });
  if (!info.data || info.data.recoveryMode) return null;
  const { capacityWei, refinanceFeeWei } = info.data;
  const room = capacityWei > trove.debtWei ? capacityWei - trove.debtWei : 0n;
  // Capacity is the binding limit when it allows less than the 150% line would.
  if (room >= maxBorrowWei({ status: 1, ...trove }, priceE18, UI_ICR_FLOOR_E18, FEE_RATE_E18)) return null;

  const fee = formatMusd(refinanceFeeWei, 4) + " MUSD";
  const refinance = () =>
    t.run(async () => {
      const hints = await getBorrowHints(t.publicClient!, { collWei: trove.collWei, debtAfterWei: trove.debtWei + refinanceFeeWei });
      return t.writeContractAsync({
        chainId: MEZO_TESTNET.id,
        address: ADDRESSES.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: "refinance",
        args: [hints.upperHint, hints.lowerHint],
      });
    });

  return (
    <>
      <p className={noteClass}>
        Your Trove&apos;s borrow limit is nearly used up. Refinancing resets it to today&apos;s BTC price. It costs {fee}, added to your debt.
      </p>
      {t.status}
      <SecondaryButton onClick={t.busy ? undefined : refinance}>Refinance for {fee}</SecondaryButton>
    </>
  );
}

/** Troves closed by liquidation (3) or redemption (4) can leave BTC in the surplus pool for the owner to claim. */
export function ClosedTrove({ address, status, onDone }: { address: Address; status: 3 | 4; onDone: () => Promise<unknown> | void }) {
  const t = useTroveTx(onDone, "coll-surplus");
  const surplus = useQuery({
    queryKey: ["coll-surplus", address],
    enabled: Boolean(t.publicClient),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const pool = await t.publicClient!.readContract({
        address: ADDRESSES.troveManager,
        abi: troveManagerAbi,
        functionName: "collSurplusPool",
      });
      return t.publicClient!.readContract({ address: pool, abi: collSurplusPoolAbi, functionName: "getCollateral", args: [address] });
    },
  });
  const wei = surplus.data ?? 0n;
  const claim = () =>
    t.run(() =>
      t.writeContractAsync({
        chainId: MEZO_TESTNET.id,
        address: ADDRESSES.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: "claimCollateral",
      }),
    );
  return (
    <>
      <p>
        {status === 4
          ? "Your Trove was closed by redemption: someone swapped MUSD for BTC against it until its debt was paid off."
          : "Your Trove was closed by liquidation: its BTC value fell too low to cover the debt."}{" "}
        You can open a new one from any checkout.
      </p>
      {wei > 0n && (
        <>
          <p>{formatMusd(wei, 4)} BTC is left over for you to claim.</p>
          {t.status}
          <SecondaryButton onClick={t.busy ? undefined : claim}>Claim {formatMusd(wei, 4)} BTC</SecondaryButton>
        </>
      )}
    </>
  );
}
