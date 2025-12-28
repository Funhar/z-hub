import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHESub, FHESub__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHESub"
  )) as FHESub__factory;
  const fheSub = (await factory.deploy()) as FHESub;
  const fheSub_address = await fheSub.getAddress();

  return { fheSub, fheSub_address };
}

/**
 * This example demonstrates FHE subtraction operation.
 * Tests verify correct computation of a - b on encrypted values.
 */
describe("FHESub", function () {
  let contract: FHESub;
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
    contractAddress = deployment.fheSub_address;
    contract = deployment.fheSub;
  });

  it("a - b should succeed when a > b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute 200 - 50 = 150
    const a = 200;
    const b = 50;

    // Alice encrypts and sets `a` as 200
    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    // Alice encrypts and sets `b` as 50
    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    // Bob computes the result
    tx = await contract.connect(bob).computeAMinusB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(a - b);
  });

  it("a - b should wrap around (underflow) when b > a", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute 10 - 50 = 216 (underflow: 256 - 40 = 216)
    const a = 10;
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

    tx = await contract.connect(bob).computeAMinusB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResult,
      contractAddress,
      bob
    );

    // euint8 wraps around: 10 - 50 = 256 + (10 - 50) = 216
    expect(clearResult).to.equal(216);
  });
});
