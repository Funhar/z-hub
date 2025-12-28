import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AnonymousWhistle, AnonymousWhistle__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AnonymousWhistle"
  )) as AnonymousWhistle__factory;
  const whistle = (await factory.deploy()) as AnonymousWhistle;
  const whistle_address = await whistle.getAddress();

  return { whistle, whistle_address };
}

/**
 * Tests for AnonymousWhistle - anonymous reporting system
 */
describe("AnonymousWhistle", function () {
  let contract: AnonymousWhistle;
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
    contractAddress = deployment.whistle_address;
    contract = deployment.whistle;
  });

  describe("Submitting Reports", function () {
    it("should submit anonymous report", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123456789n)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .submitReport(input.handles[0], input.inputProof)
      ).to.emit(contract, "ReportSubmitted");

      expect(await contract.getReportCount()).to.equal(1);
    });

    it("should accept multiple reports", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Submit 3 reports
      for (let i = 0; i < 3; i++) {
        const input = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add256(BigInt(1000 + i))
          .encrypt();

        let tx = await contract
          .connect(signers.alice)
          .submitReport(input.handles[0], input.inputProof);
        await tx.wait();
      }

      expect(await contract.getReportCount()).to.equal(3);
    });

    it("should accept reports from different addresses", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice submits
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(111n)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner submits
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(222n)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getReportCount()).to.equal(2);
    });
  });

  describe("Viewing Reports", function () {
    it("should allow admin to view encrypted report", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const reportContent = 987654321n;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(reportContent)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      const encrypted = await contract.connect(signers.owner).getReport(0);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint256,
        encrypted,
        contractAddress,
        signers.owner
      );

      expect(decrypted).to.equal(reportContent);
    });

    it("should prevent non-admin from viewing reports", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123n)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      await expect(
        contract.connect(signers.alice).getReport(0)
      ).to.be.revertedWith("Only admin can view reports");
    });

    it("should get correct report metadata", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123n)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      const [timestamp, id] = await contract.getReportMetadata(0);

      expect(id).to.equal(0);
      expect(timestamp).to.be.greaterThan(0);
    });
  });

  describe("Admin Management", function () {
    it("should allow admin to change admin", async function () {
      await contract.connect(signers.owner).changeAdmin(signers.alice.address);

      expect(await contract.admin()).to.equal(signers.alice.address);
    });

    it("should prevent non-admin from changing admin", async function () {
      await expect(
        contract.connect(signers.alice).changeAdmin(signers.alice.address)
      ).to.be.revertedWith("Only admin");
    });

    it("should prevent setting zero address as admin", async function () {
      await expect(
        contract.connect(signers.owner).changeAdmin(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });
});
