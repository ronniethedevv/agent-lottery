// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VRFV2PlusClient
/// @notice Minimal vendored copy of Chainlink's VRF V2.5 client library.
/// @dev Matches @chainlink/contracts VRFV2PlusClient exactly (struct layout,
///      tag, and extraArgs encoding) so requests are ABI-compatible with the
///      live VRF 2.5 coordinator. Vendored to avoid pulling the full Chainlink
///      package (which has a git-resolved subdependency pnpm rejects).
library VRFV2PlusClient {
    bytes4 public constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function _argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
    }
}
