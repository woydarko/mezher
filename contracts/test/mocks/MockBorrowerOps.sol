// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Test double for BorrowerOperationsSignatures. Task 1 only counts calls; Task 2 adds signature checks.
contract MockBorrowerOps {
    uint256 public calls;

    mapping(address => uint256) public nonces;

    function getNonce(address borrower) external view returns (uint256) {
        return nonces[borrower];
    }

    function withdrawMUSDWithSignature(uint256, address, address, address, address, bytes memory, uint256) external {
        calls += 1;
    }
}
