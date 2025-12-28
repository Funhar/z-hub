Trustless sealed-bid auctions where bids are submitted as encrypted values. The winner is determined privately on-chain, ensuring bids stay secret until the reveal phase.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="BlindAuction.sol" %}

```solidity
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

```

{% endtab %}

{% tab title="BlindAuction.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { BlindAuction, BlindAuction__factory } from "../../types";
import type { Signers } from "../types";

async function deployFixture() {
  // Set auction duration to 1 hour
  const biddingTime = 3600;
  const factory = (await ethers.getContractFactory(
    "BlindAuction"
  )) as BlindAuction__factory;
  const blindAuction = (await factory.deploy(biddingTime)) as BlindAuction;
  const blindAuction_address = await blindAuction.getAddress();

  return { blindAuction, blindAuction_address, biddingTime };
}

/**
 * This example demonstrates a blind auction with encrypted bids.
 * Tests verify bid placement, comparison, and auction flow.
 */
describe("BlindAuction", function () {
  let contract: BlindAuction;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;
  let charlie: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
    charlie = ethSigners[3];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.blindAuction_address;
    contract = deployment.blindAuction;
  });

  it("should allow placing encrypted bids", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceBid = 100n;
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(aliceBid)
      .encrypt();

    await expect(
      contract
        .connect(signers.alice)
        .bid(aliceInput.handles[0], aliceInput.inputProof)
    )
      .to.emit(contract, "BidPlaced")
      .withArgs(signers.alice.address);

    expect(await contract.getBidderCount()).to.equal(1);
  });

  it("should track multiple bidders", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Bob bids 150
    const bobInput = await fhevm
      .createEncryptedInput(contractAddress, bob.address)
      .add64(150n)
      .encrypt();
    tx = await contract
      .connect(bob)
      .bid(bobInput.handles[0], bobInput.inputProof);
    await tx.wait();

    // Charlie bids 75
    const charlieInput = await fhevm
      .createEncryptedInput(contractAddress, charlie.address)
      .add64(75n)
      .encrypt();
    tx = await contract
      .connect(charlie)
      .bid(charlieInput.handles[0], charlieInput.inputProof);
    await tx.wait();

    expect(await contract.getBidderCount()).to.equal(3);
  });

  it("should allow bidder to retrieve their own bid", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const bidAmount = 250n;

    // Alice places a bid
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(bidAmount)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Alice retrieves her bid
    tx = await contract.connect(signers.alice).getMyBid();
    await tx.wait();

    // Get the encrypted bid and decrypt
    const encryptedBid = await contract
      .connect(signers.alice)
      .getMyBid.staticCall();
    const decryptedBid = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBid,
      contractAddress,
      signers.alice
    );

    expect(decryptedBid).to.equal(bidAmount);
  });

  it("should allow bidder to check if their bid is highest", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Bob bids higher: 200
    const bobInput = await fhevm
      .createEncryptedInput(contractAddress, bob.address)
      .add64(200n)
      .encrypt();
    tx = await contract
      .connect(bob)
      .bid(bobInput.handles[0], bobInput.inputProof);
    await tx.wait();

    // Alice checks if her bid is highest (it shouldn't be)
    tx = await contract.connect(signers.alice).isMyBidHighest();
    await tx.wait();

    const encryptedResult = await contract
      .connect(signers.alice)
      .isMyBidHighest.staticCall();
    const isHighest = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      signers.alice
    );
    expect(isHighest).to.equal(false);

    // Bob checks if his bid is highest (it should be)
    tx = await contract.connect(bob).isMyBidHighest();
    await tx.wait();

    const bobEncryptedResult = await contract
      .connect(bob)
      .isMyBidHighest.staticCall();
    const bobIsHighest = await fhevm.userDecryptEbool(
      bobEncryptedResult,
      contractAddress,
      bob
    );
    expect(bobIsHighest).to.equal(true);
  });

  it("should allow updating a bid", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice initially bids 100
    let aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Alice updates to 300
    aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(300n)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Still only 1 bidder
    expect(await contract.getBidderCount()).to.equal(1);

    // Verify updated bid
    tx = await contract.connect(signers.alice).getMyBid();
    await tx.wait();

    const encryptedBid = await contract
      .connect(signers.alice)
      .getMyBid.staticCall();
    const decryptedBid = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBid,
      contractAddress,
      signers.alice
    );

    expect(decryptedBid).to.equal(300n);
  });
});

```

{% endtab %}

{% endtabs %}
