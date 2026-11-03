// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {MezherPay} from "../src/MezherPay.sol";
import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";
import {MockMUSD} from "./mocks/MockMUSD.sol";
import {MockBorrowerOps} from "./mocks/MockBorrowerOps.sol";
import {MockTroveManager} from "./mocks/MockTroveManager.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";

contract MezherPayTest is Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    uint256 internal constant FEE_BPS = 50;

    MockMUSD internal musd;
    MockBorrowerOps internal bos;
    MockTroveManager internal troveManager;
    MockPriceFeed internal priceFeed;
    MezherPay internal mezherPay;

    address internal payer;
    uint256 internal payerPk;
    address internal merchant = makeAddr("merchant");
    address internal treasury = makeAddr("treasury");
    bytes32 internal orderId = bytes32(uint256(0x3f9a1c0d2b4e5f60));

    function setUp() public {
        musd = new MockMUSD();
        bos = new MockBorrowerOps(musd);
        troveManager = new MockTroveManager();
        priceFeed = new MockPriceFeed();
        mezherPay = new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(priceFeed)),
            treasury,
            FEE_BPS
        );

        (payer, payerPk) = makeAddrAndKey("payer");
        musd.mint(payer, 100e18);

        // The merchant grants the fee allowance once, ahead of any payment.
        vm.prank(merchant);
        musd.approve(address(mezherPay), type(uint256).max);
    }

    /// @dev Signs the MUSD permit for `value` with `pk` over the MockMUSD domain.
    function _permitSig(uint256 pk, address owner, uint256 value, uint256 deadline)
        internal
        view
        returns (MezherPay.PermitSig memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, address(mezherPay), value, musd.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", musd.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return MezherPay.PermitSig({deadline: deadline, v: v, r: r, s: s});
    }

    function _noBorrowSig() internal pure returns (MezherPay.BorrowSig memory) {
        return MezherPay.BorrowSig({upperHint: address(0), lowerHint: address(0), deadline: 0, signature: ""});
    }

    /// @dev Signs the Mezo `WithdrawMUSD` message with `pk` over the MockBorrowerOps domain.
    function _borrowSig(uint256 pk, uint256 amount, address borrower, address recipient, uint256 deadline)
        internal
        view
        returns (MezherPay.BorrowSig memory)
    {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                bos.WITHDRAW_MUSD_TYPEHASH(), abi.encode(amount, borrower, recipient), bos.getNonce(borrower), deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", bos.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return MezherPay.BorrowSig({
            upperHint: address(0), lowerHint: address(0), deadline: deadline, signature: abi.encodePacked(r, s, v)
        });
    }

    function _order(address payer_, address merchant_, uint256 amount, uint256 fromBalance)
        internal
        view
        returns (MezherPay.Order memory)
    {
        return MezherPay.Order({
            payer: payer_,
            merchant: merchant_,
            amount: amount,
            fromBalance: fromBalance,
            minIcrAfter: 1.5e18,
            orderId: orderId,
            deadline: block.timestamp + 15 minutes
        });
    }

    /// @dev Signs `o` with `pk` over the MezherPay v2 domain, built independently of the contract.
    function _orderSig(uint256 pk, MezherPay.Order memory o) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256("MezherPay"), keccak256("2"), block.chainid, address(mezherPay)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Order(address payer,address merchant,uint256 amount,uint256 fromBalance,uint256 minIcrAfter,bytes32 orderId,uint256 deadline)"
                ),
                o.payer,
                o.merchant,
                o.amount,
                o.fromBalance,
                o.minIcrAfter,
                o.orderId,
                o.deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Signs the order and the MUSD permit with the payer's key, borrow sig only when there is a gap.
    function _pay(MezherPay.Order memory o) internal {
        MezherPay.BorrowSig memory borrow = o.amount > o.fromBalance
            ? _borrowSig(payerPk, o.amount - o.fromBalance, o.payer, o.merchant, o.deadline)
            : _noBorrowSig();
        mezherPay.pay(o, _orderSig(payerPk, o), _permitSig(payerPk, o.payer, o.fromBalance, o.deadline), borrow);
    }

    /// @dev Arguments are evaluated before this body, so `expectRevert` only sees the `pay` call.
    function _expectPayRevert(
        bytes memory err,
        MezherPay.Order memory o,
        bytes memory sig,
        MezherPay.PermitSig memory permit,
        MezherPay.BorrowSig memory borrow
    ) internal {
        vm.expectRevert(err);
        mezherPay.pay(o, sig, permit, borrow);
    }

    /// @dev Like `_pay`, but expects `err`; the signing calls run before `expectRevert` is armed.
    function _payRevert(MezherPay.Order memory o, bytes memory err) internal {
        MezherPay.BorrowSig memory borrow = o.amount > o.fromBalance
            ? _borrowSig(payerPk, o.amount - o.fromBalance, o.payer, o.merchant, o.deadline)
            : _noBorrowSig();
        _expectPayRevert(err, o, _orderSig(payerPk, o), _permitSig(payerPk, o.payer, o.fromBalance, o.deadline), borrow);
    }

    function test_pay_chargesFeeFromMerchant() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 5e18);
        uint256 fee = mezherPay.feeOf(12e18);
        assertEq(fee, 0.06e18, "0.5% of 12");

        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 5e18, 7e18, fee);
        _pay(o);

        assertEq(musd.balanceOf(merchant), 12e18 - fee, "merchant net of fee");
        assertEq(musd.balanceOf(treasury), fee, "treasury got the fee");
        assertEq(musd.balanceOf(address(mezherPay)), 0, "contract holds nothing");
        assertEq(musd.balanceOf(payer), 95e18, "payer debited balance part only");
        assertTrue(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "settled");
    }

    function test_pay_fromBalanceOnly_movesExactAmount() public {
        _pay(_order(payer, merchant, 12e18, 12e18));

        assertEq(musd.balanceOf(merchant) + musd.balanceOf(treasury), 12e18, "amount split merchant + fee");
        assertEq(musd.balanceOf(payer), 88e18, "payer debited amount");
        assertEq(bos.calls(), 0, "borrow not used");
    }

    function test_pay_borrowOnly_mintsToMerchant() public {
        uint256 payerBefore = musd.balanceOf(payer);
        _pay(_order(payer, merchant, 7e18, 0));

        assertEq(musd.balanceOf(merchant), 7e18 - mezherPay.feeOf(7e18), "merchant received borrow minus fee");
        assertEq(musd.balanceOf(payer), payerBefore, "payer balance untouched");
        assertEq(bos.debt(payer), 7.007e18, "debt up by borrow + 0.1% fee");
    }

    function test_pay_merchantIsTreasury_skipsFee() public {
        MezherPay.Order memory o = _order(payer, treasury, 12e18, 12e18);
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, treasury, 12e18, 12e18, 0, 0);
        _pay(o);
        assertEq(musd.balanceOf(treasury), 12e18, "treasury got the whole amount once");
    }

    function test_pay_revertsOnReplay() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        _pay(o);

        _payRevert(o, abi.encodePacked(MezherPay.OrderAlreadySettled.selector));
    }

    function test_pay_revertsOnTamperedSplit() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        o.fromBalance = 0; // relayer shifts the whole payment onto the Trove

        _expectPayRevert(
            abi.encodePacked(MezherPay.BadOrderSignature.selector),
            o,
            sig,
            _permitSig(payerPk, payer, 0, o.deadline),
            _borrowSig(payerPk, 12e18, payer, merchant, o.deadline)
        );
    }

    function test_pay_revertsOnWrongSigner() public {
        (, uint256 otherPk) = makeAddrAndKey("other");
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);

        _expectPayRevert(
            abi.encodePacked(MezherPay.BadOrderSignature.selector),
            o,
            _orderSig(otherPk, o),
            _permitSig(payerPk, payer, 12e18, o.deadline),
            _noBorrowSig()
        );
    }

    function test_pay_revertsOnMalformedSignature() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);

        _expectPayRevert(
            abi.encodePacked(MezherPay.BadOrderSignature.selector),
            o,
            hex"1234",
            _permitSig(payerPk, payer, 12e18, o.deadline),
            _noBorrowSig()
        );
    }

    function test_pay_revertsAfterDeadline() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.warp(o.deadline + 1);
        _expectPayRevert(abi.encodePacked(MezherPay.OrderExpired.selector), o, sig, permit, _noBorrowSig());
    }

    function test_pay_revertsWithoutMerchantAllowance() public {
        vm.prank(merchant);
        musd.approve(address(mezherPay), 0);

        MezherPay.Order memory o = _order(payer, merchant, 12e18, 5e18);
        _payRevert(
            o,
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(mezherPay), 0, mezherPay.feeOf(12e18)
            )
        );

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
        assertEq(musd.balanceOf(treasury), 0, "treasury unchanged");
        assertEq(musd.balanceOf(payer), 100e18, "payer unchanged");
        assertEq(bos.debt(payer), 0, "no debt");
        assertFalse(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "order not consumed");
    }

    function test_pay_revertsBelowPayerMinIcr() public {
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);
        o.minIcrAfter = 2e18;
        troveManager.setIcr(1.9e18);

        _payRevert(o, abi.encodeWithSelector(MezherPay.IcrBelowFloor.selector, 1.9e18));

        assertEq(musd.balanceOf(merchant), 0, "payment is atomic");
    }

    function test_pay_payerMinIcrAboveFloor_succeedsAtExactIcr() public {
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);
        o.minIcrAfter = 2e18;
        troveManager.setIcr(2e18);
        _pay(o);
        assertGt(musd.balanceOf(merchant), 0, "paid");
    }

    function test_pay_rejectsMinIcrBelowFloor() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        o.minIcrAfter = 1.5e18 - 1;

        _payRevert(o, abi.encodePacked(MezherPay.MinIcrBelowFloor.selector));
    }

    function test_pay_balanceOnlyWorksViaRelayer() public {
        address relayer = makeAddr("relayer");
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.prank(relayer);
        mezherPay.pay(o, sig, permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 12e18 - mezherPay.feeOf(12e18), "merchant paid via relayer");
    }

    /// @dev v1 known issue: a leftover MUSD allowance to the contract could be spent by a caller who named
    ///      itself as merchant. Now every move needs an order signed by the payer.
    function test_leftoverAllowance_cannotBeUsedWithoutOrder() public {
        vm.prank(payer);
        musd.approve(address(mezherPay), type(uint256).max);

        address attacker = makeAddr("attacker");
        (, uint256 attackerPk) = makeAddrAndKey("attackerKey");
        MezherPay.Order memory o = _order(payer, attacker, 50e18, 50e18);

        MezherPay.PermitSig memory permit = _permitSig(attackerPk, payer, 50e18, o.deadline);
        bytes memory badSig = _orderSig(attackerPk, o);

        vm.prank(attacker);
        _expectPayRevert(abi.encodePacked(MezherPay.BadOrderSignature.selector), o, badSig, permit, _noBorrowSig());

        vm.prank(attacker);
        _expectPayRevert(abi.encodePacked(MezherPay.BadOrderSignature.selector), o, "", permit, _noBorrowSig());

        assertEq(musd.balanceOf(payer), 100e18, "payer funds untouched");
        assertEq(musd.balanceOf(attacker), 0, "attacker got nothing");
    }

    function test_feeNeverExceedsDelivered_fuzz(uint256 amount, uint256 fromBalance) public {
        amount = bound(amount, 1, 100e18);
        fromBalance = bound(fromBalance, 0, amount);
        MezherPay.Order memory o = _order(payer, merchant, amount, fromBalance);

        assertLe(mezherPay.feeOf(amount), amount * 100 / 10_000, "fee within the 1% cap");

        _pay(o);

        uint256 fee = musd.balanceOf(treasury);
        assertEq(fee, mezherPay.feeOf(amount), "treasury got exactly the fee");
        assertEq(musd.balanceOf(merchant) + fee, amount, "merchant net plus fee equals delivered");
        assertEq(musd.balanceOf(address(mezherPay)), 0, "contract holds nothing");
    }

    function test_constructor_rejectsFeeAbove100Bps() public {
        vm.expectRevert(MezherPay.FeeTooHigh.selector);
        new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(priceFeed)),
            treasury,
            101
        );
    }

    function test_constructor_acceptsExactly100Bps() public {
        MezherPay p = new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(priceFeed)),
            treasury,
            100
        );
        assertEq(p.feeOf(12e18), 0.12e18);
    }

    function test_constructor_rejectsZeroTreasury() public {
        vm.expectRevert(MezherPay.ZeroAddress.selector);
        new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(priceFeed)),
            address(0),
            FEE_BPS
        );
    }

    /// @dev Mezo Recovery Mode (or any other Mezo revert) after the balance part moved must undo it.
    function test_pay_borrowFailure_restoresBalancePart() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 5e18);
        vm.mockCallRevert(
            address(bos),
            abi.encodeWithSelector(MockBorrowerOps.withdrawMUSDWithSignature.selector),
            "BorrowerOps: Operation not permitted during Recovery Mode"
        );

        _payRevert(
            o, abi.encodeWithSignature("Error(string)", "BorrowerOps: Operation not permitted during Recovery Mode")
        );

        assertEq(musd.balanceOf(payer), 100e18, "payer balance restored");
        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
        assertEq(musd.balanceOf(treasury), 0, "treasury unchanged");
        assertFalse(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "order not consumed");
    }

    function testRevert_zeroMerchant() public {
        MezherPay.Order memory o = _order(payer, address(0), 12e18, 12e18);
        _expectPayRevert(
            abi.encodePacked(MezherPay.ZeroAddress.selector),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 12e18, o.deadline),
            _noBorrowSig()
        );
    }

    function testRevert_zeroPayer() public {
        MezherPay.Order memory o = _order(address(0), merchant, 12e18, 12e18);
        _expectPayRevert(
            abi.encodePacked(MezherPay.ZeroAddress.selector),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 12e18, o.deadline),
            _noBorrowSig()
        );
    }

    function testRevert_zeroAmount() public {
        MezherPay.Order memory o = _order(payer, merchant, 0, 0);
        _expectPayRevert(
            abi.encodePacked(MezherPay.ZeroAmount.selector),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 0, o.deadline),
            _noBorrowSig()
        );
    }

    function testRevert_fromBalanceExceedsAmount() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 13e18);
        _expectPayRevert(
            abi.encodePacked(MezherPay.FromBalanceExceedsAmount.selector),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 13e18, o.deadline),
            _noBorrowSig()
        );
    }

    function testRevert_permitFromOtherKey() public {
        (, uint256 otherPk) = makeAddrAndKey("other");
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory badPermit = _permitSig(otherPk, payer, 12e18, o.deadline);

        _expectPayRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mezherPay), 0, 12e18),
            o,
            sig,
            badPermit,
            _noBorrowSig()
        );

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
    }

    function test_pay_permitFrontRun_stillSucceeds() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);
        bytes memory sig = _orderSig(payerPk, o);

        musd.permit(payer, address(mezherPay), 12e18, o.deadline, permit.v, permit.r, permit.s);
        mezherPay.pay(o, sig, permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant) + musd.balanceOf(treasury), 12e18, "delivered");
    }

    /// @dev A third party who sees the payer's signatures must not be able to name another merchant.
    function testRevert_thirdPartyRedirectsToItself() public {
        address attacker = makeAddr("attacker");
        MezherPay.Order memory o = _order(payer, merchant, 5e18, 5e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 5e18, o.deadline);
        o.merchant = attacker;

        vm.prank(attacker);
        _expectPayRevert(abi.encodePacked(MezherPay.BadOrderSignature.selector), o, sig, permit, _noBorrowSig());

        assertEq(musd.balanceOf(attacker), 0, "attacker got nothing");
    }

    function testRevert_borrowSigForOtherRecipient() public {
        address attacker = makeAddr("attacker");
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);

        _expectPayRevert(
            abi.encodeWithSignature("Error(string)", "BorrowerOperationsSignatures: Invalid signature"),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 0, o.deadline),
            _borrowSig(payerPk, 7e18, payer, attacker, o.deadline)
        );

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
        assertEq(musd.balanceOf(attacker), 0, "attacker unchanged");
    }

    function testRevert_borrowSigExpired() public {
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, o.deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, block.timestamp + 1 minutes);

        vm.warp(block.timestamp + 2 minutes); // order still valid, borrow sig is not
        _expectPayRevert(abi.encodeWithSignature("Error(string)", "Signature expired"), o, sig, permit, borrow);
    }

    function testRevert_icrBelowFloor() public {
        troveManager.setIcr(1.499e18);

        _payRevert(_order(payer, merchant, 7e18, 0), abi.encodeWithSelector(MezherPay.IcrBelowFloor.selector, 1.499e18));

        assertEq(musd.balanceOf(merchant), 0, "payment is atomic");
    }

    function test_pay_icrExactlyFloor_succeeds() public {
        troveManager.setIcr(1.5e18);
        _pay(_order(payer, merchant, 7e18, 0));
        assertEq(musd.balanceOf(merchant), 7e18 - mezherPay.feeOf(7e18), "merchant paid at the floor");
    }

    function test_pay_fromBalanceOnly_skipsIcrCheck() public {
        troveManager.setIcr(1e18);
        _pay(_order(payer, merchant, 12e18, 12e18));
        assertEq(musd.balanceOf(merchant) + musd.balanceOf(treasury), 12e18, "no borrow means no ICR guard");
    }

    function _deployWithFee(uint256 feeBps) internal returns (MezherPay) {
        return new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(priceFeed)),
            treasury,
            feeBps
        );
    }

    /// @dev With a zero fee nothing would be pulled back, so the MUSD would be locked in the contract.
    function test_pay_rejectsContractAsMerchant() public {
        mezherPay = _deployWithFee(0);
        MezherPay.Order memory o = _order(payer, address(mezherPay), 12e18, 5e18);
        _payRevert(o, abi.encodePacked(MezherPay.MerchantIsContract.selector));
        assertEq(musd.balanceOf(address(mezherPay)), 0, "contract holds nothing");
    }

    function test_pay_zeroFee_paysMerchantInFullWithoutAllowance() public {
        mezherPay = _deployWithFee(0);
        address fresh = makeAddr("freshMerchant"); // never approved the contract
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, fresh, 12e18, 5e18, 7e18, 0);
        _pay(_order(payer, fresh, 12e18, 5e18));
        assertEq(musd.balanceOf(fresh), 12e18, "merchant paid in full");
        assertEq(musd.balanceOf(treasury), 0, "no fee moved");
    }

    function test_pay_succeedsAtExactDeadline() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        vm.warp(o.deadline);
        _pay(o);
        assertEq(musd.balanceOf(merchant) + musd.balanceOf(treasury), 12e18, "paid at deadline");
    }

    // --- openAndPay ---

    uint256 internal constant OPEN_COLL = 0.1 ether;
    uint256 internal constant OPEN_DEBT = 2_000e18;

    /// @dev Signs Mezo's `OpenTrove` message with `pk` over the MockBorrowerOps domain.
    function _openSig(uint256 pk, uint256 assetAmount, uint256 debtAmount, address borrower, uint256 deadline)
        internal
        view
        returns (MezherPay.OpenSig memory)
    {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                bos.OPEN_TROVE_TYPEHASH(),
                abi.encode(assetAmount, debtAmount, borrower, borrower),
                bos.getNonce(borrower),
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked(hex"1901", bos.DOMAIN_SEPARATOR(), structHash)));
        return MezherPay.OpenSig({
            debtAmount: debtAmount,
            upperHint: address(0),
            lowerHint: address(0),
            deadline: deadline,
            signature: abi.encodePacked(r, s, v)
        });
    }

    function _openAndPay(MezherPay.Order memory o, uint256 value, MezherPay.OpenSig memory open) internal {
        mezherPay.openAndPay{value: value}(
            o, _orderSig(payerPk, o), _permitSig(payerPk, o.payer, o.fromBalance, o.deadline), open
        );
    }

    function test_openAndPay_paysMerchantAndKeepsRestWithPayer() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        uint256 fee = mezherPay.feeOf(12e18);

        vm.expectEmit(true, false, false, true);
        emit MezherPay.OpenedAtCheckout(payer, OPEN_COLL, OPEN_DEBT);
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 12e18, 0, fee);
        _openAndPay(o, OPEN_COLL, _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, o.deadline));

        assertEq(musd.balanceOf(merchant), 12e18 - fee, "merchant net of fee");
        assertEq(musd.balanceOf(treasury), fee, "treasury got the fee");
        assertEq(musd.balanceOf(payer), 100e18 + OPEN_DEBT - 12e18, "rest of the Trove MUSD stays with payer");
        assertEq(musd.balanceOf(address(mezherPay)), 0, "contract holds no MUSD");
        assertEq(address(mezherPay).balance, 0, "contract holds no BTC");
        assertEq(bos.collateral(payer), OPEN_COLL, "Trove holds the sent BTC");
        assertTrue(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "settled");
    }

    function test_openAndPay_revertsBelowMinIcr() public {
        troveManager.setIcr(1.4e18);
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        MezherPay.OpenSig memory open = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, o.deadline);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.expectRevert(abi.encodeWithSelector(MezherPay.IcrBelowFloor.selector, 1.4e18));
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);
    }

    function test_openAndPay_revertsWhenValueDiffersFromSigned() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        MezherPay.OpenSig memory open = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, o.deadline);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        mezherPay.openAndPay{value: OPEN_COLL * 2}(o, sig, permit, open);

        assertEq(bos.collateral(payer), 0, "no Trove opened");
        assertEq(musd.balanceOf(merchant), 0, "merchant unpaid");
    }

    function test_openAndPay_rejectsPartialFromBalance() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 5e18);
        MezherPay.OpenSig memory open = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, o.deadline);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 5e18, o.deadline);

        vm.expectRevert(MezherPay.OpenMustPayFromBalance.selector);
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);
    }

    /// @dev Everything an `openAndPay` signs, computed up front so `expectRevert` only sees the call itself.
    function _openArgs(MezherPay.Order memory o)
        internal
        view
        returns (bytes memory sig, MezherPay.PermitSig memory permit, MezherPay.OpenSig memory open)
    {
        sig = _orderSig(payerPk, o);
        permit = _permitSig(payerPk, o.payer, o.fromBalance, o.deadline);
        open = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, o.payer, o.deadline);
    }

    function _assertNoBtcStranded(uint256 senderBefore) internal view {
        assertEq(address(this).balance, senderBefore, "sender got the BTC back");
        assertEq(address(mezherPay).balance, 0, "contract holds no BTC");
    }

    function test_openAndPay_revertsOnExpiredOpenSig_returnsBtc() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        (bytes memory sig, MezherPay.PermitSig memory permit,) = _openArgs(o);
        MezherPay.OpenSig memory open = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, block.timestamp + 1 minutes);
        uint256 before = address(this).balance;

        vm.warp(block.timestamp + 2 minutes); // order still valid, open sig is not
        vm.expectRevert("Signature expired");
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);

        _assertNoBtcStranded(before);
        assertFalse(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "order not consumed");
    }

    function test_openAndPay_revertsOnTamperedDebt_returnsBtc() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        (bytes memory sig, MezherPay.PermitSig memory permit, MezherPay.OpenSig memory open) = _openArgs(o);
        open.debtAmount = OPEN_DEBT * 2; // the submitter tries to load the payer with more debt
        uint256 before = address(this).balance;

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);

        _assertNoBtcStranded(before);
        assertEq(bos.debt(payer), 0, "no debt");
    }

    function test_openAndPay_revertsWhenPayerHasActiveTrove_returnsBtc() public {
        MezherPay.OpenSig memory first = _openSig(payerPk, OPEN_COLL, OPEN_DEBT, payer, block.timestamp + 1 hours);
        bos.openTroveWithSignature{value: OPEN_COLL}(
            OPEN_DEBT, address(0), address(0), payer, payer, first.signature, first.deadline
        );

        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        (bytes memory sig, MezherPay.PermitSig memory permit, MezherPay.OpenSig memory open) = _openArgs(o);
        uint256 before = address(this).balance;

        vm.expectRevert("BorrowerOps: Trove is active");
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);

        _assertNoBtcStranded(before);
        assertEq(bos.collateral(payer), OPEN_COLL, "existing Trove untouched");
        assertEq(musd.balanceOf(merchant), 0, "merchant unpaid");
    }

    /// @dev An order does not commit to an entry point: a third party can settle it through `pay` first.
    function test_openAndPay_afterSameOrderSettledByPay_returnsBtc() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        (bytes memory sig, MezherPay.PermitSig memory permit, MezherPay.OpenSig memory open) = _openArgs(o);

        vm.prank(makeAddr("observer"));
        mezherPay.pay(o, sig, permit, _noBorrowSig());
        assertEq(musd.balanceOf(merchant) + musd.balanceOf(treasury), 12e18, "paid as signed");

        uint256 before = address(this).balance;
        vm.expectRevert(MezherPay.OrderAlreadySettled.selector);
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);

        _assertNoBtcStranded(before);
        assertEq(bos.collateral(payer), 0, "no Trove opened");
    }

    /// @dev Opening a Trove from the signature alone costs the observer the collateral, which stays the payer's.
    function test_openTroveSigAlone_observerGiftsTheCollateral() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        (bytes memory sig, MezherPay.PermitSig memory permit, MezherPay.OpenSig memory open) = _openArgs(o);
        address observer = makeAddr("observer");
        vm.deal(observer, OPEN_COLL);

        vm.prank(observer);
        bos.openTroveWithSignature{value: OPEN_COLL}(
            OPEN_DEBT, address(0), address(0), payer, payer, open.signature, open.deadline
        );
        assertEq(observer.balance, 0, "observer paid the collateral");
        assertEq(bos.collateral(payer), OPEN_COLL, "collateral is the payer's");
        assertEq(musd.balanceOf(observer), 0, "observer got no MUSD");
        assertEq(musd.balanceOf(payer), 100e18 + OPEN_DEBT, "MUSD went to the payer");

        uint256 before = address(this).balance;
        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        mezherPay.openAndPay{value: OPEN_COLL}(o, sig, permit, open);
        _assertNoBtcStranded(before);
    }

    function test_contractRefusesPlainBtc() public {
        (bool sent,) = address(mezherPay).call{value: 1}("");
        assertFalse(sent, "no receive function");
        assertEq(address(mezherPay).balance, 0);
    }

    // --- review regressions: merchant allowance ---

    /// @dev Anyone can pay any merchant unasked. The fee stays a fraction of what that same call delivered.
    function test_feeAllowance_unaskedOrderNeverCostsMerchant_fuzz(uint256 amount, uint256 fromBalance) public {
        amount = bound(amount, 1, 100e18);
        fromBalance = bound(fromBalance, 0, amount);
        musd.mint(merchant, 5e18); // savings a drain would target
        vm.prank(merchant);
        musd.approve(address(mezherPay), 10e18);

        _pay(_order(payer, merchant, amount, fromBalance));

        uint256 fee = mezherPay.feeOf(amount);
        assertLe(fee, amount / 100, "fee within 1% of delivered");
        assertEq(musd.balanceOf(merchant), 5e18 + amount - fee, "merchant gained delivered minus fee");
        assertEq(musd.allowance(merchant, address(mezherPay)), 10e18 - fee, "allowance down by the fee only");
    }

    /// @dev The fee allowance also lets the contract move the merchant's MUSD as a payer: only its own order can.
    function test_feeAllowance_notSpendableAsPayerWithoutMerchantSignature() public {
        musd.mint(merchant, 50e18);
        (address attacker, uint256 attackerPk) = makeAddrAndKey("attackerKey");
        MezherPay.Order memory o = _order(merchant, attacker, 50e18, 50e18);

        _expectPayRevert(
            abi.encodePacked(MezherPay.BadOrderSignature.selector),
            o,
            _orderSig(attackerPk, o),
            _permitSig(attackerPk, merchant, 50e18, o.deadline),
            _noBorrowSig()
        );
        assertEq(musd.balanceOf(merchant), 50e18, "merchant balance untouched");
    }

    // --- review regressions: signatures seen in the mempool ---

    /// @dev Known limit, SECURITY.md: the borrow signature works alone. Money reaches the signed merchant, with no
    ///      fee, no `Paid` and no floor check by MezherPay; the order stays open, so a retry would pay twice.
    function test_borrowSigAlone_deliversWithoutFeeOrSettlement() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 5e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 5e18, o.deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, o.deadline);

        vm.prank(makeAddr("observer"));
        bos.withdrawMUSDWithSignature(7e18, address(0), address(0), payer, merchant, borrow.signature, borrow.deadline);
        assertEq(musd.balanceOf(merchant), 7e18, "signed merchant has it");
        assertEq(musd.balanceOf(treasury), 0, "no fee");

        _expectPayRevert(
            abi.encodeWithSignature("Error(string)", "BorrowerOperationsSignatures: Invalid signature"),
            o,
            sig,
            permit,
            borrow
        );
        assertEq(musd.balanceOf(payer), 100e18, "balance part did not move");
        assertFalse(mezherPay.settled(keccak256(abi.encode(payer, merchant, orderId))), "order still open");
    }

    /// @dev A front-run permit alone sets an allowance nobody can spend without the order.
    function test_permitAlone_movesNothing() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.prank(makeAddr("observer"));
        musd.permit(payer, address(mezherPay), 12e18, o.deadline, permit.v, permit.r, permit.s);

        assertEq(musd.balanceOf(payer), 100e18, "nothing moved");
        assertEq(musd.allowance(payer, address(mezherPay)), 12e18, "only the signed allowance");
    }

    /// @dev Unsigned hints are the only free field: a submitter can change the gas, never the outcome.
    function test_pay_hintsAreNotSigned_outcomeUnchanged() public {
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, o.deadline);
        borrow.upperHint = makeAddr("junkHint");
        borrow.lowerHint = makeAddr("junkHint2");

        mezherPay.pay(o, _orderSig(payerPk, o), _permitSig(payerPk, payer, 0, o.deadline), borrow);
        assertEq(musd.balanceOf(merchant), 7e18 - mezherPay.feeOf(7e18), "paid as signed");
    }

    // --- review regressions: replay ---

    function test_replay_sameOrderIdDifferentTerms_blocked() public {
        _pay(_order(payer, merchant, 12e18, 12e18));
        _payRevert(_order(payer, merchant, 3e18, 3e18), abi.encodePacked(MezherPay.OrderAlreadySettled.selector));
        assertEq(musd.balanceOf(payer), 88e18, "paid once");
    }

    function test_replay_borrowSigDoesNotServeANewOrder() public {
        MezherPay.Order memory o = _order(payer, merchant, 7e18, 0);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, o.deadline);
        mezherPay.pay(o, _orderSig(payerPk, o), _permitSig(payerPk, payer, 0, o.deadline), borrow);

        o.orderId = bytes32(uint256(2));
        _expectPayRevert(
            abi.encodeWithSignature("Error(string)", "BorrowerOperationsSignatures: Invalid signature"),
            o,
            _orderSig(payerPk, o),
            _permitSig(payerPk, payer, 0, o.deadline),
            borrow
        );
    }

    function test_replay_otherChainRejected() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);

        vm.chainId(block.chainid + 1);
        _expectPayRevert(abi.encodePacked(MezherPay.BadOrderSignature.selector), o, sig, permit, _noBorrowSig());
    }

    function test_replay_redeployRejected() public {
        MezherPay.Order memory o = _order(payer, merchant, 12e18, 12e18);
        bytes memory sig = _orderSig(payerPk, o);
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, o.deadline);
        _pay(o);

        mezherPay = _deployWithFee(FEE_BPS); // fresh `settled`, new verifying contract
        _expectPayRevert(abi.encodePacked(MezherPay.BadOrderSignature.selector), o, sig, permit, _noBorrowSig());
    }
}
