// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SecretVoting
 * @notice Anonymous voting system where votes are encrypted and tallied without revealing individual choices.
 * @dev Demonstrates privacy-preserving voting using FHE.
 *
 *      Key Features:
 *      - Encrypted votes (0=No, 1=Yes)
 *      - One vote per address enforcement
 *      - Voting period with start/end timestamps
 *      - Encrypted tally results
 *      - Only owner can decrypt final results
 */
contract SecretVoting is ZamaEthereumConfig {
  address public owner;
  uint256 public votingStart;
  uint256 public votingEnd;
  bool public votingEnded;

  // Encrypted tallies
  euint64 private _yesVotes;
  euint64 private _noVotes;

  // Track who has voted
  mapping(address => bool) public hasVoted;

  event VoteCast(address indexed voter);
  event VotingEnded();

  /**
   * @notice Initialize voting with duration
   * @param durationInSeconds How long voting should last
   */
  constructor(uint256 durationInSeconds) {
    owner = msg.sender;
    votingStart = block.timestamp;
    votingEnd = block.timestamp + durationInSeconds;
    votingEnded = false;

    // Initialize tallies to 0
    _yesVotes = FHE.asEuint64(0);
    _noVotes = FHE.asEuint64(0);
    FHE.allowThis(_yesVotes);
    FHE.allowThis(_noVotes);
  }

  /**
   * @notice Cast encrypted vote
   * @dev Vote must be 0 (No) or 1 (Yes)
   * @param encryptedVote Encrypted vote (0 or 1)
   * @param inputProof Proof for the encrypted input
   */
  function vote(externalEuint8 encryptedVote, bytes calldata inputProof) external {
    require(block.timestamp >= votingStart, "Voting not started");
    require(block.timestamp < votingEnd, "Voting ended");
    require(!votingEnded, "Voting has been finalized");
    require(!hasVoted[msg.sender], "Already voted");

    euint8 voteValue = FHE.fromExternal(encryptedVote, inputProof);
    FHE.allowThis(voteValue);

    // Convert vote to euint64 for accumulation
    // If vote is 1 (Yes), add to yesVotes
    // If vote is 0 (No), add to noVotes
    euint64 one = FHE.asEuint64(1);
    euint64 zero = FHE.asEuint64(0);

    // Cast euint8 to euint64 for comparison
    euint64 voteValue64 = FHE.asEuint64(voteValue);

    // If vote == 1, increment yesVotes, else increment noVotes
    euint64 yesIncrement = FHE.select(FHE.eq(voteValue64, one), one, zero);
    euint64 noIncrement = FHE.select(FHE.eq(voteValue64, zero), one, zero);

    _yesVotes = FHE.add(_yesVotes, yesIncrement);
    _noVotes = FHE.add(_noVotes, noIncrement);

    FHE.allowThis(_yesVotes);
    FHE.allowThis(_noVotes);

    hasVoted[msg.sender] = true;
    emit VoteCast(msg.sender);
  }

  /**
   * @notice End voting period (only owner)
   */
  function endVoting() external {
    require(msg.sender == owner, "Only owner can end voting");
    require(!votingEnded, "Voting already ended");

    votingEnded = true;
    emit VotingEnded();
  }

  /**
   * @notice Get encrypted yes votes count (only owner, after voting ends)
   * @return Encrypted yes votes
   */
  function getYesVotes() external returns (euint64) {
    require(msg.sender == owner, "Only owner can view results");
    require(votingEnded, "Voting not ended");

    FHE.allow(_yesVotes, owner);
    return _yesVotes;
  }

  /**
   * @notice Get encrypted no votes count (only owner, after voting ends)
   * @return Encrypted no votes
   */
  function getNoVotes() external returns (euint64) {
    require(msg.sender == owner, "Only owner can view results");
    require(votingEnded, "Voting not ended");

    FHE.allow(_noVotes, owner);
    return _noVotes;
  }

  /**
   * @notice View yes votes handle (without permission)
   */
  function viewYesVotes() external view returns (euint64) {
    return _yesVotes;
  }

  /**
   * @notice View no votes handle (without permission)
   */
  function viewNoVotes() external view returns (euint64) {
    return _noVotes;
  }
}
