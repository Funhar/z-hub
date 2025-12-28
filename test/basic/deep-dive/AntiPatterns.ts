import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AntiPatterns, AntiPatterns__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AntiPatterns"
  )) as AntiPatterns__factory;
  const antiPatterns = (await factory.deploy()) as AntiPatterns;
  const antiPatterns_address = await antiPatterns.getAddress();

  return { antiPatterns, antiPatterns_address };
}

/**
 * This example demonstrates common FHEVM anti-patterns.
 * Tests show the difference between wrong and correct approaches.
 */
describe("AntiPatterns", function () {
  let contract: AntiPatterns;
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
    contractAddress = deployment.antiPatterns_address;
    contract = deployment.antiPatterns;
  });

  describe("Anti-Pattern #1: View functions", function () {
    it("CORRECT: non-view function grants access for decryption", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const secretValue = 42;

      // First store correctly
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(secretValue)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Use correct function that grants permission
      tx = await contract.connect(signers.alice).correctGetSecret();
      await tx.wait();

      // Now we can decrypt
      const encrypted = await contract.wrongGetSecret(); // view is fine for getting handle after permission
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Anti-Pattern #2: Missing FHE.allowThis()", function () {
    it("CORRECT: store with allowThis emits event", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(100)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctStoreValue(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyStored");
    });

    it("CORRECT: compute with proper permissions emits event", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value first
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(50)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Compute correctly
      await expect(contract.connect(signers.alice).correctCompute()).to.emit(
        contract,
        "CorrectlyComputed"
      );

      // Verify result
      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(60); // 50 + 10
    });
  });

  describe("Educational Note", function () {
    it("should demonstrate that handles are not values", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store a value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(123)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Get the handle - it's a bytes32-like value, NOT the number 123
      const handle = await contract.wrongGetSecret();

      // The handle is just an identifier - you need decryption to see actual value
      // This is by design - encrypted values stay encrypted on-chain
      expect(handle).to.not.equal(123);
    });
  });

  describe("Anti-Pattern #4: Encrypted conditionals", function () {
    it("CORRECT: should use FHE.select for conditional logic", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Value > 100, so result should be the value itself
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(150)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctConditionalLogic(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyComputed");

      // Verify result is the value (150 > 100)
      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(150);
    });

    it("CORRECT: should return zero when value <= threshold", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Value <= 100, so result should be 0
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(50)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .correctConditionalLogic(input.handles[0], input.inputProof);
      await tx.wait();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(0);
    });
  });

  describe("Anti-Pattern #5: Overflow behavior", function () {
    it("should demonstrate overflow wraps around to 0", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // 255 + 1 = 0 (overflow)
      let tx = await contract.connect(signers.alice).demonstrateOverflow();
      await tx.wait();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(0); // Wrapped around!
    });

    it("CORRECT: bounded add should cap value to prevent overflow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Input 250, maxSafe=245, so capped to 245, then + 10 = 255
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(250)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctBoundedAdd(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyComputed");

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(255); // Capped, no overflow
    });
  });

  describe("Anti-Pattern #6: Unnecessary re-encryption", function () {
    it("CORRECT: should reuse stored constants", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store initial value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(20)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Initialize constant
      tx = await contract.connect(signers.alice).initializeConstant();
      await tx.wait();

      // Reuse encryption: 20 + 10 + 10 + 10 = 50
      await expect(
        contract.connect(signers.alice).correctReuseEncryption()
      ).to.emit(contract, "CorrectlyComputed");

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(50);
    });
  });
});
