// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MezherPay} from "../src/MezherPay.sol";
import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";

interface IMusdMainnet is IERC20 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address owner) external view returns (uint256);
}

interface ITroveManagerMainnet is ITroveManager {
    function getTroveStatus(address _borrower) external view returns (uint256);
    function checkRecoveryMode(uint256 _price) external view returns (bool);
    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (uint256 coll, uint256, uint256, uint256, uint256, uint256);
}

interface IEip712Mainnet {
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
}

/// @notice Fork test against the real Mezo mainnet MUSD system (chain 31612).
contract MezherPayMainnetForkTest is Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant OPEN_TROVE_TYPEHASH = keccak256(
        "OpenTrove(uint256 assetAmount,uint256 debtAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant WITHDRAW_MUSD_TYPEHASH =
        keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // Addresses from mezo-org/musd solidity/artifacts/deployments/mainnet.
    IMusdMainnet internal constant MUSD = IMusdMainnet(0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186);
    IBorrowerOperationsSignatures internal constant BOS =
        IBorrowerOperationsSignatures(0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a);
    ITroveManagerMainnet internal constant TROVE_MANAGER =
        ITroveManagerMainnet(0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193);
    IPriceFeed internal constant PRICE_FEED = IPriceFeed(0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88);

    uint256 internal constant COLLATERAL = 0.1 ether;
    uint256 internal constant OPEN_DEBT = 2_000e18; // above Mezo's 1800 MUSD minimum net debt
    uint256 internal constant FEE_BPS = 50;

    /// @dev Live USD per BTC (18 decimals), read from the node with `eth_call`: the native oracle precompile
    ///      exists on the node but not in revm, so it is pinned for the rest of the test.
    uint256 internal forkPrice;

    MezherPay internal mezherPay;
    bytes32 internal bosDomainSeparator;

    address internal payer;
    uint256 internal payerPk;
    address internal merchant = makeAddr("mainnetMerchant");
    address internal treasury = makeAddr("mainnetTreasury");

    function setUp() public {
        string memory rpc = vm.envOr("MEZO_MAINNET_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0, "MEZO_MAINNET_RPC_URL is not set");
        vm.createSelectFork(rpc);

        bytes memory call = abi.encodeWithSelector(IPriceFeed.fetchPrice.selector);
        bytes memory raw = vm.rpc(
            "eth_call",
            string.concat('[{"to":"', vm.toString(address(PRICE_FEED)), '","data":"', vm.toString(call), '"},"latest"]')
        );
        forkPrice = abi.decode(raw, (uint256));
        assertGt(forkPrice, 0, "live price");
        vm.mockCall(address(PRICE_FEED), call, abi.encode(forkPrice));
        vm.skip(TROVE_MANAGER.checkRecoveryMode(forkPrice), "Mezo mainnet is in Recovery Mode");

        mezherPay = new MezherPay(
            IERC20(address(MUSD)), BOS, ITroveManager(address(TROVE_MANAGER)), PRICE_FEED, treasury, FEE_BPS
        );

        vm.prank(merchant);
        MUSD.approve(address(mezherPay), type(uint256).max);

        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            IEip712Mainnet(address(BOS)).eip712Domain();
        assertEq(chainId, 31612, "Mezo mainnet chain id");
        assertEq(verifyingContract, address(BOS), "BOS verifying contract");
        bosDomainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract
            )
        );

        (payer, payerPk) = makeAddrAndKey("mainnetPayer");
        vm.deal(payer, COLLATERAL);
    }

    function _digest(bytes32 domain, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", domain, structHash));
    }

    function _sign(bytes32 domain, bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, _digest(domain, structHash));
        return abi.encodePacked(r, s, v);
    }

    function _order(uint256 amount, uint256 fromBalance, bytes32 orderId_)
        internal
        view
        returns (MezherPay.Order memory o, bytes memory sig)
    {
        o = MezherPay.Order({
            payer: payer,
            merchant: merchant,
            amount: amount,
            fromBalance: fromBalance,
            minIcrAfter: 1.5e18,
            orderId: orderId_,
            deadline: block.timestamp + 15 minutes
        });
        bytes32 domain = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256("MezherPay"), keccak256("2"), block.chainid, address(mezherPay)
            )
        );
        sig = _sign(
            domain,
            keccak256(
                abi.encode(
                    mezherPay.ORDER_TYPEHASH(),
                    o.payer,
                    o.merchant,
                    o.amount,
                    o.fromBalance,
                    o.minIcrAfter,
                    o.orderId,
                    o.deadline
                )
            )
        );
    }

    /// @dev The MUSD domain is read from the deployed token, not assumed.
    function _permit(uint256 value, uint256 deadline) internal view returns (MezherPay.PermitSig memory) {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(mezherPay), value, MUSD.nonces(payer), deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, _digest(MUSD.DOMAIN_SEPARATOR(), structHash));
        return MezherPay.PermitSig({deadline: deadline, v: v, r: r, s: s});
    }

    function _openSig(uint256 deadline) internal view returns (MezherPay.OpenSig memory) {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                OPEN_TROVE_TYPEHASH, abi.encode(COLLATERAL, OPEN_DEBT, payer, payer), BOS.getNonce(payer), deadline
            )
        );
        return MezherPay.OpenSig({
            debtAmount: OPEN_DEBT,
            upperHint: address(0),
            lowerHint: address(0),
            deadline: deadline,
            signature: _sign(bosDomainSeparator, structHash)
        });
    }

    function _borrowSig(uint256 amount, uint256 deadline) internal view returns (MezherPay.BorrowSig memory) {
        bytes32 structHash = keccak256(
            abi.encodePacked(WITHDRAW_MUSD_TYPEHASH, abi.encode(amount, payer, merchant), BOS.getNonce(payer), deadline)
        );
        return MezherPay.BorrowSig({
            upperHint: address(0),
            lowerHint: address(0),
            deadline: deadline,
            signature: _sign(bosDomainSeparator, structHash)
        });
    }

    function testForkMainnet_openPayBorrowPay_fullJourney() public {
        // 1. Open the Trove and pay 12 MUSD out of its MUSD, atomically.
        (MezherPay.Order memory o1, bytes memory sig1) = _order(12e18, 12e18, bytes32(uint256(1)));
        mezherPay.openAndPay{value: COLLATERAL}(o1, sig1, _permit(12e18, o1.deadline), _openSig(o1.deadline));

        uint256 fee1 = mezherPay.feeOf(12e18);
        assertEq(TROVE_MANAGER.getTroveStatus(payer), 1, "trove active");
        (uint256 coll,,,,,) = TROVE_MANAGER.getEntireDebtAndColl(payer);
        assertEq(coll, COLLATERAL, "Trove collateral equals the BTC sent");
        assertEq(MUSD.balanceOf(merchant), 12e18 - fee1, "merchant paid by the opening payment");
        assertEq(MUSD.balanceOf(payer), OPEN_DEBT - 12e18, "rest of the Trove MUSD stays with payer");

        // 2. Pay 2500 MUSD: the payer's wallet covers 1500, the Trove borrows the other 1000 to the merchant.
        uint256 walletPart = 1_500e18;
        (MezherPay.Order memory o2, bytes memory sig2) = _order(2_500e18, walletPart, bytes32(uint256(2)));
        mezherPay.pay(o2, sig2, _permit(walletPart, o2.deadline), _borrowSig(1_000e18, o2.deadline));

        uint256 fee2 = mezherPay.feeOf(2_500e18);
        assertEq(MUSD.balanceOf(merchant), 12e18 - fee1 + 2_500e18 - fee2, "merchant got both payments net of fee");
        assertEq(MUSD.balanceOf(treasury), fee1 + fee2, "treasury got both fees");
        assertEq(MUSD.balanceOf(address(mezherPay)), 0, "contract holds no MUSD");
        assertEq(address(mezherPay).balance, 0, "contract holds no BTC");
        assertGe(TROVE_MANAGER.getCurrentICR(payer, forkPrice), 1.5e18, "ICR at or above the floor");
    }
}
