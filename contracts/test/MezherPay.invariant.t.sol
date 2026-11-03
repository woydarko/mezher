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
    uint256 internal immutable attackerPk;
    address public immutable treasury;

    uint256 internal nextOrderId;
    MezherPay.Order[] internal settledOrders;
    bytes[] internal settledSigs;

    uint256 public ghostPaid;
    uint256 public ghostFees;
    uint256 public ghostReplays;
    uint256 public ghostUnmarked;
    uint256 public ghostFromBalance;
    uint256 public ghostDebt;
    uint256 public ghostBorrowsBelowFloor;
    uint256 public ghostRedirects;
    uint256 public ghostOpens;
    uint256 public ghostOpenCollateral;
    uint256 public ghostOpenerShortfall;

    uint256 internal constant OPEN_DEBT = 2_000e18;

    /// @dev Each opener is a fresh account: Mezo allows one active Trove per borrower.
    uint256 internal nextOpener;

    constructor(MezherPay mezherPay_, MockMUSD musd_, MockBorrowerOps bos_, MockTroveManager troveManager_) {
        mezherPay = mezherPay_;
        musd = musd_;
        bos = bos_;
        troveManager = troveManager_;
        (payer, payerPk) = makeAddrAndKey("payer");
        merchant = makeAddr("merchant");
        (attacker, attackerPk) = makeAddrAndKey("attacker");
        treasury = mezherPay_.treasury();

        // The merchant grants the fee allowance once, ahead of any payment.
        vm.prank(merchant);
        musd_.approve(address(mezherPay_), type(uint256).max);
    }

    function _orderSig(uint256 pk, MezherPay.Order memory o) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MezherPay"),
                keccak256("2"),
                block.chainid,
                address(mezherPay)
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked(hex"1901", domain, structHash)));
        return abi.encodePacked(r, s, v);
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

    function _order(address to, uint256 amount, uint256 fromBalance, uint256 deadline)
        internal
        view
        returns (MezherPay.Order memory)
    {
        return MezherPay.Order({
            payer: payer,
            merchant: to,
            amount: amount,
            fromBalance: fromBalance,
            minIcrAfter: 1.5e18,
            orderId: bytes32(nextOrderId),
            deadline: deadline
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

        MezherPay.Order memory o = _order(merchant, amount, fromBalance, deadline);
        bytes memory sig = _orderSig(payerPk, o);
        // Anyone may relay: alternate between the payer and a third party.
        if (borrowed % 2 == 0) vm.prank(payer);
        try mezherPay.pay(o, sig, permit, borrow) {
            nextOrderId++;
            settledOrders.push(o);
            settledSigs.push(sig);
            if (!mezherPay.settled(keccak256(abi.encode(o.payer, o.merchant, o.orderId)))) ghostUnmarked++;
            ghostPaid += amount;
            ghostFees += mezherPay.feeOf(amount);
            ghostFromBalance += fromBalance;
            ghostDebt += borrowed + borrowed / bos.BORROWING_FEE_DIVISOR();
            if (borrowed > 0 && troveManager.icr() < mezherPay.MIN_ICR_AFTER()) ghostBorrowsBelowFloor++;
        } catch {}
    }

    /// @notice No Trove yet: a fresh payer opens one with BTC and pays from what it minted, sending the tx itself.
    ///         `tamper` sends a BTC value other than the signed one, which Mezo's signature rejects.
    function openAndPay(uint256 amount, uint256 coll, bool tamper) external {
        amount = bound(amount, 1, 50e18);
        coll = bound(coll, 1, 10 ether);
        uint256 deadline = block.timestamp + 15 minutes;
        (address opener, uint256 pk) = makeAddrAndKey(string.concat("opener", vm.toString(nextOpener++)));

        MezherPay.Order memory o = _order(merchant, amount, amount, deadline);
        o.payer = opener;
        bytes memory sig = _orderSig(pk, o);
        MezherPay.PermitSig memory permit = _openerPermit(pk, opener, amount, deadline);
        MezherPay.OpenSig memory open = _openerOpen(pk, opener, coll, deadline);

        uint256 sent = tamper ? coll + 1 : coll;
        vm.deal(opener, sent);
        vm.prank(opener);
        try mezherPay.openAndPay{value: sent}(o, sig, permit, open) {
            nextOrderId++;
            ghostOpens++;
            ghostOpenCollateral += sent;
            ghostPaid += amount;
            ghostFees += mezherPay.feeOf(amount);
            if (musd.balanceOf(opener) != OPEN_DEBT - amount) ghostOpenerShortfall++;
            if (troveManager.icr() < mezherPay.MIN_ICR_AFTER()) ghostBorrowsBelowFloor++;
        } catch {
            if (opener.balance != sent) ghostOpenerShortfall++; // a failed open returns all the BTC
        }
    }

    function _openerPermit(uint256 pk, address opener, uint256 value, uint256 deadline)
        internal
        view
        returns (MezherPay.PermitSig memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, opener, address(mezherPay), value, musd.nonces(opener), deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", musd.DOMAIN_SEPARATOR(), structHash)));
        return MezherPay.PermitSig({deadline: deadline, v: v, r: r, s: s});
    }

    function _openerOpen(uint256 pk, address opener, uint256 coll, uint256 deadline)
        internal
        view
        returns (MezherPay.OpenSig memory)
    {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                bos.OPEN_TROVE_TYPEHASH(), abi.encode(coll, OPEN_DEBT, opener, opener), bos.getNonce(opener), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked(hex"1901", bos.DOMAIN_SEPARATOR(), structHash)));
        return MezherPay.OpenSig({
            debtAmount: OPEN_DEBT,
            upperHint: address(0),
            lowerHint: address(0),
            deadline: deadline,
            signature: abi.encodePacked(r, s, v)
        });
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
        MezherPay.Order memory o = _order(attacker, amount, amount, block.timestamp + 15 minutes);
        bytes memory sig = _orderSig(attackerPk, o);
        vm.prank(attacker);
        try mezherPay.pay(o, sig, permit, borrow) {
            ghostRedirects++;
        } catch {}
    }

    /// @notice An attacker takes a borrow signed for `merchant` and names itself as merchant.
    function redirectBorrow(uint256 amount) external {
        amount = bound(amount, 1, 50e18);
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permit(0, deadline);
        MezherPay.BorrowSig memory borrow = _borrow(amount, merchant, deadline);
        MezherPay.Order memory o = _order(attacker, amount, 0, deadline);
        bytes memory sig = _orderSig(attackerPk, o);
        vm.prank(attacker);
        try mezherPay.pay(o, sig, permit, borrow) {
            ghostRedirects++;
        } catch {}
    }

    /// @notice Anyone resubmits an order that already settled, with its valid signature.
    function replay(uint256 index) external {
        if (settledOrders.length == 0) return;
        index = bound(index, 0, settledOrders.length - 1);
        MezherPay.Order memory o = settledOrders[index];
        uint256 deadline = block.timestamp + 15 minutes;
        MezherPay.PermitSig memory permit = _permit(o.fromBalance, deadline);
        MezherPay.BorrowSig memory borrow = _borrow(o.amount - o.fromBalance, merchant, deadline);
        vm.prank(attacker);
        try mezherPay.pay(o, settledSigs[index], permit, borrow) {
            ghostReplays++;
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
            IPriceFeed(address(new MockPriceFeed())),
            makeAddr("treasury"),
            50
        );
        handler = new MezherPayHandler(mezherPay, musd, bos, troveManager);
        musd.mint(handler.payer(), START_BALANCE);
        targetContract(address(handler));
    }

    /// @dev Guards against a vacuous run where every honest payment reverted.
    function afterInvariant() public view {
        assertGt(handler.ghostPaid(), 0, "no honest payment settled");
        assertGt(handler.ghostDebt(), 0, "no borrow settled");
        assertGt(handler.ghostOpens(), 0, "no openAndPay settled");
    }

    /// @dev MezherPay never keeps MUSD or BTC between calls.
    function invariant_holdsNoFunds() public view {
        assertEq(musd.balanceOf(address(mezherPay)), 0);
        assertEq(address(mezherPay).balance, 0);
    }

    /// @dev All BTC of settled `openAndPay` calls sits in the Troves, and nothing else went there.
    function invariant_openBtcEndsInTroves() public view {
        assertEq(address(bos).balance, handler.ghostOpenCollateral());
    }

    /// @dev An opener keeps exactly the Trove's MUSD minus the payment; a failed open returns all its BTC.
    function invariant_openerKeepsTheRest() public view {
        assertEq(handler.ghostOpenerShortfall(), 0);
    }

    /// @dev Merchant plus treasury got exactly the sum of settled payments.
    function invariant_merchantGetsExactlyPaid() public view {
        assertEq(musd.balanceOf(handler.merchant()) + musd.balanceOf(handler.treasury()), handler.ghostPaid());
    }

    /// @dev The treasury got exactly the fees of settled payments, nothing more.
    function invariant_treasuryGetsExactlyFees() public view {
        assertEq(musd.balanceOf(handler.treasury()), handler.ghostFees());
    }

    /// @dev The merchant's net is the settled total minus the fees.
    function invariant_merchantNetMatchesSettled() public view {
        assertEq(musd.balanceOf(handler.merchant()), handler.ghostPaid() - handler.ghostFees());
    }

    /// @dev No settled order settled again, and every settled order was marked on-chain.
    function invariant_noOrderSettledTwice() public view {
        assertEq(handler.ghostReplays(), 0);
        assertEq(handler.ghostUnmarked(), 0);
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
