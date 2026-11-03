// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MezherPay} from "../src/MezherPay.sol";
import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";

interface IMusd is IERC20 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address owner) external view returns (uint256);
}

interface IBorrowerOperations {
    function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) external payable;
    function getBorrowingFee(uint256 _debt) external view returns (uint256);
}

interface ITroveManagerFork {
    function getTroveStatus(address _borrower) external view returns (uint256);
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );
}

interface IEip712 {
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

/// @notice Fork tests against the real Mezo testnet MUSD system.
contract MezherPayForkTest is Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant WITHDRAW_MUSD_TYPEHASH =
        keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)");
    bytes32 private constant OPEN_TROVE_TYPEHASH = keccak256(
        "OpenTrove(uint256 assetAmount,uint256 debtAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    IMusd internal constant MUSD = IMusd(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
    IBorrowerOperationsSignatures internal constant BOS =
        IBorrowerOperationsSignatures(0xD757e3646AF370b15f32EB557F0F8380Df7D639e);
    IBorrowerOperations internal constant BORROWER_OPS =
        IBorrowerOperations(0xCdF7028ceAB81fA0C6971208e83fa7872994beE5);
    ITroveManagerFork internal constant TROVE_MANAGER = ITroveManagerFork(0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0);
    IPriceFeed internal constant PRICE_FEED = IPriceFeed(0x86bCF0841622a5dAC14A313a15f96A95421b9366);

    /// @dev USD per BTC with 18 decimals, close to the live testnet price on 2026-10-18.
    uint256 internal constant FORK_PRICE = 81_384e18;

    MezherPay internal mezherPay;
    bytes32 internal bosDomainSeparator;

    address internal payer;
    uint256 internal payerPk;
    address internal merchant = makeAddr("forkMerchant");
    address internal treasury = makeAddr("forkTreasury");
    uint256 internal constant FEE_BPS = 50;
    bytes32 internal orderId = bytes32(uint256(0x3f9a1c0d2b4e5f60));

    function setUp() public {
        string memory rpc = vm.envOr("MEZO_TESTNET_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0);
        vm.createSelectFork(rpc);

        // Mezo prices come from the native oracle precompile 0x7b7c…0015, which does not exist in
        // revm: on a fork its fallback recurses until the call reverts. Pin the price instead; every
        // other contract in the flow stays real.
        vm.mockCall(address(PRICE_FEED), abi.encodeWithSelector(IPriceFeed.fetchPrice.selector), abi.encode(FORK_PRICE));

        mezherPay = new MezherPay(
            IERC20(address(MUSD)), BOS, ITroveManager(address(TROVE_MANAGER)), PRICE_FEED, treasury, FEE_BPS
        );

        // The merchant grants the fee allowance once, ahead of any payment.
        vm.prank(merchant);
        MUSD.approve(address(mezherPay), type(uint256).max);

        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            IEip712(address(BOS)).eip712Domain();
        assertEq(name, "BorrowerOperationsSignatures", "BOS domain name");
        assertEq(version, "1", "BOS domain version");
        assertEq(chainId, 31611, "Mezo testnet chain id");
        assertEq(verifyingContract, address(BOS), "BOS verifying contract");
        bosDomainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract
            )
        );

        (payer, payerPk) = makeAddrAndKey("forkPayer");
        vm.deal(payer, 1 ether);

        vm.prank(payer);
        BORROWER_OPS.openTrove{value: 0.1 ether}(2_000e18, address(0), address(0));
        assertEq(TROVE_MANAGER.getTroveStatus(payer), 1, "trove active");

        // Leave the payer wallet holding exactly 5 MUSD, so a 12 MUSD payment needs a 7 MUSD borrow.
        uint256 excess = MUSD.balanceOf(payer) - 5e18;
        vm.prank(payer);
        MUSD.transfer(makeAddr("sink"), excess);
    }

    function _permitSig(uint256 valueWei, uint256 deadline) internal view returns (MezherPay.PermitSig memory) {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(mezherPay), valueWei, MUSD.nonces(payer), deadline));
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", MUSD.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, digest);
        return MezherPay.PermitSig({deadline: deadline, v: v, r: r, s: s});
    }

    function _borrowSig(uint256 amountWei, address recipient, uint256 deadline)
        internal
        view
        returns (MezherPay.BorrowSig memory)
    {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                WITHDRAW_MUSD_TYPEHASH, abi.encode(amountWei, payer, recipient), BOS.getNonce(payer), deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", bosDomainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, digest);
        return MezherPay.BorrowSig({
            upperHint: address(0), lowerHint: address(0), deadline: deadline, signature: abi.encodePacked(r, s, v)
        });
    }

    function _order(address merchant_, uint256 amount, uint256 fromBalance, bytes32 orderId_)
        internal
        view
        returns (MezherPay.Order memory)
    {
        return MezherPay.Order({
            payer: payer,
            merchant: merchant_,
            amount: amount,
            fromBalance: fromBalance,
            minIcrAfter: 1.5e18,
            orderId: orderId_,
            deadline: block.timestamp + 15 minutes
        });
    }

    function _orderSig(MezherPay.Order memory o) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256("MezherPay"), keccak256("2"), block.chainid, address(mezherPay)
            )
        );
        bytes32 structHash = keccak256(
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
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _totalDebt() internal view returns (uint256) {
        (, uint256 principal, uint256 interest,, uint256 pendingPrincipal, uint256 pendingInterest) =
            TROVE_MANAGER.getEntireDebtAndColl(payer);
        return principal + interest + pendingPrincipal + pendingInterest;
    }

    function test_fork_split_5plus7() public {
        MezherPay.Order memory o = _order(merchant, 12e18, 5e18, orderId);
        uint256 deadline = o.deadline;
        uint256 fee = mezherPay.feeOf(12e18);
        uint256 debtBefore = _totalDebt();
        uint256 expectedIncrease = 7e18 + BORROWER_OPS.getBorrowingFee(7e18);

        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 5e18, 7e18, fee);
        mezherPay.pay(o, _orderSig(o), _permitSig(5e18, deadline), _borrowSig(7e18, merchant, deadline));

        assertEq(MUSD.balanceOf(merchant), 12e18 - fee, "merchant received the amount net of fee");
        assertEq(MUSD.balanceOf(treasury), fee, "treasury received the fee");
        assertEq(MUSD.balanceOf(address(mezherPay)), 0, "contract holds nothing");
        assertEq(MUSD.balanceOf(payer), 0, "payer spent its balance part");
        assertApproxEqAbs(_totalDebt() - debtBefore, expectedIncrease, 1e12, "debt up by borrow + fee");
    }

    function test_fork_replayBorrowSig_reverts() public {
        MezherPay.Order memory o = _order(merchant, 7e18, 0, orderId);
        uint256 deadline = o.deadline;
        MezherPay.BorrowSig memory borrow = _borrowSig(7e18, merchant, deadline);

        mezherPay.pay(o, _orderSig(o), _permitSig(0, deadline), borrow);

        // A fresh order id, so the revert comes from Mezo's nonce and not from the order replay guard.
        MezherPay.Order memory o2 = _order(merchant, 7e18, 0, bytes32(uint256(orderId) + 1));
        bytes memory sig2 = _orderSig(o2);
        MezherPay.PermitSig memory permit = _permitSig(0, deadline);
        vm.expectRevert();
        mezherPay.pay(o2, sig2, permit, borrow);
    }

    function test_fork_icrFloor() public {
        uint256 deadline = block.timestamp + 15 minutes;
        uint256 price = PRICE_FEED.fetchPrice();
        (uint256 coll,,,,,) = TROVE_MANAGER.getEntireDebtAndColl(payer);
        // Debt that puts ICR just under 150%: Mezo allows the borrow, MezherPay must reject it.
        uint256 debtAtFloor = coll * price / 1.5e18;
        uint256 borrowWei = debtAtFloor - _totalDebt() + 1e18;
        MezherPay.Order memory o = _order(merchant, borrowWei, 0, orderId);
        bytes memory sig = _orderSig(o);
        MezherPay.PermitSig memory permit = _permitSig(0, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(borrowWei, merchant, deadline);

        vm.expectRevert();
        mezherPay.pay(o, sig, permit, borrow);

        assertEq(MUSD.balanceOf(merchant), 0, "payment is atomic");
    }

    function test_fork_thirdPartyCannotRedirect() public {
        address relayer = makeAddr("relayer");
        address attacker = makeAddr("attacker");
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.Order memory o = _order(merchant, 7e18, 0, orderId);
        bytes memory sig = _orderSig(o);
        MezherPay.BorrowSig memory borrow = _borrowSig(7e18, merchant, deadline);
        MezherPay.PermitSig memory permit = _permitSig(0, deadline);
        o.merchant = attacker;

        vm.prank(relayer);
        vm.expectRevert(MezherPay.BadOrderSignature.selector);
        mezherPay.pay(o, sig, permit, borrow);

        assertEq(MUSD.balanceOf(attacker), 0, "attacker unchanged");
        assertEq(MUSD.balanceOf(merchant), 0, "merchant unchanged");
    }

    function test_fork_borrowSigForOtherRecipient_reverts() public {
        address attacker = makeAddr("attacker");
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.Order memory o = _order(merchant, 7e18, 0, orderId);
        bytes memory sig = _orderSig(o);
        MezherPay.PermitSig memory permit = _permitSig(0, deadline);
        // The order is for the merchant, but the payer's Mezo signature names another recipient.
        MezherPay.BorrowSig memory borrow = _borrowSig(7e18, attacker, deadline);

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        mezherPay.pay(o, sig, permit, borrow);

        assertEq(MUSD.balanceOf(attacker), 0, "attacker unchanged");
        assertEq(MUSD.balanceOf(merchant), 0, "merchant unchanged");
    }

    function testFork_openAndPay_liveTestnet() public {
        // A payer with no Trove: BTC in, Trove opened, merchant paid, in one transaction.
        (payer, payerPk) = makeAddrAndKey("forkOpener");
        uint256 collateral = 0.1 ether;
        uint256 debtAmount = 2_000e18;
        MezherPay.Order memory o = _order(merchant, 12e18, 12e18, orderId);
        uint256 fee = mezherPay.feeOf(12e18);

        bytes32 openHash = keccak256(
            abi.encodePacked(
                OPEN_TROVE_TYPEHASH, abi.encode(collateral, debtAmount, payer, payer), BOS.getNonce(payer), o.deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(payerPk, keccak256(abi.encodePacked(hex"1901", bosDomainSeparator, openHash)));
        MezherPay.OpenSig memory open = MezherPay.OpenSig({
            debtAmount: debtAmount,
            upperHint: address(0),
            lowerHint: address(0),
            deadline: o.deadline,
            signature: abi.encodePacked(r, s, v)
        });
        bytes memory orderSig = _orderSig(o);
        MezherPay.PermitSig memory permit = _permitSig(12e18, o.deadline);

        vm.expectEmit(true, false, false, true);
        emit MezherPay.OpenedAtCheckout(payer, collateral, debtAmount);
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 12e18, 0, fee);
        mezherPay.openAndPay{value: collateral}(o, orderSig, permit, open);

        assertEq(TROVE_MANAGER.getTroveStatus(payer), 1, "trove active");
        assertEq(MUSD.balanceOf(merchant), 12e18 - fee, "merchant received the amount net of fee");
        assertEq(MUSD.balanceOf(treasury), fee, "treasury received the fee");
        assertEq(MUSD.balanceOf(payer), debtAmount - 12e18, "rest of the Trove MUSD stays with payer");
        assertEq(MUSD.balanceOf(address(mezherPay)), 0, "contract holds no MUSD");
        assertEq(address(mezherPay).balance, 0, "contract holds no BTC");
    }
}
