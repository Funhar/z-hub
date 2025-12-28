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
