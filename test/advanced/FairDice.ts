import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FairDice, FairDice__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture(player1: string, player2: string) {
  const factory = (await ethers.getContractFactory(
    "FairDice"
  )) as FairDice__factory;
  const dice = (await factory.deploy(player1, player2)) as FairDice;
  const dice_address = await dice.getAddress();

  return { dice, dice_address };
}

/**
 * Tests for FairDice - provably fair dice rolling
 */
describe("FairDice", function () {
  let contract: FairDice;
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
    const deployment = await deployFixture(
      signers.owner.address,
      signers.alice.address
    );
    contractAddress = deployment.dice_address;
    contract = deployment.dice;
  });

  describe("Initialization", function () {
    it("should set players correctly", async function () {
      expect(await contract.player1()).to.equal(signers.owner.address);
      expect(await contract.player2()).to.equal(signers.alice.address);
    });

    it("should prevent same player addresses", async function () {
      const factory = (await ethers.getContractFactory(
        "FairDice"
      )) as FairDice__factory;

      await expect(
        factory.deploy(signers.owner.address, signers.owner.address)
      ).to.be.revertedWith("Players must be different");
    });
  });

  describe("Committing", function () {
    it("should allow player1 to commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(42)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.emit(contract, "PlayerCommitted");

      expect(await contract.player1Committed()).to.be.true;
    });

    it("should allow player2 to commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(99)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.emit(contract, "PlayerCommitted");

      expect(await contract.player2Committed()).to.be.true;
    });

    it("should prevent double commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(42)
        .encrypt();

      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      const input2 = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(50)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .commitSecret(input2.handles[0], input2.inputProof)
      ).to.be.revertedWith("Already committed");
    });

    it("should prevent non-player from committing", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
      const nonPlayer = ethSigners[2];

      const input = await fhevm
        .createEncryptedInput(contractAddress, nonPlayer.address)
        .add8(42)
        .encrypt();

      await expect(
        contract
          .connect(nonPlayer)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.be.revertedWith("Not a player");
    });
  });

  describe("Revealing", function () {
    it("should reveal result after both commits", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Player1 commits
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(3)
        .encrypt();
      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // Player2 commits
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(4)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // Reveal
      await expect(contract.reveal()).to.emit(contract, "DiceRevealed");

      expect(await contract.revealed()).to.be.true;

      // Get result (3 + 4) % 6 + 1 = 7 % 6 + 1 = 1 + 1 = 2
      const result = await contract.connect(signers.owner).getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        result,
        contractAddress,
        signers.owner
      );

      expect(decrypted).to.be.greaterThanOrEqual(1);
      expect(decrypted).to.be.lessThanOrEqual(6);
    });

    it("should prevent reveal before both commits", async function () {
      await expect(contract.reveal()).to.be.revertedWith(
        "Both players must commit"
      );
    });

    it("should prevent double reveal", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Both commit
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(3)
        .encrypt();
      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(4)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // First reveal
      tx = await contract.reveal();
      await tx.wait();

      // Try second reveal
      await expect(contract.reveal()).to.be.revertedWith("Already revealed");
    });
  });
});
