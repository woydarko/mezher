// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

/// @title MezherPay
/// @notice Pays a merchant in MUSD from the payer's balance plus, for the gap, MUSD borrowed
///         straight from the payer's Mezo Trove to the merchant, in one atomic transaction.
/// @dev No owner, no upgradeability, holds no funds between calls. The payer's EIP-712 signatures
///      (the signed `Order`, the MUSD permit and Mezo's borrow signature) are the only authority, so any
///      caller (relayer or payer) may submit a payment. The merchant pays a fee to `treasury`, pulled
///      from the merchant after delivery with an allowance the merchant granted in advance.
contract MezherPay is EIP712 {
    using SafeERC20 for IERC20;

    /// @notice A payment request signed by `payer`. `borrowed = amount - fromBalance`.
    struct Order {
        address payer;
        address merchant;
        uint256 amount;
        uint256 fromBalance;
        uint256 minIcrAfter;
        bytes32 orderId;
        uint256 deadline;
    }

    /// @notice MUSD EIP-2612 permit signature; ignored when `fromBalance == 0`.
    struct PermitSig {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice Mezo `WithdrawMUSD` signature and Trove hints; ignored when `borrowed == 0`.
    struct BorrowSig {
        address upperHint;
        address lowerHint;
        uint256 deadline;
        bytes signature;
    }

    /// @notice EIP-712 typehash of `Order`.
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address payer,address merchant,uint256 amount,uint256 fromBalance,uint256 minIcrAfter,bytes32 orderId,uint256 deadline)"
    );

    /// @notice Minimum ICR the payer's Trove must keep after borrowing, 1e18 = 100%.
    uint256 public constant MIN_ICR_AFTER = 1.5e18;
    /// @notice Highest merchant fee, in basis points.
    uint256 public constant MAX_FEE_BPS = 100;

    /// @notice MUSD token.
    IERC20 public immutable musd;
    /// @notice Mezo BorrowerOperationsSignatures.
    IBorrowerOperationsSignatures public immutable bos;
    /// @notice Mezo TroveManager.
    ITroveManager public immutable troveManager;
    /// @notice Mezo PriceFeed.
    IPriceFeed public immutable priceFeed;
    /// @notice Receiver of the merchant fee.
    address public immutable treasury;
    /// @notice Merchant fee in basis points of the amount, at most `MAX_FEE_BPS`.
    uint256 public immutable feeBps;

    /// @notice Whether an order settled, keyed by `keccak256(abi.encode(payer, merchant, orderId))`.
    mapping(bytes32 key => bool) public settled;

    /// @notice Emitted once a payment settled.
    /// @param orderId Merchant order id; unique per (payer, merchant) on-chain.
    /// @param amount Total MUSD delivered to the merchant, before the fee.
    /// @param fromBalance Part taken from the payer's MUSD balance.
    /// @param borrowed Part borrowed from the payer's Trove.
    /// @param fee Part of `amount` the merchant paid to the treasury.
    event Paid(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        uint256 fromBalance,
        uint256 borrowed,
        uint256 fee
    );

    /// @notice A required address was zero.
    error ZeroAddress();
    /// @notice The payment amount was zero.
    error ZeroAmount();
    /// @notice `fromBalance` was larger than `amount`.
    error FromBalanceExceedsAmount();
    /// @notice The order deadline passed.
    error OrderExpired();
    /// @notice The order signature is not from `payer`.
    error BadOrderSignature();
    /// @notice This (payer, merchant, orderId) already settled.
    error OrderAlreadySettled();
    /// @notice The order's `minIcrAfter` is below `MIN_ICR_AFTER`.
    error MinIcrBelowFloor();
    /// @notice The fee exceeds `MAX_FEE_BPS`.
    error FeeTooHigh();
    /// @notice The merchant is this contract, which would lock the MUSD.
    error MerchantIsContract();
    /// @notice The payer's Trove would end below the order's `minIcrAfter`.
    /// @param icr The ICR after borrowing, 1e18 = 100%.
    error IcrBelowFloor(uint256 icr);

    /// @param musd_ MUSD token (ERC20Permit).
    /// @param bos_ Mezo BorrowerOperationsSignatures.
    /// @param troveManager_ Mezo TroveManager.
    /// @param priceFeed_ Mezo PriceFeed.
    /// @param treasury_ Receiver of the merchant fee.
    /// @param feeBps_ Merchant fee in basis points, at most `MAX_FEE_BPS`.
    constructor(
        IERC20 musd_,
        IBorrowerOperationsSignatures bos_,
        ITroveManager troveManager_,
        IPriceFeed priceFeed_,
        address treasury_,
        uint256 feeBps_
    ) EIP712("MezherPay", "2") {
        if (
            address(musd_) == address(0) || address(bos_) == address(0) || address(troveManager_) == address(0)
                || address(priceFeed_) == address(0) || treasury_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        musd = musd_;
        bos = bos_;
        troveManager = troveManager_;
        priceFeed = priceFeed_;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    /// @notice The fee the merchant owes on `amount`, rounded down.
    function feeOf(uint256 amount) public view returns (uint256) {
        return amount * feeBps / 10_000;
    }

    /// @notice Settles `o` using the payer's permit for the balance part and, for the gap,
    ///         a borrow from the payer's Trove paid straight to the merchant. The merchant then
    ///         pays the fee to the treasury from its own balance (it must have approved this contract).
    /// @param o The order.
    /// @param orderSig EIP-712 signature of `o` by `o.payer`.
    /// @param permit MUSD permit signed by `o.payer` for `o.fromBalance`.
    /// @param borrow `WithdrawMUSD` signature by `o.payer` with recipient `o.merchant`.
    function pay(Order calldata o, bytes calldata orderSig, PermitSig calldata permit, BorrowSig calldata borrow)
        external
    {
        _settle(o, orderSig);

        if (o.fromBalance > 0) _takeBalance(o, permit);

        uint256 borrowed = o.amount - o.fromBalance;
        if (borrowed > 0) {
            bos.withdrawMUSDWithSignature(
                borrowed, borrow.upperHint, borrow.lowerHint, o.payer, o.merchant, borrow.signature, borrow.deadline
            );
            uint256 icr = troveManager.getCurrentICR(o.payer, priceFeed.fetchPrice());
            if (icr < o.minIcrAfter) revert IcrBelowFloor(icr);
        }

        uint256 fee = _collectFee(o);
        emit Paid(o.orderId, o.payer, o.merchant, o.amount, o.fromBalance, borrowed, fee);
    }

    /// @dev Validates the order and its signature, then marks it settled (replay guard).
    function _settle(Order calldata o, bytes calldata orderSig) internal {
        if (o.payer == address(0) || o.merchant == address(0)) revert ZeroAddress();
        if (o.merchant == address(this)) revert MerchantIsContract();
        if (o.amount == 0) revert ZeroAmount();
        if (o.fromBalance > o.amount) revert FromBalanceExceedsAmount();
        if (block.timestamp > o.deadline) revert OrderExpired();

        bytes32 structHash = keccak256(
            abi.encode(
                ORDER_TYPEHASH, o.payer, o.merchant, o.amount, o.fromBalance, o.minIcrAfter, o.orderId, o.deadline
            )
        );
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), orderSig);
        if (err != ECDSA.RecoverError.NoError || signer != o.payer) revert BadOrderSignature();

        if (o.minIcrAfter < MIN_ICR_AFTER) revert MinIcrBelowFloor();

        bytes32 key = keccak256(abi.encode(o.payer, o.merchant, o.orderId));
        if (settled[key]) revert OrderAlreadySettled();
        settled[key] = true;
    }

    /// @dev Moves `o.fromBalance` from the payer to the merchant using the payer's permit.
    function _takeBalance(Order calldata o, PermitSig calldata permit) internal {
        // A permit already submitted by someone else must not make the payment fail.
        try IERC20Permit(address(musd))
            .permit(o.payer, address(this), o.fromBalance, permit.deadline, permit.v, permit.r, permit.s) {}
            catch {}
        musd.safeTransferFrom(o.payer, o.merchant, o.fromBalance);
    }

    /// @dev Pulls the fee from the merchant to the treasury. Returns 0 when nothing moved
    ///      (zero fee, or the merchant is the treasury).
    function _collectFee(Order calldata o) internal returns (uint256 fee) {
        if (o.merchant == treasury) return 0;
        fee = feeOf(o.amount);
        if (fee > 0) musd.safeTransferFrom(o.merchant, treasury, fee);
    }
}
