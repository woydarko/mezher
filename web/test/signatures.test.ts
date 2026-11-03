import {
  concat,
  encodeAbiParameters,
  encodePacked,
  hashTypedData,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { ADDRESSES } from "@/lib/mezo";
import { openTroveTypedData, orderTypedData, permitTypedData, splitSig, withdrawTypedData } from "@/lib/signatures";

const BORROWER: Address = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const MERCHANT: Address = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";

describe("withdrawTypedData", () => {
  const args = { amountWei: 7n * 10n ** 18n, borrower: BORROWER, recipient: MERCHANT, nonce: 3n, deadline: 1_800_000_000n };

  it("uses the BorrowerOperationsSignatures domain and WithdrawMUSD type", () => {
    const td = withdrawTypedData(args);
    expect(td.domain).toEqual({
      name: "BorrowerOperationsSignatures",
      version: "1",
      chainId: 31611,
      verifyingContract: ADDRESSES.borrowerOpsSignatures,
    });
    expect(td.primaryType).toBe("WithdrawMUSD");
    expect(td.types.WithdrawMUSD.map((f) => f.name)).toEqual(["amount", "borrower", "recipient", "nonce", "deadline"]);
  });

  it("hashes to the digest the Mezo contract builds", () => {
    const domainSeparator = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
        [
          keccak256(toHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
          keccak256(toHex("BorrowerOperationsSignatures")),
          keccak256(toHex("1")),
          31611n,
          ADDRESSES.borrowerOpsSignatures,
        ],
      ),
    );
    const typeHash = keccak256(
      toHex("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)"),
    );
    // Mirrors Solidity: keccak256(abi.encodePacked(TYPEHASH, abi.encode(amount, borrower, recipient), nonce, deadline))
    const structHash = keccak256(
      encodePacked(
        ["bytes32", "bytes", "uint256", "uint256"],
        [
          typeHash,
          encodeAbiParameters(
            [{ type: "uint256" }, { type: "address" }, { type: "address" }],
            [args.amountWei, args.borrower, args.recipient],
          ),
          args.nonce,
          args.deadline,
        ],
      ),
    );
    const digest = keccak256(concat(["0x1901", domainSeparator, structHash]));
    expect(hashTypedData(withdrawTypedData(args))).toBe(digest);
  });
});

describe("permitTypedData", () => {
  it("uses the Mezo USD permit domain and field order", () => {
    const td = permitTypedData({ owner: BORROWER, spender: MERCHANT, valueWei: 5n, nonce: 0n, deadline: 1n });
    expect(td.domain).toEqual({ name: "Mezo USD", version: "1", chainId: 31611, verifyingContract: ADDRESSES.musd });
    expect(td.primaryType).toBe("Permit");
    expect(td.types.Permit.map((f) => f.name)).toEqual(["owner", "spender", "value", "nonce", "deadline"]);
    expect(td.message).toEqual({ owner: BORROWER, spender: MERCHANT, value: 5n, nonce: 0n, deadline: 1n });
  });
});

describe("splitSig", () => {
  it("splits a 65-byte signature into v, r, s", async () => {
    const account = privateKeyToAccount(("0x" + "11".repeat(32)) as Hex);
    const sig = await account.signTypedData(
      permitTypedData({ owner: account.address, spender: MERCHANT, valueWei: 5n, nonce: 0n, deadline: 1n }),
    );
    const { v, r, s } = splitSig(sig);
    expect([27, 28]).toContain(v);
    expect(concat([r, s, toHex(v, { size: 1 })])).toBe(sig);
  });
});

describe("orderTypedData", () => {
  const order = {
    payer: BORROWER,
    merchant: MERCHANT,
    amount: 12n * 10n ** 18n,
    fromBalance: 5n * 10n ** 18n,
    minIcrAfter: 1_505_000_000_000_000_000n,
    orderId: ("0x" + "0".repeat(48) + "3f9a1c0d2b4e5f60") as Hex,
    deadline: 1_800_000_000n,
  };

  it("orderTypedData matches the contract's EIP-712 digest", () => {
    // Vector from MezherPay._hashTypedDataV4 via a throwaway forge test (chainId 31611, contract 0x5615dEB7...b72f).
    const digest = hashTypedData(orderTypedData(order, 31611, "0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f"));
    expect(digest).toBe("0x1b62d9d358d532d5abf9e211b6d9f8aa196fbb7a34b85246c1b890ab1d2b9e4c");
  });
});

describe("openTroveTypedData", () => {
  it("uses the BorrowerOperationsSignatures domain and OpenTrove field order", () => {
    const td = openTroveTypedData({ assetAmountWei: 3n, debtAmountWei: 4n, borrower: BORROWER, recipient: BORROWER, nonce: 1n, deadline: 2n });
    expect(td.domain).toEqual({
      name: "BorrowerOperationsSignatures",
      version: "1",
      chainId: 31611,
      verifyingContract: ADDRESSES.borrowerOpsSignatures,
    });
    expect(td.primaryType).toBe("OpenTrove");
    expect(td.types.OpenTrove.map((f) => `${f.type} ${f.name}`)).toEqual([
      "uint256 assetAmount",
      "uint256 debtAmount",
      "address borrower",
      "address recipient",
      "uint256 nonce",
      "uint256 deadline",
    ]);
    expect(td.message).toEqual({ assetAmount: 3n, debtAmount: 4n, borrower: BORROWER, recipient: BORROWER, nonce: 1n, deadline: 2n });
  });
});
