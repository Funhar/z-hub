import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { PrivateVault, PrivateVault__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivateVault"
  )) as PrivateVault__factory;
  const vault = (await factory.deploy()) as PrivateVault;
  const vault_address = await vault.getAddress();

  return { vault, vault_address };
}

/**
 * Tests for PrivateVault - encrypted deposits and withdrawals
 */
describe("PrivateVault", function () {
  let contract: PrivateVault;
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
    contractAddress = deployment.vault_address;
    contract = deployment.vault;
  });

  describe("Deposit", function () {
    it("should deposit encrypted amount and update balance", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const depositAmount = 1000;

      // Create encrypted deposit
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(depositAmount)
        .encrypt();

      // Deposit
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // First deposit: 500
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Second deposit: 300
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(300)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(800); // 500 + 300
    });
  });

  describe("Withdraw", function () {
    it("should withdraw when balance is sufficient", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Deposit 1000
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Withdraw 400
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(400)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .withdraw(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(600); // 1000 - 400
    });

    it("should not change balance when withdrawal exceeds balance", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Deposit 500
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Try to withdraw 1000 (more than balance)
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .withdraw(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance - should still be 500
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(500); // Unchanged
    });
  });

  describe("Balance Privacy", function () {
    it("should keep balances separate per user", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice deposits 1000
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner deposits 2000
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add64(2000)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Check Alice's balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.connect(signers.alice).viewBalance(),
        contractAddress,
        signers.alice
      );

      // Check Owner's balance
      tx = await contract.connect(signers.owner).getBalance();
      await tx.wait();
      const ownerBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.connect(signers.owner).viewBalance(),
        contractAddress,
        signers.owner
      );

      expect(aliceBalance).to.equal(1000);
      expect(ownerBalance).to.equal(2000);
    });
  });
});
