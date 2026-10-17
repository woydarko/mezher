// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

/// @title MezherPay
/// @notice Pays a merchant in MUSD from the payer's balance plus, for the gap, MUSD borrowed
///         straight from the payer's Mezo Trove to the merchant, in one atomic transaction.
/// @dev No owner, no upgradeability, holds no funds between calls. The payer's EIP-712
///      signatures are the only authority, so any caller (relayer or payer) may submit a payment.
contract MezherPay {
    using SafeERC20 for IERC20;

    /// @notice A payment request. `borrowed = amount - fromBalance`.
    struct Payment {
        address payer;
        address merchant;
        uint256 amount;
        uint256 fromBalance;
        bytes32 orderId;
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

    /// @notice Minimum ICR the payer's Trove must keep after borrowing, 1e18 = 100%.
    uint256 public constant MIN_ICR_AFTER = 1.5e18;

    /// @notice MUSD token.
    IERC20 public immutable musd;
    /// @notice Mezo BorrowerOperationsSignatures.
    IBorrowerOperationsSignatures public immutable bos;
    /// @notice Mezo TroveManager.
    ITroveManager public immutable troveManager;
    /// @notice Mezo PriceFeed.
    IPriceFeed public immutable priceFeed;

    /// @notice Emitted once a payment settled.
    /// @param orderId Merchant order id, informational (no on-chain uniqueness).
    /// @param amount Total MUSD the merchant received.
    /// @param fromBalance Part taken from the payer's MUSD balance.
    /// @param borrowed Part borrowed from the payer's Trove.
    event Paid(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        uint256 fromBalance,
        uint256 borrowed
    );

    /// @notice A required address was zero.
    error ZeroAddress();
    /// @notice The payment amount was zero.
    error ZeroAmount();
    /// @notice `fromBalance` was larger than `amount`.
    error FromBalanceExceedsAmount();
    /// @notice The payer's Trove would end below `MIN_ICR_AFTER`.
    /// @param icr The ICR after borrowing, 1e18 = 100%.
    error IcrBelowFloor(uint256 icr);

    /// @param musd_ MUSD token (ERC20Permit).
    /// @param bos_ Mezo BorrowerOperationsSignatures.
    /// @param troveManager_ Mezo TroveManager.
    /// @param priceFeed_ Mezo PriceFeed.
    constructor(IERC20 musd_, IBorrowerOperationsSignatures bos_, ITroveManager troveManager_, IPriceFeed priceFeed_) {
        if (
            address(musd_) == address(0) || address(bos_) == address(0) || address(troveManager_) == address(0)
                || address(priceFeed_) == address(0)
        ) {
            revert ZeroAddress();
        }
        musd = musd_;
        bos = bos_;
        troveManager = troveManager_;
        priceFeed = priceFeed_;
    }

    /// @notice Settles `p` using the payer's permit for the balance part and, for the gap,
    ///         a borrow from the payer's Trove paid straight to the merchant.
    /// @param p The payment.
    /// @param permit MUSD permit signed by `p.payer` for `p.fromBalance`.
    /// @param borrow `WithdrawMUSD` signature by `p.payer` with recipient `p.merchant`.
    function pay(Payment calldata p, PermitSig calldata permit, BorrowSig calldata borrow) external {
        if (p.payer == address(0) || p.merchant == address(0)) revert ZeroAddress();
        if (p.amount == 0) revert ZeroAmount();
        if (p.fromBalance > p.amount) revert FromBalanceExceedsAmount();

        if (p.fromBalance > 0) {
            // A permit already submitted by someone else must not make the payment fail.
            try IERC20Permit(address(musd))
                .permit(p.payer, address(this), p.fromBalance, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
            musd.safeTransferFrom(p.payer, p.merchant, p.fromBalance);
        }

        uint256 borrowed = p.amount - p.fromBalance;

        emit Paid(p.orderId, p.payer, p.merchant, p.amount, p.fromBalance, borrowed);
    }
}
