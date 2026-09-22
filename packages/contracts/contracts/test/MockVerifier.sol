// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockVerifier {
    bool public shouldPass;

    constructor() {
        shouldPass = true;
    }

    function setResult(bool _shouldPass) external {
        shouldPass = _shouldPass;
    }

    // 5-public-input circuits (eligibility, claim)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[5] calldata
    ) external view returns (bool) {
        return shouldPass;
    }

    // 2-public-input circuit (ticket)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[2] calldata
    ) external view returns (bool) {
        return shouldPass;
    }

    // 6-public-input circuit (claim)
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[6] calldata
    ) external view returns (bool) {
        return shouldPass;
    }
}
