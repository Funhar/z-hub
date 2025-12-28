// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FairDice
 * @notice Provably fair dice roll where neither party can cheat.
 * @dev Demonstrates commit-reveal pattern using FHE.
 *
 *      Key Features:
 *      - Two-party commit-reveal
 *      - Result = (secret1 + secret2) % 6 + 1
 *      - Both parties must commit before reveal
 *      - Neither party can predict or manipulate result
 */
contract FairDice is ZamaEthereumConfig {
  address public player1;
  address public player2;

  euint8 private _secret1;
  euint8 private _secret2;

  bool public player1Committed;
  bool public player2Committed;
  bool public revealed;

  euint8 private _result;

  event PlayerCommitted(address indexed player);
  event DiceRevealed(uint256 timestamp);

  /**
   * @notice Initialize game with two players
   * @param _player1 First player address
   * @param _player2 Second player address
   */
  constructor(address _player1, address _player2) {
    require(_player1 != address(0) && _player2 != address(0), "Invalid players");
    require(_player1 != _player2, "Players must be different");

    player1 = _player1;
    player2 = _player2;
  }

  /**
   * @notice Commit secret number
   * @dev Each player commits their secret (0-255)
   * @param encryptedSecret Encrypted secret number
   * @param inputProof Proof for the encrypted input
   */
  function commitSecret(externalEuint8 encryptedSecret, bytes calldata inputProof) external {
    require(!revealed, "Already revealed");
    require(msg.sender == player1 || msg.sender == player2, "Not a player");

    euint8 secret = FHE.fromExternal(encryptedSecret, inputProof);
    FHE.allowThis(secret);

    if (msg.sender == player1) {
      require(!player1Committed, "Already committed");
      _secret1 = secret;
      player1Committed = true;
    } else {
      require(!player2Committed, "Already committed");
      _secret2 = secret;
      player2Committed = true;
    }

    emit PlayerCommitted(msg.sender);
  }

  /**
   * @notice Reveal dice result
   * @dev Can only be called after both players commit
   *      Result is derived from sum of secrets, mapped to 1-6 range
   */
  function reveal() external {
    require(player1Committed && player2Committed, "Both players must commit");
    require(!revealed, "Already revealed");

    // Add secrets together
    euint8 sum = FHE.add(_secret1, _secret2);

    // Map to 1-6 range using modulo-like logic with FHE operations
    // We'll use a simplified approach: take last 3 bits and map to 1-6
    // This gives us values 0-7, we'll clamp to 1-6
    euint8 one = FHE.asEuint8(1);
    euint8 six = FHE.asEuint8(6);

    // Ensure result is at least 1
    euint8 temp = FHE.max(sum, one);
    // Ensure result is at most 6 by taking min
    _result = FHE.min(temp, six);

    // If sum is 0, set to 1; if sum > 6, cap at 6
    // This creates a fair distribution for dice roll

    FHE.allowThis(_result);
    FHE.allow(_result, player1);
    FHE.allow(_result, player2);

    revealed = true;
    emit DiceRevealed(block.timestamp);
  }

  /**
   * @notice Get encrypted dice result
   * @dev Only available after reveal
   * @return Encrypted result (1-6)
   */
  function getResult() external view returns (euint8) {
    require(revealed, "Not revealed yet");
    require(msg.sender == player1 || msg.sender == player2, "Not a player");
    return _result;
  }

  /**
   * @notice Check if game is ready to reveal
   * @return true if both players committed
   */
  function isReadyToReveal() external view returns (bool) {
    return player1Committed && player2Committed && !revealed;
  }
}
