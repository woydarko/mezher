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

    MockMUSD internal musd;
    MockBorrowerOps internal bos;
    MockTroveManager internal troveManager;
    MockPriceFeed internal priceFeed;
    MezherPay internal mezherPay;

    address internal payer;
    uint256 internal payerPk;
    address internal merchant = makeAddr("merchant");
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
            IPriceFeed(address(priceFeed))
        );

        (payer, payerPk) = makeAddrAndKey("payer");
        musd.mint(payer, 100e18);
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

    function _payment(address payer_, address merchant_, uint256 amount, uint256 fromBalance)
        internal
        view
        returns (MezherPay.Payment memory)
    {
        return MezherPay.Payment({
            payer: payer_, merchant: merchant_, amount: amount, fromBalance: fromBalance, orderId: orderId
        });
    }

    function test_pay_fromBalanceOnly_movesExactAmount() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, deadline);
        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 12e18, "merchant received amount");
        assertEq(musd.balanceOf(payer), 88e18, "payer debited amount");
        assertEq(bos.calls(), 0, "borrow not used");
    }

    function test_pay_emitsPaid() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, deadline);
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 12e18, 0);
        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), permit, _noBorrowSig());
    }

    function testRevert_zeroMerchant() public {
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, block.timestamp + 1);
        vm.expectRevert(MezherPay.ZeroAddress.selector);
        mezherPay.pay(_payment(payer, address(0), 12e18, 12e18), permit, _noBorrowSig());
    }

    function testRevert_zeroPayer() public {
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, block.timestamp + 1);
        vm.expectRevert(MezherPay.ZeroAddress.selector);
        mezherPay.pay(_payment(address(0), merchant, 12e18, 12e18), permit, _noBorrowSig());
    }

    function testRevert_zeroAmount() public {
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, block.timestamp + 1);
        vm.expectRevert(MezherPay.ZeroAmount.selector);
        mezherPay.pay(_payment(payer, merchant, 0, 0), permit, _noBorrowSig());
    }

    function testRevert_fromBalanceExceedsAmount() public {
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 13e18, block.timestamp + 1);
        vm.expectRevert(MezherPay.FromBalanceExceedsAmount.selector);
        mezherPay.pay(_payment(payer, merchant, 12e18, 13e18), permit, _noBorrowSig());
    }

    function testRevert_permitFromOtherKey() public {
        (, uint256 otherPk) = makeAddrAndKey("other");
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory badPermit = _permitSig(otherPk, payer, 12e18, deadline);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(mezherPay), 0, 12e18)
        );
        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), badPermit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
    }

    function test_pay_permitFrontRun_stillSucceeds() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, deadline);

        musd.permit(payer, address(mezherPay), 12e18, deadline, permit.v, permit.r, permit.s);
        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 12e18, "merchant received amount");
    }

    /// @dev The permit does not bind a merchant: a third party who sees the payer's signatures
    ///      (mempool) must not be able to send the balance part to itself.
    function testRevert_thirdPartyRedirectsBalancePart() public {
        address attacker = makeAddr("attacker");
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 5e18, deadline);

        vm.prank(attacker);
        vm.expectRevert(MezherPay.BalanceOnlyNeedsPayer.selector);
        mezherPay.pay(_payment(payer, attacker, 5e18, 5e18), permit, _noBorrowSig());

        assertEq(musd.balanceOf(attacker), 0, "attacker got nothing");
    }

    function testFuzz_pay_fromBalanceOnly(uint96 amount) public {
        uint256 bounded = bound(uint256(amount), 1, 100e18);
        uint256 deadline = block.timestamp + 15 minutes;
        uint256 merchantBefore = musd.balanceOf(merchant);
        uint256 payerBefore = musd.balanceOf(payer);

        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, bounded, deadline);
        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, bounded, bounded), permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant) - merchantBefore, bounded, "merchant delta");
        assertEq(payerBefore - musd.balanceOf(payer), bounded, "payer delta");
    }

    function test_pay_borrowOnly_mintsToMerchant() public {
        uint256 deadline = block.timestamp + 15 minutes;
        uint256 payerBefore = musd.balanceOf(payer);

        mezherPay.pay(
            _payment(payer, merchant, 7e18, 0),
            _permitSig(payerPk, payer, 0, deadline),
            _borrowSig(payerPk, 7e18, payer, merchant, deadline)
        );

        assertEq(musd.balanceOf(merchant), 7e18, "merchant received borrow");
        assertEq(musd.balanceOf(payer), payerBefore, "payer balance untouched");
        assertEq(bos.debt(payer), 7.007e18, "debt up by borrow + 0.1% fee");
    }

    function test_pay_split_5plus7() public {
        uint256 deadline = block.timestamp + 15 minutes;
        // Payer holds exactly 5 MUSD so a 12 MUSD payment needs a 7 MUSD borrow.
        uint256 excess = musd.balanceOf(payer) - 5e18;
        vm.prank(payer);
        musd.transfer(address(1), excess);

        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 5e18, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, deadline);

        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 5e18, 7e18);
        mezherPay.pay(_payment(payer, merchant, 12e18, 5e18), permit, borrow);

        assertEq(musd.balanceOf(merchant), 12e18, "merchant received full amount");
        assertEq(musd.balanceOf(payer), 0, "payer spent its balance part");
        assertEq(bos.debt(payer), 7.007e18, "debt up by borrow + fee");
    }

    function testRevert_borrowSigForOtherRecipient() public {
        address attacker = makeAddr("attacker");
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, attacker, deadline);

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        mezherPay.pay(_payment(payer, merchant, 7e18, 0), permit, borrow);

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
        assertEq(musd.balanceOf(attacker), 0, "attacker unchanged");
    }

    function testRevert_borrowSigExpired() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, deadline);

        vm.warp(deadline + 1);
        vm.expectRevert("Signature expired");
        mezherPay.pay(_payment(payer, merchant, 7e18, 0), permit, borrow);
    }

    function testRevert_icrBelowFloor() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, deadline);
        troveManager.setIcr(1.499e18);

        vm.expectRevert(abi.encodeWithSelector(MezherPay.IcrBelowFloor.selector, 1.499e18));
        mezherPay.pay(_payment(payer, merchant, 7e18, 0), permit, borrow);

        assertEq(musd.balanceOf(merchant), 0, "payment is atomic");
    }

    function test_pay_icrExactlyFloor_succeeds() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 0, deadline);
        MezherPay.BorrowSig memory borrow = _borrowSig(payerPk, 7e18, payer, merchant, deadline);
        troveManager.setIcr(1.5e18);

        mezherPay.pay(_payment(payer, merchant, 7e18, 0), permit, borrow);

        assertEq(musd.balanceOf(merchant), 7e18, "merchant paid at the floor");
    }

    function test_pay_fromBalanceOnly_skipsIcrCheck() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, deadline);
        troveManager.setIcr(1e18);

        vm.prank(payer);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 12e18, "no borrow means no ICR guard");
    }
}
