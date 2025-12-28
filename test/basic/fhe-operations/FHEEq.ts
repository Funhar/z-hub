import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEEq, FHEEq__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEEq")) as FHEEq__factory;
  const fheEq = (await factory.deploy()) as FHEEq;
  const fheEq_address = await fheEq.getAddress();

  return { fheEq, fheEq_address };
}

/**
 * This example demonstrates FHE equality comparison.
 * Tests verify that FHE.eq() correctly compares encrypted values.
 */
describe("FHEEq", function () {
  let contract: FHEEq;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.fheEq_address;
    contract = deployment.fheEq;
  });

  it("should return true when a equals b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Both values are 100
    const a = 100;
    const b = 100;

    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    tx = await contract.connect(bob).compareAEqualsB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(true);
  });

  it("should return false when a does not equal b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Different values
    const a = 100;
    const b = 50;

    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    tx = await contract.connect(bob).compareAEqualsB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(false);
  });
});
