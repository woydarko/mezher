// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {MockMUSD} from "./MockMUSD.sol";

/// @notice Test double for Mezo's BorrowerOperationsSignatures: verifies the WithdrawMUSD
///         signature the real contract verifies, mints MUSD to the recipient and tracks debt.
contract MockBorrowerOps is EIP712 {
    bytes32 public constant WITHDRAW_MUSD_TYPEHASH =
        keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)");

    /// @notice Mezo's borrowing fee, 0.1%.
    uint256 public constant BORROWING_FEE_DIVISOR = 1000;

    MockMUSD public immutable musd;

    uint256 public calls;

    mapping(address => uint256) public nonces;
    mapping(address => uint256) public debt;

    constructor(MockMUSD musd_) EIP712("BorrowerOperationsSignatures", "1") {
        musd = musd_;
    }

    function getNonce(address borrower) external view returns (uint256) {
        return nonces[borrower];
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function withdrawMUSDWithSignature(
        uint256 _amount,
        address,
        address,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external {
        require(block.timestamp <= _deadline, "Signature expired");

        bytes32 structHash = keccak256(
            abi.encodePacked(
                WITHDRAW_MUSD_TYPEHASH, abi.encode(_amount, _borrower, _recipient), nonces[_borrower], _deadline
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), _signature);
        require(signer == _borrower, "BorrowerOperationsSignatures: Invalid signature");

        nonces[_borrower] += 1;
        calls += 1;
        debt[_borrower] += _amount + _amount / BORROWING_FEE_DIVISOR;
        musd.mint(_recipient, _amount);
    }
}
