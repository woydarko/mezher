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
        bos = new MockBorrowerOps();
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
        mezherPay.pay(
            _payment(payer, merchant, 12e18, 12e18), _permitSig(payerPk, payer, 12e18, deadline), _noBorrowSig()
        );

        assertEq(musd.balanceOf(merchant), 12e18, "merchant received amount");
        assertEq(musd.balanceOf(payer), 88e18, "payer debited amount");
        assertEq(bos.calls(), 0, "borrow not used");
    }

    function test_pay_emitsPaid() public {
        uint256 deadline = block.timestamp + 15 minutes;
        vm.expectEmit(true, true, true, true);
        emit MezherPay.Paid(orderId, payer, merchant, 12e18, 12e18, 0);
        mezherPay.pay(
            _payment(payer, merchant, 12e18, 12e18), _permitSig(payerPk, payer, 12e18, deadline), _noBorrowSig()
        );
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
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), badPermit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 0, "merchant unchanged");
    }

    function test_pay_permitFrontRun_stillSucceeds() public {
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permitSig(payerPk, payer, 12e18, deadline);

        musd.permit(payer, address(mezherPay), 12e18, deadline, permit.v, permit.r, permit.s);
        mezherPay.pay(_payment(payer, merchant, 12e18, 12e18), permit, _noBorrowSig());

        assertEq(musd.balanceOf(merchant), 12e18, "merchant received amount");
    }

    function testFuzz_pay_fromBalanceOnly(uint96 amount) public {
        uint256 bounded = bound(uint256(amount), 1, 100e18);
        uint256 deadline = block.timestamp + 15 minutes;
        uint256 merchantBefore = musd.balanceOf(merchant);
        uint256 payerBefore = musd.balanceOf(payer);

        mezherPay.pay(
            _payment(payer, merchant, bounded, bounded), _permitSig(payerPk, payer, bounded, deadline), _noBorrowSig()
        );

        assertEq(musd.balanceOf(merchant) - merchantBefore, bounded, "merchant delta");
        assertEq(payerBefore - musd.balanceOf(payer), bounded, "payer delta");
    }
}
