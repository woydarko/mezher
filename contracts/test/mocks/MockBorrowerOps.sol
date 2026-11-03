// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {MockMUSD} from "./MockMUSD.sol";

/// @notice Test double for Mezo's BorrowerOperationsSignatures: verifies the WithdrawMUSD and OpenTrove
///         signatures the real contract verifies, mints MUSD to the recipient and tracks debt.
contract MockBorrowerOps is EIP712 {
    bytes32 public constant WITHDRAW_MUSD_TYPEHASH =
        keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)");

    bytes32 public constant OPEN_TROVE_TYPEHASH = keccak256(
        "OpenTrove(uint256 assetAmount,uint256 debtAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)"
    );

    /// @notice Mezo's minimum net debt and gas compensation, as read from testnet.
    uint256 public constant MIN_NET_DEBT = 1_800e18;
    uint256 public constant GAS_COMPENSATION = 200e18;

    /// @notice Mezo's borrowing fee, 0.1%.
    uint256 public constant BORROWING_FEE_DIVISOR = 1000;

    MockMUSD public immutable musd;

    uint256 public calls;

    mapping(address => uint256) public nonces;
    mapping(address => uint256) public debt;
    mapping(address => uint256) public collateral;

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

    /// @dev Like Mezo, the signature binds `msg.value` as `assetAmount`.
    function openTroveWithSignature(
        uint256 _debtAmount,
        address,
        address,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external payable {
        require(block.timestamp <= _deadline, "Signature expired");

        bytes32 structHash = keccak256(
            abi.encodePacked(
                OPEN_TROVE_TYPEHASH,
                abi.encode(msg.value, _debtAmount, _borrower, _recipient),
                nonces[_borrower],
                _deadline
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), _signature);
        require(signer == _borrower, "BorrowerOperationsSignatures: Invalid signature");
        require(collateral[_borrower] == 0, "BorrowerOps: Trove is active");
        require(_debtAmount >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum");

        nonces[_borrower] += 1;
        calls += 1;
        collateral[_borrower] = msg.value;
        debt[_borrower] = _debtAmount + _debtAmount / BORROWING_FEE_DIVISOR + GAS_COMPENSATION;
        musd.mint(_recipient, _debtAmount);
    }
}
