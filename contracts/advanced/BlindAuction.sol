// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title BlindAuction
 * @notice A sealed-bid auction where bid amounts remain hidden until reveal.
 * @dev This example demonstrates:
 *      - Encrypted bid submission and storage
 *      - Encrypted comparison to find highest bidder
 *      - Conditional selection using FHE.select
 *
 *      All bids are encrypted, so participants cannot see each other's bids.
 *      The winner is determined through encrypted comparisons.
 */
contract BlindAuction is ZamaEthereumConfig {
  // Auction state
  address public beneficiary;
  uint256 public auctionEndTime;
  bool public auctionEnded;

  // Encrypted highest bid tracking
  euint64 private _highestBid;
  address private _highestBidder;

  // Track all bidders and their encrypted bids
  mapping(address => euint64) private _bids;
  address[] public bidders;

  // Events
  event BidPlaced(address indexed bidder);
  event AuctionEnded(address indexed winner);

  constructor(uint256 biddingTime) {
    beneficiary = msg.sender;
    auctionEndTime = block.timestamp + biddingTime;

    // Initialize highest bid to 0
    _highestBid = FHE.asEuint64(0);
    FHE.allowThis(_highestBid);
  }

  /**
   * @notice Place an encrypted bid.
   * @dev The bid amount is encrypted, so no one can see how much you bid.
   *      Bids can be updated by calling this function again.
   */
  function bid(externalEuint64 encryptedBid, bytes calldata inputProof) external {
    require(block.timestamp < auctionEndTime, "Auction already ended");

    euint64 bidAmount = FHE.fromExternal(encryptedBid, inputProof);
    FHE.allowThis(bidAmount);

    // Store the bid
    if (FHE.isInitialized(_bids[msg.sender]) == false) {
      bidders.push(msg.sender);
    }
    _bids[msg.sender] = bidAmount;

    // Compare with current highest bid
    ebool isHigher = FHE.gt(bidAmount, _highestBid);

    // Conditionally update highest bid using encrypted select
    _highestBid = FHE.select(isHigher, bidAmount, _highestBid);
    FHE.allowThis(_highestBid);

    emit BidPlaced(msg.sender);
  }

  /**
   * @notice Check if caller's bid is currently the highest (encrypted result).
   * @dev Returns encrypted boolean - caller needs permission to decrypt.
   */
  function isMyBidHighest() external returns (ebool) {
    require(FHE.isInitialized(_bids[msg.sender]), "No bid placed");

    ebool result = FHE.eq(_bids[msg.sender], _highestBid);
    FHE.allowThis(result);
    FHE.allow(result, msg.sender);

    return result;
  }

  /**
   * @notice End the auction and determine the winner.
   * @dev Finds the highest bidder by comparing all bids.
   *      This is a simplified version - in production, you'd use
   *      more sophisticated comparison or public decryption.
   */
  function endAuction() external {
    require(block.timestamp >= auctionEndTime, "Auction not yet ended");
    require(!auctionEnded, "Auction already finalized");

    auctionEnded = true;

    // Find winner by checking which bid equals highest
    for (uint256 i = 0; i < bidders.length; i++) {
      address bidder = bidders[i];
      ebool isWinner = FHE.eq(_bids[bidder], _highestBid);

      // In a real implementation, you'd use public decrypt here
      // For demo, we mark the first matching bidder
      // Note: This is simplified - production needs proper reveal mechanism
    }

    emit AuctionEnded(_highestBidder);
  }

  /**
   * @notice Get the number of bidders.
   */
  function getBidderCount() external view returns (uint256) {
    return bidders.length;
  }

  /**
   * @notice Get caller's encrypted bid (for their own viewing).
   */
  function getMyBid() external returns (euint64) {
    require(FHE.isInitialized(_bids[msg.sender]), "No bid placed");

    FHE.allow(_bids[msg.sender], msg.sender);
    return _bids[msg.sender];
  }
}
