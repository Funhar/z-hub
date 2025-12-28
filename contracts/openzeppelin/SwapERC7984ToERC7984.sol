// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title SwapERC7984ToERC7984
 * @notice Swaps between two confidential ERC7984 tokens
 * @dev Demonstrates:
 *   - Confidential-to-confidential token swaps
 *   - Transient FHE allowances for multi-contract operations
 *   - Operator pattern for token approvals
 */

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

contract SwapERC7984ToERC7984 {
    /**
     * @notice Swaps confidential tokens between two ERC7984 contracts
     * @dev Requires this contract to be an operator for the sender on fromToken
     * @param fromToken The source confidential token
     * @param toToken The destination confidential token
     * @param amountInput Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     */
    function swapConfidentialForConfidential(
        IERC7984 fromToken,
        IERC7984 toToken,
        externalEuint64 amountInput,
        bytes calldata inputProof
    ) public virtual {
        // Verify this contract is an approved operator
        require(fromToken.isOperator(msg.sender, address(this)), "Not an operator");

        // Convert external input to euint64
        euint64 amount = FHE.fromExternal(amountInput, inputProof);

        // Transfer from sender to this contract
        FHE.allowTransient(amount, address(fromToken));
        euint64 amountTransferred = fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // Transfer to sender from this contract's toToken balance
        FHE.allowTransient(amountTransferred, address(toToken));
        toToken.confidentialTransfer(msg.sender, amountTransferred);
    }
}
