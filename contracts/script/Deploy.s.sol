// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MezherPay} from "../src/MezherPay.sol";
import {IBorrowerOperationsSignatures, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";

/// @notice Deploys MezherPay against the Mezo testnet MUSD system (addresses from docs/ARCHITECTURE.md).
contract Deploy is Script {
    address internal constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address internal constant BORROWER_OPS_SIGNATURES = 0xD757e3646AF370b15f32EB557F0F8380Df7D639e;
    address internal constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address internal constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;

    function run() external returns (MezherPay mezherPay) {
        vm.startBroadcast();
        mezherPay = new MezherPay(
            IERC20(MUSD),
            IBorrowerOperationsSignatures(BORROWER_OPS_SIGNATURES),
            ITroveManager(TROVE_MANAGER),
            IPriceFeed(PRICE_FEED)
        );
        vm.stopBroadcast();

        console.log("MezherPay", address(mezherPay));
        console.log("block", block.number);
    }
}
