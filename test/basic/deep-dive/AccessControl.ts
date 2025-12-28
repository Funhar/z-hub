import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AccessControl, AccessControl__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AccessControl"
  )) as AccessControl__factory;
  const accessControl = (await factory.deploy()) as AccessControl;
  const accessControl_address = await accessControl.getAddress();

  return { accessControl, accessControl_address };
}

/**
 * This example demonstrates FHE access control mechanisms.
 * Tests verify the behavior of allow, allowTransient, and allowThis.
 */
describe("AccessControl", function () {
  let contract: AccessControl;
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
    contractAddress = deployment.accessControl_address;
    contract = deployment.accessControl;
  });

  it("should allow permanent access with FHE.allow()", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 42;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Grant permanent access to Bob
    tx = await contract
      .connect(signers.alice)
      .grantPermanentAccess(bob.address);
    await tx.wait();

    // Bob should be able to decrypt the value
    const encryptedSecret = await contract.getSecret();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedSecret,
      contractAddress,
      bob
    );

    expect(decryptedValue).to.equal(secretValue);
    expect(await contract.hasPermanentAccess(bob.address)).to.equal(true);
  });

  it("should emit event when granting transient access", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 100;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Grant transient access and check event
    await expect(
      contract.connect(signers.alice).grantTransientAccess(bob.address)
    )
      .to.emit(contract, "TransientAccessGranted")
      .withArgs(bob.address);
  });

  it("should allow contract to double its secret value", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 50;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Double the secret
    tx = await contract.connect(signers.alice).doubleSecret();
    await tx.wait();

    // Grant access to Alice to verify
    tx = await contract
      .connect(signers.alice)
      .grantPermanentAccess(signers.alice.address);
    await tx.wait();

    // Verify the value is doubled
    const encryptedSecret = await contract.getSecret();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedSecret,
      contractAddress,
      signers.alice
    );

    expect(decryptedValue).to.equal(secretValue * 2);
  });
});
