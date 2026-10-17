// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Test double for Mezo's TroveManager with a settable ICR.
contract MockTroveManager {
    uint256 public icr = 3e18;

    function setIcr(uint256 newIcr) external {
        icr = newIcr;
    }

    function getCurrentICR(address, uint256) external view returns (uint256) {
        return icr;
    }
}
