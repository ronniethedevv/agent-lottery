// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFV2PlusClient} from "./VRFV2PlusClient.sol";

/// @title IVRFCoordinatorV2Plus
/// @notice Minimal interface for the Chainlink VRF V2.5 coordinator — only the
///         request entrypoint the DrawManager needs. Consumers are added to the
///         subscription off-chain at vrf.chain.link.
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId);
}
