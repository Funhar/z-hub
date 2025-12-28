Documentation for SecretVoting

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="SecretVoting.sol" %}

```solidity
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

```

{% endtab %}

{% tab title="SecretVoting.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { SecretVoting, SecretVoting__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "SecretVoting"
  )) as SecretVoting__factory;
  const voting = (await factory.deploy(3600)) as SecretVoting; // 1 hour voting period
  const voting_address = await voting.getAddress();

  return { voting, voting_address };
}

/**
 * Tests for SecretVoting - encrypted anonymous voting
 */
describe("SecretVoting", function () {
  let contract: SecretVoting;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.voting_address;
    contract = deployment.voting;
  });

  describe("Voting", function () {
    it("should cast encrypted yes vote", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Vote Yes (1)
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(1)
        .encrypt();

      await expect(
        contract.connect(signers.alice).vote(input.handles[0], input.inputProof)
      ).to.emit(contract, "VoteCast");

      expect(await contract.hasVoted(signers.alice.address)).to.be.true;
    });

    it("should cast encrypted no vote", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Vote No (0)
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(0)
        .encrypt();

      await expect(
        contract.connect(signers.alice).vote(input.handles[0], input.inputProof)
      ).to.emit(contract, "VoteCast");
    });

    it("should prevent double voting", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // First vote
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(1)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .vote(input.handles[0], input.inputProof);
      await tx.wait();

      // Try to vote again
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(0)
        .encrypt();

      await expect(
        contract.connect(signers.alice).vote(input.handles[0], input.inputProof)
      ).to.be.revertedWith("Already voted");
    });
  });

  describe("Voting End", function () {
    it("should allow owner to end voting", async function () {
      await expect(contract.connect(signers.owner).endVoting()).to.emit(
        contract,
        "VotingEnded"
      );

      expect(await contract.votingEnded()).to.be.true;
    });

    it("should prevent non-owner from ending voting", async function () {
      await expect(
        contract.connect(signers.alice).endVoting()
      ).to.be.revertedWith("Only owner can end voting");
    });

    it("should prevent voting after ended", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // End voting
      let tx = await contract.connect(signers.owner).endVoting();
      await tx.wait();

      // Try to vote
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(1)
        .encrypt();

      await expect(
        contract.connect(signers.alice).vote(input.handles[0], input.inputProof)
      ).to.be.revertedWith("Voting has been finalized");
    });
  });

  describe("Results", function () {
    it("should tally yes and no votes correctly", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice votes Yes
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(1)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .vote(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner votes No
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(0)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .vote(input.handles[0], input.inputProof);
      await tx.wait();

      // End voting
      tx = await contract.connect(signers.owner).endVoting();
      await tx.wait();

      // Get results
      tx = await contract.connect(signers.owner).getYesVotes();
      await tx.wait();
      tx = await contract.connect(signers.owner).getNoVotes();
      await tx.wait();

      const yesVotes = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewYesVotes(),
        contractAddress,
        signers.owner
      );

      const noVotes = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewNoVotes(),
        contractAddress,
        signers.owner
      );

      expect(yesVotes).to.equal(1);
      expect(noVotes).to.equal(1);
    });

    it("should prevent viewing results before voting ends", async function () {
      await expect(
        contract.connect(signers.owner).getYesVotes()
      ).to.be.revertedWith("Voting not ended");
    });

    it("should prevent non-owner from viewing results", async function () {
      // End voting first
      let tx = await contract.connect(signers.owner).endVoting();
      await tx.wait();

      await expect(
        contract.connect(signers.alice).getYesVotes()
      ).to.be.revertedWith("Only owner can view results");
    });
  });
});

```

{% endtab %}

{% endtabs %}
