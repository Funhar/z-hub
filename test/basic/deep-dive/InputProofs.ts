import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { InputProofs, InputProofs__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "InputProofs"
  )) as InputProofs__factory;
  const inputProofs = (await factory.deploy()) as InputProofs;
  const inputProofs_address = await inputProofs.getAddress();

  return { inputProofs, inputProofs_address };
}

/**
 * This example demonstrates input proof verification in FHEVM.
 * Tests verify that properly encrypted values with valid proofs are accepted.
 */
describe("InputProofs", function () {
  let contract: InputProofs;
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
    contractAddress = deployment.inputProofs_address;
    contract = deployment.inputProofs;
  });

  it("should accept value with valid input proof", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 123;

    // Create encrypted input with proof
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();

    // Store with valid proof
    const tx = await contract
      .connect(signers.alice)
      .storeWithProof(input.handles[0], input.inputProof);
    await tx.wait();

    // Verify it was stored
    expect(await contract.hasStoredValue()).to.equal(true);

    // Verify the value
    const encryptedValue = await contract.getValue();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedValue,
      contractAddress,
      signers.alice
    );

    expect(decryptedValue).to.equal(secretValue);
  });

  it("should verify multiple values with single proof", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const valueA = 50;
    const valueB = 75;

    // Create encrypted input with both values - single proof covers both
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(valueA)
      .add8(valueB)
      .encrypt();

    // Store both values with shared proof
    const tx = await contract
      .connect(signers.alice)
      .storeMultipleWithProof(
        input.handles[0],
        input.handles[1],
        input.inputProof
      );
    await tx.wait();

    // Verify the sum was stored
    const encryptedValue = await contract.getValue();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedValue,
      contractAddress,
      signers.alice
    );

    expect(decryptedValue).to.equal(valueA + valueB);
  });

  it("should emit event when value is stored", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(42)
      .encrypt();

    await expect(
      contract
        .connect(signers.alice)
        .storeWithProof(input.handles[0], input.inputProof)
    )
      .to.emit(contract, "ValueStored")
      .withArgs(signers.alice.address);
  });
});
