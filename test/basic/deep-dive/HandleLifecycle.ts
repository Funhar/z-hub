import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { HandleLifecycle, HandleLifecycle__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "HandleLifecycle"
  )) as HandleLifecycle__factory;
  const handleLifecycle = (await factory.deploy()) as HandleLifecycle;
  const handleLifecycle_address = await handleLifecycle.getAddress();

  return { handleLifecycle, handleLifecycle_address };
}

/**
 * This example demonstrates the lifecycle of FHE handles.
 * Tests verify handle creation, derivation, and type casting.
 */
describe("HandleLifecycle", function () {
  let contract: HandleLifecycle;
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
    contractAddress = deployment.handleLifecycle_address;
    contract = deployment.handleLifecycle;
  });

  it("should create handle from user input", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const value = 42;

    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(value)
      .encrypt();

    await expect(
      contract
        .connect(signers.alice)
        .createFromInput(input.handles[0], input.inputProof)
    )
      .to.emit(contract, "HandleCreated")
      .withArgs("Handle created from user input");

    expect(await contract.handleCreationCount()).to.equal(1);

    // Verify the value
    const encrypted = await contract.getHandle8();
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encrypted,
      contractAddress,
      signers.alice
    );
    expect(decrypted).to.equal(value);
  });

  it("should create handle via trivial encryption", async function () {
    const publicValue = 100;

    await expect(
      contract.connect(signers.alice).createFromTrivialEncryption(publicValue)
    )
      .to.emit(contract, "HandleCreated")
      .withArgs("Handle created via trivial encryption");

    expect(await contract.handleCreationCount()).to.equal(1);
  });

  it("should derive new handle from operations", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const initialValue = 50;

    // First create a handle
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(initialValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .createFromInput(input.handles[0], input.inputProof);
    await tx.wait();

    // Derive a new handle
    await expect(contract.connect(signers.alice).deriveNewHandle())
      .to.emit(contract, "HandleDerived")
      .withArgs("add");

    // Count should be 2 (original + derived)
    expect(await contract.handleCreationCount()).to.equal(2);

    // Derived handle should be original + 1
    const encrypted = await contract.getDerivedHandle();
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encrypted,
      contractAddress,
      signers.alice
    );
    expect(decrypted).to.equal(initialValue + 1);
  });

  it("should cast handle to different type", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const value = 200;

    // Create euint8 handle
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(value)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .createFromInput(input.handles[0], input.inputProof);
    await tx.wait();

    // Cast to euint16
    await expect(contract.connect(signers.alice).castHandle())
      .to.emit(contract, "HandleDerived")
      .withArgs("cast to euint16");

    // Verify cast value
    const encrypted16 = await contract.getHandle16();
    const decrypted16 = await fhevm.userDecryptEuint(
      FhevmType.euint16,
      encrypted16,
      contractAddress,
      signers.alice
    );
    expect(decrypted16).to.equal(value);
  });
});
