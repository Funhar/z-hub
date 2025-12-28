import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { SecretTip, SecretTip__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "SecretTip"
  )) as SecretTip__factory;
  const secretTip = (await factory.deploy()) as SecretTip;
  const secretTip_address = await secretTip.getAddress();

  return { secretTip, secretTip_address };
}

/**
 * Tests for SecretTip - anonymous tipping system
 */
describe("SecretTip", function () {
  let contract: SecretTip;
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
    contractAddress = deployment.secretTip_address;
    contract = deployment.secretTip;
  });

  describe("Tipping", function () {
    it("should accept encrypted tip", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();

      await expect(
        contract.connect(signers.alice).tip(input.handles[0], input.inputProof)
      ).to.emit(contract, "TipReceived");

      expect(await contract.getTipCount()).to.equal(1);
    });

    it("should accumulate multiple tips", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Tip 1: 100
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      // Tip 2: 200
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(200)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(2);

      // Check total
      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(300);
    });

    it("should accept tips from different senders", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice tips 50
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(50)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner tips 75
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add64(75)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(2);
    });
  });

  describe("Viewing Total", function () {
    it("should allow owner to view encrypted total", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(500);
    });

    it("should prevent non-owner from viewing total", async function () {
      await expect(
        contract.connect(signers.alice).getTotalTips()
      ).to.be.revertedWith("Only owner can view total");
    });
  });

  describe("Reset", function () {
    it("should reset tips after withdrawal", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Add some tips
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(1);

      // Reset
      await expect(contract.connect(signers.owner).resetTips()).to.emit(
        contract,
        "TipsWithdrawn"
      );

      expect(await contract.getTipCount()).to.equal(0);

      // Check total is 0
      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(0);
    });

    it("should prevent non-owner from resetting", async function () {
      await expect(
        contract.connect(signers.alice).resetTips()
      ).to.be.revertedWith("Only owner");
    });
  });
});
