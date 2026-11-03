"use client";

import { isAddressEqual, zeroAddress, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { merchantActivated } from "@/lib/link";
import { ADDRESSES, MEZO_TESTNET, mezherPayAbi, musdAbi } from "@/lib/mezo";

/**
 * Whether `merchant` can pay MezherPay's fee on an order of `amountWei`: its MUSD allowance covers the fee.
 * The treasury skips the check because the contract charges it no fee. `activated` is undefined while loading.
 */
export function useMerchantActivation(merchant: Address | undefined, amountWei: bigint) {
  const mezherPay = ADDRESSES.mezherPay;
  const reads = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(merchant && mezherPay), refetchInterval: 15_000 },
    contracts: [
      {
        chainId: MEZO_TESTNET.id,
        address: ADDRESSES.musd,
        abi: musdAbi,
        functionName: "allowance",
        args: [merchant ?? zeroAddress, mezherPay ?? zeroAddress],
      },
      { chainId: MEZO_TESTNET.id, address: mezherPay ?? zeroAddress, abi: mezherPayAbi, functionName: "feeOf", args: [amountWei] },
      { chainId: MEZO_TESTNET.id, address: mezherPay ?? zeroAddress, abi: mezherPayAbi, functionName: "treasury" },
    ],
  });
  const [allowanceWei, feeWei, treasury] = reads.data ?? [];
  const isTreasury = reads.data && merchant ? isAddressEqual(merchant, treasury!) : false;
  const activated = reads.data && merchant ? isTreasury || merchantActivated(allowanceWei!, feeWei!) : undefined;
  // `feeWei` is what the merchant pays on this order (0 for the treasury).
  return {
    activated,
    allowanceWei,
    feeWei: isTreasury ? 0n : feeWei,
    isError: reads.isError,
    refetch: reads.refetch,
  };
}
