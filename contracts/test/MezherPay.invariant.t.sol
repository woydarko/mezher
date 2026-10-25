// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MezherPay} from "../src/MezherPay.sol";
import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";
import {MockMUSD} from "./mocks/MockMUSD.sol";
import {MockBorrowerOps} from "./mocks/MockBorrowerOps.sol";
import {MockTroveManager} from "./mocks/MockTroveManager.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";

/// @notice Drives random honest payments, ICR moves and redirect attempts against MezherPay,
///         and keeps ghost totals of what should have moved.
contract MezherPayHandler is Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    MezherPay internal immutable mezherPay;
    MockMUSD internal immutable musd;
    MockBorrowerOps internal immutable bos;
    MockTroveManager internal immutable troveManager;

    address public immutable payer;
    uint256 internal immutable payerPk;
    address public immutable merchant;
    address public immutable attacker;

    uint256 public ghostPaid;
    uint256 public ghostFromBalance;
    uint256 public ghostDebt;
    uint256 public ghostBorrowsBelowFloor;
    uint256 public ghostRedirects;

    constructor(MezherPay mezherPay_, MockMUSD musd_, MockBorrowerOps bos_, MockTroveManager troveManager_) {
        mezherPay = mezherPay_;
        musd = musd_;
        bos = bos_;
        troveManager = troveManager_;
        (payer, payerPk) = makeAddrAndKey("payer");
        merchant = makeAddr("merchant");
        attacker = makeAddr("attacker");
    }

    function _permit(uint256 value, uint256 deadline) internal view returns (MezherPay.PermitSig memory) {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(mezherPay), value, musd.nonces(payer), deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(payerPk, keccak256(abi.encodePacked("\x19\x01", musd.DOMAIN_SEPARATOR(), structHash)));
        return MezherPay.PermitSig({deadline: deadline, v: v, r: r, s: s});
    }

    function _borrow(uint256 amount, address recipient, uint256 deadline)
        internal
        view
        returns (MezherPay.BorrowSig memory)
    {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                bos.WITHDRAW_MUSD_TYPEHASH(), abi.encode(amount, payer, recipient), bos.getNonce(payer), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(payerPk, keccak256(abi.encodePacked(hex"1901", bos.DOMAIN_SEPARATOR(), structHash)));
        return MezherPay.BorrowSig({
            upperHint: address(0), lowerHint: address(0), deadline: deadline, signature: abi.encodePacked(r, s, v)
        });
    }

    function _payment(address to, uint256 amount, uint256 fromBalance)
        internal
        view
        returns (MezherPay.Payment memory)
    {
        return MezherPay.Payment({
            payer: payer, merchant: to, amount: amount, fromBalance: fromBalance, orderId: bytes32(0)
        });
    }

    /// @notice An honest checkout: the payer signs for `merchant`, any split of balance and borrow.
    function pay(uint256 amount, uint256 fromBalance) external {
        amount = bound(amount, 1, 50e18);
        uint256 bal = musd.balanceOf(payer);
        fromBalance = bound(fromBalance, 0, amount < bal ? amount : bal);
        uint256 borrowed = amount - fromBalance;
        uint256 deadline = block.timestamp + 15 minutes;

        MezherPay.PermitSig memory permit = _permit(fromBalance, deadline);
        MezherPay.BorrowSig memory borrow = _borrow(borrowed, merchant, deadline);

        // Balance-only payments must come from the payer; borrowing ones go through the relayer.
        if (borrowed == 0) vm.prank(payer);
        try mezherPay.pay(_payment(merchant, amount, fromBalance), permit, borrow) {
            ghostPaid += amount;
            ghostFromBalance += fromBalance;
            ghostDebt += borrowed + borrowed / bos.BORROWING_FEE_DIVISOR();
            if (borrowed > 0 && troveManager.icr() < mezherPay.MIN_ICR_AFTER()) ghostBorrowsBelowFloor++;
        } catch {}
    }

    /// @notice Moves the payer's ICR around the 150% floor.
    function setIcr(uint256 icr) external {
        troveManager.setIcr(bound(icr, 1.3e18, 3e18));
    }

    /// @notice An attacker replays the payer's permit with itself as merchant.
    function redirectBalance(uint256 amount) external {
        amount = bound(amount, 1, musd.balanceOf(payer) + 1);
        MezherPay.PermitSig memory permit = _permit(amount, block.timestamp + 15 minutes);
        MezherPay.BorrowSig memory borrow = _borrow(0, attacker, block.timestamp);
        vm.prank(attacker);
        try mezherPay.pay(_payment(attacker, amount, amount), permit, borrow) {
            ghostRedirects++;
        } catch {}
    }

    /// @notice An attacker takes a borrow signed for `merchant` and names itself as merchant.
    function redirectBorrow(uint256 amount) external {
        amount = bound(amount, 1, 50e18);
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permit(0, deadline);
        MezherPay.BorrowSig memory borrow = _borrow(amount, merchant, deadline);
        vm.prank(attacker);
        try mezherPay.pay(_payment(attacker, amount, 0), permit, borrow) {
            ghostRedirects++;
        } catch {}
    }
}

/// @notice Stateful invariants for MezherPay over random payments and attacks.
contract MezherPayInvariantTest is Test {
    uint256 internal constant START_BALANCE = 1_000e18;

    MockMUSD internal musd;
    MockBorrowerOps internal bos;
    MezherPay internal mezherPay;
    MezherPayHandler internal handler;

    function setUp() public {
        musd = new MockMUSD();
        bos = new MockBorrowerOps(musd);
        MockTroveManager troveManager = new MockTroveManager();
        mezherPay = new MezherPay(
            IERC20(address(musd)),
            IBorrowerOperationsSignatures(address(bos)),
            ITroveManager(address(troveManager)),
            IPriceFeed(address(new MockPriceFeed()))
        );
        handler = new MezherPayHandler(mezherPay, musd, bos, troveManager);
        musd.mint(handler.payer(), START_BALANCE);
        targetContract(address(handler));
    }

    /// @dev Guards against a vacuous run where every honest payment reverted.
    function afterInvariant() public view {
        assertGt(handler.ghostPaid(), 0, "no honest payment settled");
        assertGt(handler.ghostDebt(), 0, "no borrow settled");
    }

    /// @dev MezherPay never keeps MUSD between calls.
    function invariant_holdsNoFunds() public view {
        assertEq(musd.balanceOf(address(mezherPay)), 0);
    }

    /// @dev The merchant got exactly the sum of settled payments.
    function invariant_merchantGetsExactlyPaid() public view {
        assertEq(musd.balanceOf(handler.merchant()), handler.ghostPaid());
    }

    /// @dev The payer's balance only moved by the balance parts of settled payments.
    function invariant_payerDebitedOnlyFromBalance() public view {
        assertEq(START_BALANCE - musd.balanceOf(handler.payer()), handler.ghostFromBalance());
    }

    /// @dev Trove debt only grew by settled borrows plus Mezo's 0.1% fee.
    function invariant_debtMatchesBorrows() public view {
        assertEq(bos.debt(handler.payer()), handler.ghostDebt());
    }

    /// @dev No borrow ever settled while the Trove sat under the 150% floor.
    function invariant_noBorrowBelowFloor() public view {
        assertEq(handler.ghostBorrowsBelowFloor(), 0);
    }

    /// @dev No third party ever redirected the payer's signatures.
    function invariant_noRedirect() public view {
        assertEq(handler.ghostRedirects(), 0);
        assertEq(musd.balanceOf(handler.attacker()), 0);
    }
}
