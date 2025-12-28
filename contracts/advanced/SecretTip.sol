// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SecretTip
 * @notice Anonymous tipping where sender and amount remain hidden.
 * @dev Demonstrates privacy-preserving donations using FHE.
 *
 *      Key Features:
 *      - Encrypted tip amounts
 *      - Sender identity not linked to tip amount
 *      - Running encrypted sum of tips
 *      - Only owner can decrypt total
 */
contract SecretTip is ZamaEthereumConfig {
  address public owner;
  euint64 private _totalTips;
  uint256 public tipCount;

  event TipReceived(uint256 indexed tipNumber);
  event TipsWithdrawn(uint256 timestamp);

  /**
   * @notice Initialize contract with owner
   */
  constructor() {
    owner = msg.sender;
    _totalTips = FHE.asEuint64(0);
    FHE.allowThis(_totalTips);
  }

  /**
   * @notice Send anonymous tip
   * @dev Tip amount is encrypted, sender is not stored
   * @param encryptedAmount Encrypted tip amount
   * @param inputProof Proof for the encrypted input
   */
  function tip(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
    FHE.allowThis(amount);

    // Add to running total
    _totalTips = FHE.add(_totalTips, amount);
    FHE.allowThis(_totalTips);

    tipCount++;
    emit TipReceived(tipCount);
  }

  /**
   * @notice Get encrypted total tips (owner only)
   * @return Encrypted total tips
   */
  function getTotalTips() external returns (euint64) {
    require(msg.sender == owner, "Only owner can view total");

    FHE.allow(_totalTips, owner);
    return _totalTips;
  }

  /**
   * @notice View total tips handle (without permission)
   */
  function viewTotalTips() external view returns (euint64) {
    return _totalTips;
  }

  /**
   * @notice Reset tips counter (owner only)
   * @dev Used after withdrawal to start fresh
   */
  function resetTips() external {
    require(msg.sender == owner, "Only owner");

    _totalTips = FHE.asEuint64(0);
    FHE.allowThis(_totalTips);
    tipCount = 0;

    emit TipsWithdrawn(block.timestamp);
  }

  /**
   * @notice Get public tip count
   * @return Number of tips received
   */
  function getTipCount() external view returns (uint256) {
    return tipCount;
  }
}
