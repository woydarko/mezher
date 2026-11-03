// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal view of Mezo's BorrowerOperationsSignatures used for borrow-on-behalf.
interface IBorrowerOperationsSignatures {
    /// @notice Borrows `_amount` MUSD against `_borrower`'s Trove and mints it to `_recipient`.
    /// @param _signature EIP-712 `WithdrawMUSD` signature by `_borrower` (ECDSA only).
    function withdrawMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external;

    /// @notice Opens a Trove for `_borrower` with `msg.value` BTC as collateral and mints `_debtAmount` MUSD
    ///         to `_recipient`.
    /// @param _signature EIP-712 `OpenTrove` signature by `_borrower` (ECDSA only); it binds `msg.value`
    ///        as `assetAmount`.
    function openTroveWithSignature(
        uint256 _debtAmount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external payable;

    /// @notice Current signature nonce of `_borrower`.
    function getNonce(address _borrower) external view returns (uint256);
}

/// @notice Minimal view of Mezo's TroveManager.
interface ITroveManager {
    /// @notice Individual collateral ratio of `_borrower` at `_price`, 1e18 = 100%.
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
}

/// @notice Minimal view of Mezo's PriceFeed.
interface IPriceFeed {
    /// @notice USD per BTC with 18 decimals.
    function fetchPrice() external view returns (uint256);
}
