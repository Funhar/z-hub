// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title SwapERC7984ToERC20
 * @notice Swaps confidential ERC7984 tokens to standard ERC20 tokens
 * @dev Demonstrates:
 *   - Gateway decryption pattern for confidential → clear conversion
 *   - Asynchronous decryption with callback
 *   - Safe token transfer handling
 */

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

contract SwapERC7984ToERC20 {
    /// @notice Error thrown when a gateway request is invalid
    error SwapERC7984ToERC20InvalidGatewayRequest(uint256 requestId);

    /// @notice Mapping from decryption request ID to receiver address
    mapping(uint256 requestId => address) private _receivers;

    /// @notice The confidential token to swap from
    IERC7984 private _fromToken;

    /// @notice The ERC20 token to swap to
    IERC20 private _toToken;

    /**
     * @notice Creates a new swap contract
     * @param fromToken The confidential ERC7984 token
     * @param toToken The standard ERC20 token
     */
    constructor(IERC7984 fromToken, IERC20 toToken) {
        _fromToken = fromToken;
        _toToken = toToken;
    }

    /**
     * @notice Initiates a swap from ERC7984 to ERC20
     * @dev Transfers confidential tokens and requests decryption
     * @param encryptedInput Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     */
    function swap(externalEuint64 encryptedInput, bytes memory inputProof) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);
        FHE.allowTransient(amount, address(_fromToken));
        euint64 amountTransferred = _fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = euint64.unwrap(amountTransferred);
        uint256 requestID = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        // Register who will receive the tokens
        _receivers[requestID] = msg.sender;
    }

    /**
     * @notice Callback function called by the gateway after decryption
     * @dev Transfers ERC20 tokens to the receiver
     * @param requestID The decryption request ID
     * @param amount The decrypted amount
     * @param signatures Gateway signatures for verification
     */
    function finalizeSwap(uint256 requestID, uint64 amount, bytes[] memory signatures) public virtual {
        FHE.checkSignatures(requestID, signatures);

        address to = _receivers[requestID];
        require(to != address(0), SwapERC7984ToERC20InvalidGatewayRequest(requestID));
        delete _receivers[requestID];

        if (amount != 0) {
            SafeERC20.safeTransfer(_toToken, to, amount);
        }
    }

    /// @notice Returns the source confidential token
    function fromToken() public view returns (IERC7984) {
        return _fromToken;
    }

    /// @notice Returns the destination ERC20 token
    function toToken() public view returns (IERC20) {
        return _toToken;
    }
}
