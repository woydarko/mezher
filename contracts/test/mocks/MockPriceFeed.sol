// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Test double for Mezo's PriceFeed with a settable USD-per-BTC price (18 decimals).
contract MockPriceFeed {
    uint256 public price = 81_155e18;

    function setPrice(uint256 newPrice) external {
        price = newPrice;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}
