import { parseSignature, type Address, type Hex } from "viem";
import { ADDRESSES, MEZO_TESTNET } from "./mezo";

// Both domains verified on-chain (eip712Domain / fork tests, 2026-10-18).
export function permitTypedData(a: { owner: Address; spender: Address; valueWei: bigint; nonce: bigint; deadline: bigint }) {
  return {
    domain: { name: "Mezo USD", version: "1", chainId: MEZO_TESTNET.id, verifyingContract: ADDRESSES.musd },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: a.owner, spender: a.spender, value: a.valueWei, nonce: a.nonce, deadline: a.deadline },
  } as const;
}

export function withdrawTypedData(a: { amountWei: bigint; borrower: Address; recipient: Address; nonce: bigint; deadline: bigint }) {
  return {
    domain: {
      name: "BorrowerOperationsSignatures",
      version: "1",
      chainId: MEZO_TESTNET.id,
      verifyingContract: ADDRESSES.borrowerOpsSignatures,
    },
    types: {
      WithdrawMUSD: [
        { name: "amount", type: "uint256" },
        { name: "borrower", type: "address" },
        { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "WithdrawMUSD",
    message: { amount: a.amountWei, borrower: a.borrower, recipient: a.recipient, nonce: a.nonce, deadline: a.deadline },
  } as const;
}

/** v/r/s for the MUSD permit; v is 27 or 28. */
export function splitSig(sig: Hex): { v: number; r: Hex; s: Hex } {
  const { r, s, v, yParity } = parseSignature(sig);
  return { v: v !== undefined ? Number(v) : yParity + 27, r, s };
}
